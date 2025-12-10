import { AckPolicy, Codec, ConnectionOptions, ConsumerConfig, ConsumerOptsBuilder, DeliverPolicy } from "nats";
import { LoggerService } from "@nestjs/common";
import { JetStreamMapper } from '../jetstream.types';

/**
 * Stream configuration options
 */
export interface StreamOptions {
  /**
   * Name of the stream
   * @see https://docs.nats.io/jetstream/concepts/streams
   */
  name?: string;

  /**
   * Description of the stream
   */
  description?: string;

  /**
   * Subjects associated with the stream
   * If not provided, defaults to ['*']
   * Note: Using '>' wildcard can cause deliver subject cycle errors
   */
  subjects?: string[];
}

/**
 * Consumer configuration options with optional durable config
 */
export interface ConsumerOptions extends Partial<ConsumerConfig> {
  /**
   * Name of the consumer (maps to durable_name in NATS)
   * @see https://docs.nats.io/jetstream/concepts/consumers
   */
  name?: string;

  /**
   * Whether this consumer should be durable
   * If false, name/durable_name will be ignored
   * @default true for event patterns, false for message patterns
   */
  durable?: boolean;
}

/**
 * Options for configuring the ConsumerHealthService
 */
export interface ConsumerHealthOptions {
  /** Monitoring interval in milliseconds (default: 30000) */
  monitoringIntervalMs?: number;
  /** Pending messages threshold to mark error (default: 1000) */
  pendingThreshold?: number;
  /** Redelivered messages threshold to mark error (default: 100) */
  redeliveryThreshold?: number;
  /** Idle timeout in milliseconds to mark idle (default: 300000 / 5min) */
  idleTimeoutMs?: number;
  /** Cache TTL in milliseconds for health entries (default: 15min) */
  cacheTtlMs?: number;
}

/**
 * Multi-stream configuration options
 */
export interface MultiStreamOptions {
  /**
   * Array of stream configurations
   */
  streams: StreamOptions[];

  /**
   * Default stream name for backward compatibility
   */
  defaultStream?: string;

  /**
   * Mapping of event patterns to specific streams
   */
  patternToStream?: Map<string, string>;

  /**
   * Consumer configuration per stream
   * Allows different consumer settings for each stream
   */
  streamConsumers?: Map<string, ConsumerOptions>;

  /**
   * Whether to register streams asynchronously
   */
  asyncRegistration?: boolean;
}

export interface NatsJetStreamOptions {
  /**
   * NATS codec to use for encoding and decoding messages
   */
  codec?: Codec<unknown>;

  /**
   * NATS connection options
   */
  connection?: ConnectionOptions;

  /**
   * Consumer options for JetStream subscriptions
   * @see https://github.com/nats-io/nats.deno/blob/main/jetstream.md#push-subscriptions
   * @see https://docs.nats.io/jetstream/concepts/consumers
   */
  consumer?: (options: ConsumerOptsBuilder) => void;

  /**
   * Queue group name
   * @see https://docs.nats.io/nats-concepts/queue
   */
  queue?: string;

  /**
   * JetStream stream name
   * @deprecated This option will be removed in the next major release. Use stream.name instead.
   * @see https://docs.nats.io/jetstream/concepts/streams
   */
  streamName?: string;

  /**
   * Stream configuration options
   */
  stream?: StreamOptions;

  /**
   * JetStream durable consumer name
   * @deprecated This option will be removed in the next major release. Use consumerOptions.name instead.
   * @see https://docs.nats.io/jetstream/concepts/consumers
   */
  durableName?: string;

  /**
   * Consumer configuration options
   */
  consumerOptions?: ConsumerOptions;

  /**
   * Application name for consumer naming
   */
  appName?: string;

  /**
   * Delivery policy for the consumer
   * @deprecated This option will be removed in the next major release. Use consumerOptions.deliver_policy instead.
   * @see https://docs.nats.io/jetstream/concepts/consumers#deliverpolicy
   */
  deliverPolicy?: DeliverPolicy;

  /**
   * Acknowledgment policy for the consumer
   * @deprecated This option will be removed in the next major release. Use consumerOptions.ack_policy instead.
   * @see https://docs.nats.io/jetstream/concepts/consumers#acknowledgement
   */
  ackPolicy?: AckPolicy;

  /**
   * How long to wait for an acknowledgment
   * @deprecated This option will be removed in the next major release. Use consumerOptions.ack_wait instead.
   * @see https://docs.nats.io/jetstream/concepts/consumers#ackwait
   */
  ackWait?: number;

  /**
   * A single subject to filter messages from the stream
   * @deprecated This option will be removed in the next major release. Use consumerOptions.filter_subject instead.
   * @see https://docs.nats.io/jetstream/concepts/consumers#filtersubject
   */
  filterSubject?: string;

  /**
   * Multiple subjects to filter messages from the stream
   * @deprecated This option will be removed in the next major release. Use consumerOptions.filter_subjects instead.
   * @see https://docs.nats.io/jetstream/concepts/consumers#filtersubjects
   */
  filterSubjects?: string[];

  /**
   * Logger service to use for logging
   */
  logger?: LoggerService;

  /**
   * Optional custom mapper for incoming messages.
   */
  mapper?: JetStreamMapper;

  /**
   * Default mapper to use if no custom mapper is provided.
   * - 'subject': Maps NATS subject to handler key, and decoded data to handler payload.
   * - 'envelope': Assumes a message envelope and maps its `type` to handler key.
   * @default 'subject'
   */
  defaultMapper?: 'subject' | 'envelope';

  /**
   * Multi-stream configuration
   * If provided, overrides single stream configuration
   */
  multiStream?: MultiStreamOptions;

  /**
   * Options for consumer health monitoring service
   */
  consumerHealth?: ConsumerHealthOptions;
}
