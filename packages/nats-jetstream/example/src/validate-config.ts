/**
 * Minimal validator for multi-stream configuration.
 * This file intentionally avoids importing the local package so it can be run
 * without building the library. It constructs an example configuration object
 * that mirrors the shape used by the README and prints it.
 */

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
    ['orders.updated', 'orders-stream'],
    ['users.registered', 'users-stream']
  ]);

  const streamConsumers = new Map<string, ConsumerConfig>([
    ['orders-stream', {
      name: 'orders-durable-consumer',
      durable: true,
      ack_wait: 30_000_000_000, // 30s in ns
      deliver_policy: 'new',
      ack_policy: 'explicit',
      max_deliver: 10,
      max_ack_pending: 500,
      // Demonstrate server-side consumer filtering to only receive the required events
      filter_subjects: ['orders.created']
    }],
    ['users-stream', {
      name: 'users-durable-consumer',
      durable: true,
      ack_wait: 30_000_000_000,
      deliver_policy: 'all',
      ack_policy: 'explicit',
      max_deliver: 5,
      max_ack_pending: 200,
      filter_subjects: ['users.registered']
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
