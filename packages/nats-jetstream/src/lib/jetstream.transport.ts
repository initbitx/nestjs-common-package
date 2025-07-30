import { CustomTransportStrategy, MessageHandler, Server } from '@nestjs/microservices';
import { Logger, LoggerService } from '@nestjs/common';

import { AckPolicy, Codec, connect, ConsumerConfig, consumerOpts, ConsumerOptsBuilder, createInbox, DeliverPolicy, DiscardPolicy, JetStreamClient, JetStreamManager, JsMsg, JSONCodec, Msg, NatsConnection, NatsError, ReplayPolicy, RetentionPolicy, StorageType, StreamConfig } from 'nats';

import { NatsContext } from './nats.context';
import { NACK, TERM } from './nats.constants';
import { ConsumerOptions, StreamOptions } from './interfaces/nats-jetstream-options.interface';

export class JetStream extends Server implements CustomTransportStrategy {

  protected override readonly logger: LoggerService;
  protected nc?: NatsConnection;
  protected js?: JetStreamClient;
  protected jsm?: JetStreamManager;
  protected codec: Codec<unknown> = JSONCodec();
  protected readonly durableName: string;
  private eventHandlers = new Map<string, Function>();

  constructor(
    private readonly options: {
      servers: string | string[],
      streamName?: string,
      durableName?: string,
      queue?: string,
      consumer?: (consumerOptions: ConsumerOptsBuilder) => void,
      deliverPolicy?: DeliverPolicy,
      ackPolicy?: AckPolicy,
      ackWait?: number,
      filterSubject?: string,
      filterSubjects?: string[],
      logger?: LoggerService,
      // New options
      stream?: StreamOptions,
      consumerOptions?: ConsumerOptions
    }
  ) {
    super();

    // For backward compatibility, use durableName from options if consumerOptions.name is not provided
    this.durableName = options.consumerOptions?.name || options.durableName || 'default';

    // If stream.name is provided but streamName is not, set streamName from stream.name
    if (options.stream?.name && !options.streamName) {
      this.options.streamName = options.stream.name;
    }
    // If streamName is provided but stream.name is not, create/update stream object
    else if (options.streamName && options.stream && !options.stream.name) {
      // Ensure this.options.stream is defined before accessing its properties
      if (!this.options.stream) {
        this.options.stream = { name: options.streamName };
      } else {
        this.options.stream.name = options.streamName;
      }
    }
    // If neither is provided, set a default
    else if (!options.streamName && (!options.stream || !options.stream.name)) {
      this.options.streamName = 'default';
      if (!this.options.stream) {
        this.options.stream = { name: 'default' };
      } else {
        this.options.stream.name = 'default';
      }
    }

    // Initialize logger
    this.logger = options.logger || new Logger(JetStream.name);

    // Ensure servers is always an array
    if (typeof this.options.servers === 'string') {
      this.options.servers = [this.options.servers];
    }
  }

