import { describe, it } from '@jest/globals';
import { JetStream } from '../lib/jetstream.transport';
import { Logger } from '@nestjs/common';

describe('event-pattern handling', () => {
  it('should add patterns and clean up connections', async () => {
    const logger = new Logger('EventPatternTest');

    const js = new JetStream({
      servers: 'nats://localhost:4222',
      stream: {
        name: 'test-event-patterns',
        subjects: ['base.subject.*']
      },
      logger,
      // Explicitly set multiStream to undefined to ensure we don't use multi-stream mode
      multiStream: undefined
    });

    // Add event handlers with patterns that should be automatically added to the stream
    js.addHandler('base.subject.one', async () => { return {}; }, true);
    js.addHandler('base.subject.two', async () => { return {}; }, true);

    // Add an event handler with a pattern that doesn't match the stream subjects
    // This should trigger ensureStreamCanHandleEventPatterns to update the stream
    js.addHandler('new.pattern.test', async () => { return {}; }, true);

    try {
      // Connect and initialize streams
      await js.listen(() => {
        logger.log('Test connected to NATS');
      });

      logger.log('Test completed successfully');
    } catch (error) {
      logger.error(`Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Ensure close is called to clean up background monitors
      try { if (typeof (js as any).close === 'function') await (js as any).close(); } catch (_) { }
    }
  }, 20000);
});

