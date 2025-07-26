import { CustomTransportStrategy, MessageHandler, Server } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';

import { AckPolicy, Codec, connect, ConsumerConfig, consumerOpts, ConsumerOptsBuilder, createInbox, DeliverPolicy, JetStreamClient, JetStreamManager, JsMsg, JSONCodec, Msg, NatsConnection, NatsError, ReplayPolicy } from 'nats';

import { NatsContext } from './nats.context';
import { NACK, TERM } from './nats.constants';

export class JetStream extends Server implements CustomTransportStrategy {

  protected override readonly logger = new Logger(JetStream.name);
  protected nc?: NatsConnection;
  protected js?: JetStreamClient;
  protected jsm?: JetStreamManager;
  protected codec: Codec<unknown> = JSONCodec();
  protected readonly durableName: string;
  private eventHandlers = new Map<string, Function>();

  constructor(private readonly options: {
    servers: string | string[],
    streamName: string,
    durableName: string,
    queue?: string,
    consumer?: (consumerOptions: ConsumerOptsBuilder) => void,
    deliverPolicy?: DeliverPolicy,
    ackPolicy?: AckPolicy,
    ackWait?: number,
    filterSubject?: string,
    filterSubjects?: string[]
  }) {
    super();
    this.durableName = options.durableName;

    // Ensure servers is always an array
    if (typeof this.options.servers === 'string') {
      this.options.servers = [this.options.servers];
    }
  }

  async listen(callback: () => void) {
    const serversDisplay = Array.isArray(this.options.servers)
      ? this.options.servers.join(', ')
      : this.options.servers;
    this.logger.log(`Connecting to NATS JetStream (${serversDisplay})...`);
    this.nc = await connect({ servers: this.options.servers });
    this.js = this.nc.jetstream();
    this.jsm = await this.nc.jetstreamManager();

    await this.ensureStream(this.jsm);
    await this.ensureConsumer(this.jsm);

    this.logger.log('JetStream connection established.');
    this.subscribeToTopics(this.js);

    callback();
  }

  async close() {
    this.logger.log('Closing JetStream connection...');
    if (this.nc) {
      await this.nc.drain();

      this.nc = undefined;
      this.js = undefined;
      this.jsm = undefined;
    }
  }

  on(event: string, callback: Function) {
    this.eventHandlers.set(event, callback);
  }

  unwrap<T>(value?: T): T {
    return <T>value;
  }

  async ensureStream(jsm: JetStreamManager) {
    try {
      await jsm.streams.add({ name: this.options.streamName, subjects: [ `${this.options.streamName}.*` ] });
      this.logger.log(`Stream "${this.options.streamName}" created.`);
    } catch (err: any) {
      if (err.message.includes('already in use')) {
        this.logger.log(`Stream "${this.options.streamName}" already exists.`);
      } else {
        this.logger.error(`Error creating stream: ${err.message}`);
      }
    }
  }

  async ensureConsumer(jsm: JetStreamManager) {
    try {
      const consumerConfig: ConsumerConfig = {
        durable_name: this.durableName,
        ack_policy: this.options.ackPolicy || AckPolicy.Explicit,
        deliver_policy: this.options.deliverPolicy || DeliverPolicy.All,
        replay_policy: ReplayPolicy.Original
      };

      // Add ackWait if specified
      if (this.options.ackWait !== undefined) {
        consumerConfig.ack_wait = this.options.ackWait * 1_000_000; // Convert to nanoseconds
      }

      // Add filterSubject if specified
      if (this.options.filterSubject) {
        consumerConfig.filter_subject = this.options.filterSubject;
      }

      // Add filterSubjects if specified
      if (this.options.filterSubjects && this.options.filterSubjects.length > 0) {
        consumerConfig.filter_subjects = this.options.filterSubjects;
      }

      await jsm.consumers.add(this.options.streamName, consumerConfig);
      this.logger.log(`Durable consumer "${this.durableName}" set up.`);
    } catch (err: any) {
      if (err.message.includes('already in use')) {
        this.logger.log(`Durable consumer "${this.durableName}" already exists.`);
      } else {
        this.logger.error(`Error creating consumer: ${err.message}`);
      }
    }
  }

  subscribeToTopics(js: JetStreamClient) {
    for (const pattern of this.messageHandlers.keys()) {
      const subject = `${this.options.streamName}.${pattern}`;

      this.logger.log(`Subscribed to: ${subject}`);
    }
  }

  async handleJetStreamMessage(message: JsMsg, handler: MessageHandler): Promise<void> {
    const decoded = this.codec.decode(message.data);

    message.working();

    try {
      await handler(decoded, new NatsContext([ message ]))
        .then((maybeObservable) => this.transformToObservable(maybeObservable))
        .then((observable) => observable.toPromise());

      message.ack();
    } catch (error) {
      if (error === NACK) {
        return message.nak();
      }

      if (error === TERM) {
        return message.term();
      }

      throw error;
    }
  }

  async handleNatsMessage(message: Msg, handler: MessageHandler): Promise<void> {
    const decoded = this.codec.decode(message.data);

    const maybeObservable = await handler(decoded, new NatsContext([ message ]));
    const response$ = this.transformToObservable(maybeObservable);

    this.send(response$, (response) => {
      const encoded = this.codec.encode(response);

      message.respond(encoded);
    });
  }

  async handleStatusUpdates(connection: NatsConnection): Promise<void> {
    for await (const status of connection.status()) {
      const data = typeof status.data === 'object' ? JSON.stringify(status.data) : status.data;
      const message = `(${status.type}): ${data}`;

      switch (status.type) {
        case 'pingTimer':
        case 'reconnecting':
        case 'staleConnection':
          this.logger.debug(message);
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
          this.logger.verbose(message);
          break;
      }
    }
  }

  async subscribeToEventPatterns(client: JetStreamClient): Promise<void> {
    const eventHandlers = [ ...this.messageHandlers.entries() ].filter(
      ([ , handler ]) => handler.isEventHandler
    );

    for (const [ pattern, handler ] of eventHandlers) {
      const consumerOptions = consumerOpts();

      if (this.options.consumer) {
        this.options.consumer(consumerOptions);
      }

      consumerOptions.callback((error, message) => {
        if (error) {
          return this.logger.error(error.message, error.stack);
        }

        if (message) {
          return this.handleJetStreamMessage(message, handler);
        }
      });

      consumerOptions.deliverTo(createInbox());

      consumerOptions.manualAck();

      try {
        await client.subscribe(pattern, consumerOptions);

        this.logger.log(`Subscribed to ${pattern} events`);
      } catch (error) {
        if (!(error instanceof NatsError) || !error.isJetStreamError()) {
          throw error;
        }

        if (error.message === 'no stream matches subject') {
          throw new Error(`Cannot find stream with the ${pattern} event pattern`);
        }
      }
    }
  }

  subscribeToMessagePatterns(connection: NatsConnection): void {
    const messageHandlers = [ ...this.messageHandlers.entries() ].filter(
      ([ , handler ]) => !handler.isEventHandler
    );

    for (const [ pattern, handler ] of messageHandlers) {
      connection.subscribe(pattern, {
        callback: (error, message) => {
          if (error) {
            return this.logger.error(error.message, error.stack);
          }

          return this.handleNatsMessage(message, handler);
        },
        queue: this.options.queue
      });

      this.logger.log(`Subscribed to ${pattern} messages`);
    }
  }
}