  async listen(callback: () => void) {
    const servers = Array.isArray(this.options.servers)
      ? this.options.servers.join(', ')
      : this.options.servers;
    this.logger.log(`Connecting to NATS JetStream (${servers})...`);
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
      // Get stream name from the appropriate source
      const streamName = this.options.stream?.name || this.options.streamName || 'default';

      // Create stream configuration
      const streamConfig: StreamConfig = {
        name: streamName,
        subjects: this.options.stream?.subjects || [ '*', '>' ],
        retention: RetentionPolicy.Limits,
        storage: StorageType.File,
        max_consumers: 0,
        sealed: false,
        first_seq: 0,
        max_msgs_per_subject: 0,
        max_msgs: 0,
        max_age: 0,
        max_bytes: 0,
        max_msg_size: 0,
        discard: DiscardPolicy.Old,
        discard_new_per_subject: false,
        duplicate_window: 0,
        allow_rollup_hdrs: false,
        num_replicas: 0,
        deny_delete: false,
        deny_purge: false,
        allow_direct: false,
        mirror_direct: false
      };

      // Add description if provided
      if (this.options.stream?.description) {
        streamConfig.description = this.options.stream.description;
      }

      // Check if stream exists
      try {
        const existingStream = await jsm.streams.info(streamName);

        // If stream exists, update it with new config
        if (existingStream) {
          await jsm.streams.update(streamName, streamConfig);
          this.logger.log(`Stream "${streamName}" updated.`);
        }
      } catch (error) {
        // Stream doesn't exist, create it
        await jsm.streams.add(streamConfig);
        this.logger.log(`Stream "${streamName}" created.`);
      }
    } catch (err: any) {
      this.logger.error(`Error creating/updating stream: ${err.message}`);
    }
  }

  async ensureConsumer(jsm: JetStreamManager) {
    try {
      // Get stream name from the appropriate source
      const streamName = this.options.stream?.name || this.options.streamName || 'default';

      // Get consumer name from the appropriate source
      const consumerName = this.options.consumerOptions?.name || this.durableName;

      // Start with base consumer config
      const consumerConfig: ConsumerConfig = {
        ack_policy: this.options.ackPolicy || AckPolicy.Explicit,
        deliver_policy: this.options.deliverPolicy || DeliverPolicy.All,
        replay_policy: ReplayPolicy.Original
      };

      // Check if we should create a durable consumer
      const isDurable = this.options.consumerOptions?.durable !== false;

      // Add durable_name if this is a durable consumer
      if (isDurable && consumerName) {
        consumerConfig.durable_name = consumerName;
      }

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

      // Apply any additional consumer options
      if (this.options.consumerOptions) {
        // Merge consumer options, excluding 'durable' and 'name' which are handled separately
        const { durable, name, ...restOptions } = this.options.consumerOptions;
        Object.assign(consumerConfig, restOptions);
      }

      // Create or update the consumer
      try {
        // Check if consumer exists (for durable consumers)
        if (isDurable && consumerName) {
          try {
            await jsm.consumers.info(streamName, consumerName);
            // Consumer exists, update it
            await jsm.consumers.update(streamName, consumerName, consumerConfig);
            this.logger.log(`Durable consumer "${consumerName}" updated.`);
          } catch (error) {
            // Consumer doesn't exist, create it
            await jsm.consumers.add(streamName, consumerConfig);
            this.logger.log(`Durable consumer "${consumerName}" created.`);
          }
        } else {
          // For non-durable consumers, always create a new one
          await jsm.consumers.add(streamName, consumerConfig);
          this.logger.log(`Ephemeral consumer created.`);
        }
      } catch (err: any) {
        this.logger.error(`Error creating/updating consumer: ${err.message}`);
      }
    } catch (err: any) {
      this.logger.error(`Error setting up consumer: ${err.message}`);
    }
  }

  subscribeToTopics(js: JetStreamClient) {
    // Log all patterns
    /*for (const pattern of this.messageHandlers.keys()) {
      // Use the pattern directly without appending streamName
      this.logger.log(`Subscribed to: ${pattern}`);
    }*/

    // Subscribe to event patterns using JetStream
    this.subscribeToEventPatterns(js);

    // Subscribe to message patterns using the NATS connection
    if (this.nc) {
      this.subscribeToMessagePatterns(this.nc);
    } else {
      this.logger.error('NATS connection not established. Cannot subscribe to message patterns.');
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

  async subscribeToEventPatterns(client: JetStreamClient): Promise<void> {
    const eventHandlers = [ ...this.messageHandlers.entries() ].filter(
      ([ , handler ]) => handler.isEventHandler
    );

    // Get stream name from the appropriate source
    const streamName = this.options.stream?.name || this.options.streamName || 'default';

    for (const [ pattern, handler ] of eventHandlers) {
      // Create a direct ConsumerOpts object instead of using the builder
      const consumerOptions: Partial<ConsumerConfig> = {
        deliver_subject: createInbox(),
        ack_policy: AckPolicy.Explicit,
        filter_subject: pattern
      };

      // Apply any custom consumer options if provided
      if (this.options.consumer) {
        const tempBuilder = consumerOpts();
        this.options.consumer(tempBuilder);
        // We can't access the built options directly, so we'll rely on the client to merge them
      }

      // Create a callback function for handling messages
      const callbackFn = (error: NatsError | null, message: JsMsg | null): void => {
        if (error) {
          this.logger.error(error.message, error.stack);
          return;
        }

        if (message) {
          // Call handleJetStreamMessage but don't return its Promise
          this.handleJetStreamMessage(message, handler).catch(err => {
            this.logger.error(`Error handling JetStream message: ${err.message}`, err.stack);
          });
        }
      };

      try {
        // Use client.subscribe with the pattern, passing the stream name as part of the options
        // The NATS client will handle merging these options with any provided by the consumer function
        await client.subscribe(pattern, {
          config: consumerOptions,
          stream: streamName,
          mack: true, // Enable manual ack
          callbackFn
        });

        this.logger.log(`Subscribed to ${pattern} events in stream ${streamName}`);
      } catch (error) {
        if (!(error instanceof NatsError) || !error.isJetStreamError()) {
          throw error;
        }

        if (error.message === 'no stream matches subject') {
          throw new Error(`Cannot find stream with the ${pattern} event pattern. Make sure the stream "${streamName}" includes this subject.`);
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
}
