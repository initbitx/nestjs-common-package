/**
 * Minimal validator for multi-stream configuration.
 * This file intentionally avoids importing the local package so it can be run
 * without building the library. It constructs an example configuration object
 * that mirrors the shape used by the README and prints it.
 */
import {AckPolicy, DeliverPolicy, ReplayPolicy} from "nats";

type StreamConfig = {
  name: string;
  description?: string;
  subjects: string[];
};

type ConsumerConfig = Record<string, unknown>;

export function buildExampleMultiStreamConfig() {
  const streams: StreamConfig[] = [
    {
      name: 'orders-stream',
      description: 'Stream for order events',
      subjects: ['orders.created']
    },
  ];

  const patternToStream = new Map<string, string>([
    ['orders.created', 'orders-stream'],
  ]);

  const streamConsumers = new Map<string, ConsumerConfig>([
    ['orders-stream', {
      name: 'orders-durable-consumer',
      durable: true,
      deliver_policy: DeliverPolicy.All,
      ack_policy: AckPolicy.Explicit,
      replay_policy: ReplayPolicy.Instant,
      max_deliver: -1,
      max_ack_pending: 2000,
      max_waiting: 512,
      ack_wait: 1_000,
      backoff: [1000000000, 2000000000, 5000000000, 10000000000, 30000000000, 60000000000, 120000000000, 300000000000],
      filter_subjects: ['orders.created'],
    }]
  ]);

  return {
    connection: { servers: ['nats://localhost:4222'] },
    multiStream: {
      streams,
      defaultStream: 'orders-stream',
      patternToStream,
      streamConsumers,
      asyncRegistration: true
    },
    appName: 'example-app'
  } as const;
}

if (require.main === module) {
  // CLI mode: print the config
  const cfg = buildExampleMultiStreamConfig();
  // Convert Maps to arrays for JSON-friendly printing
  const printable = {
    ...cfg,
    multiStream: {
      ...cfg.multiStream,
      patternToStream: Array.from(cfg.multiStream.patternToStream.entries()),
      streamConsumers: Array.from(cfg.multiStream.streamConsumers.entries())
    }
  };
  // Use console.log so running `npm run validate` shows output
  console.log('Multi-stream config:', JSON.stringify(printable, null, 2));
}
