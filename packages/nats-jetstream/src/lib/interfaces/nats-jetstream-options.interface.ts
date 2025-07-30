import { AckPolicy, Codec, ConnectionOptions, ConsumerConfig, ConsumerOptsBuilder, DeliverPolicy } from "nats";
import { LoggerService } from "@nestjs/common";

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
   * If not provided, defaults to ['*', '>']
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
   * @default true
   */
  durable?: boolean;
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
}
