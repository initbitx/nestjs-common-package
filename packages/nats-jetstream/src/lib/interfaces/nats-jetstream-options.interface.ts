import { AckPolicy, Codec, ConnectionOptions, ConsumerOptsBuilder, DeliverPolicy } from "nats";

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
   * @see https://docs.nats.io/jetstream/concepts/streams
   */
  streamName?: string;

  /**
   * JetStream durable consumer name
   * @see https://docs.nats.io/jetstream/concepts/consumers
   */
  durableName?: string;

  /**
   * Delivery policy for the consumer
   * @see https://docs.nats.io/jetstream/concepts/consumers#deliverpolicy
   */
  deliverPolicy?: DeliverPolicy;

  /**
   * Acknowledgment policy for the consumer
   * @see https://docs.nats.io/jetstream/concepts/consumers#acknowledgement
   */
  ackPolicy?: AckPolicy;

  /**
   * How long to wait for an acknowledgment
   * @see https://docs.nats.io/jetstream/concepts/consumers#ackwait
   */
  ackWait?: number;

  /**
   * A single subject to filter messages from the stream
   * @see https://docs.nats.io/jetstream/concepts/consumers#filtersubject
   */
  filterSubject?: string;

  /**
   * Multiple subjects to filter messages from the stream
   * @see https://docs.nats.io/jetstream/concepts/consumers#filtersubjects
   */
  filterSubjects?: string[];
}
