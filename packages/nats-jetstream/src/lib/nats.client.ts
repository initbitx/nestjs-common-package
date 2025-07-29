import { ClientProxy, ReadPacket, WritePacket } from '@nestjs/microservices';
import { Logger, LoggerService } from '@nestjs/common';

import { Codec, connect, ConnectionOptions, JetStreamClient, JSONCodec, NatsConnection } from 'nats';

import { noop } from 'rxjs';

import { NatsClientOptions } from './interfaces/nats-client-options.interface';

export class NatsClient extends ClientProxy {
  protected readonly codec: Codec<unknown>;
  protected readonly logger: LoggerService;

  protected connection?: NatsConnection;
  protected jetstreamClient?: JetStreamClient;

  constructor(protected readonly options: NatsClientOptions = {}) {
    super();
    this.codec = options.codec || JSONCodec();
    this.logger = options.logger || new Logger(this.constructor.name);
  }

  async connect(): Promise<NatsConnection> {
    if (this.connection) {
      return this.connection;
    }

    this.connection = await this.createNatsConnection(this.options.connection);
    this.jetstreamClient = this.createJetStreamClient(this.connection);

    await this.handleStatusUpdates(this.connection);

    this.logger.log(`Connected to ${this.connection.getServer()}`);

    return this.connection;
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.drain();

      this.connection = undefined;
      this.jetstreamClient = undefined;
    }
  }

  createJetStreamClient(connection: NatsConnection): JetStreamClient {
    return connection.jetstream();
  }

  createNatsConnection(options: ConnectionOptions = {}): Promise<NatsConnection> {
    return connect(options);
  }

  getConnection(): NatsConnection | undefined {
    return this.connection;
  }

  getJetStreamClient(): JetStreamClient | undefined {
    return this.jetstreamClient;
  }

  async handleStatusUpdates(connection: NatsConnection): Promise<void> {
    for await (const status of connection.status()) {
      const data = typeof status.data === 'object' ? JSON.stringify(status.data) : status.data;
      const message = `(${status.type}): ${data}`;

      switch (status.type) {
        case 'pingTimer':
        case 'reconnecting':
        case 'staleConnection':
          this.logger?.debug?.(message);
          break;

        case 'disconnect':
        case 'error':
          this.logger.error(message);
          break;

        case 'reconnect':
          this.logger.log(message);
          break;

        case 'ldm':
          this.logger.warn(message);
          break;

        case 'update':
          this.logger?.verbose?.(message);
          break;
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async dispatchEvent(packet: ReadPacket): Promise<any> {
    // Ensure connection is established
    if (!this.connection) {
      this.logger.log('Connecting to NATS before dispatching event...');
      await this.connect();
    }

    if (!this.jetstreamClient) {
      this.logger.log('Initializing JetStream client...');
      this.jetstreamClient = this.createJetStreamClient(this.connection!);
    }

    // Throw error if jetstream client is still undefined after initialization attempt
    if (!this.jetstreamClient) {
      throw new Error('JetStream client is undefined');
    }

    const payload = this.codec.encode(packet.data);
    const subject = this.normalizePattern(packet.pattern);

    this.logger.log(`Dispatching event to subject: ${subject}`);

    // Add retry logic with exponential backoff
    const maxRetries = 3;
    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount < maxRetries) {
      try {
        await this.jetstreamClient!.publish(subject, payload);
        this.logger.log(`Event successfully published to ${subject}`);
        return;
      } catch (error: any) {
        lastError = error;
        retryCount++;

        if (error.code === '503') {
          this.logger.warn(`JetStream service unavailable (503), retry ${retryCount}/${maxRetries}`);

          // Attempt to reconnect
          try {
            this.logger.log('Attempting to reconnect to JetStream...');
            await this.close();
            await this.connect();
            this.jetstreamClient = this.createJetStreamClient(this.connection!);
          } catch (reconnectError: any) {
            this.logger.error(`Failed to reconnect: ${reconnectError.message}`);
          }

          // Wait before retrying with exponential backoff
          const delay = Math.pow(2, retryCount) * 100;
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          this.logger.error(`Error publishing event: ${error.message}`);
          throw error; // For non-503 errors, don't retry
        }
      }
    }

    // If we've exhausted all retries
    if (lastError) {
      this.logger.error(`Failed to publish event after ${maxRetries} retries: ${lastError.message}`);
      throw lastError;
    }
  }

  protected publish(packet: ReadPacket, callback: (packet: WritePacket) => void): typeof noop {
    if (!this.connection) {
      throw new Error('NATS not connected!');
    }

    const payload = this.codec.encode(packet.data);
    const subject = this.normalizePattern(packet.pattern);

    this.connection
      .request(subject, payload)
      .then((encoded) => this.codec.decode(encoded.data) as WritePacket)
      .then((packet) => callback(packet))
      .catch((err) => callback({ err }));

    // No teardown function needed as the subscription is handled for us, so return noop
    return noop;
  }

  unwrap<T>(value?: T): T {
    return <T>value;
  }
}
