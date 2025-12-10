import { describe, it } from '@jest/globals';
import { JetStream } from '../lib/jetstream.transport';
import { Logger } from '@nestjs/common';

describe('stream-subject matching', () => {
  it('should initialize streams and close connections', async () => {
    const logger = new Logger('StreamSubjectTest');

    const jsWithLegacyOptions = new JetStream({
      servers: 'nats://localhost:4222',
      streamName: 'test-stream',
      filterSubject: 'test.subject',
      logger
    });

    const jsWithNewOptions = new JetStream({
      servers: 'nats://localhost:4222',
      stream: {
        name: 'test-stream-new',
        subjects: ['test.new.subject']
      },
      logger
    });

    const jsWithMixedOptions = new JetStream({
      servers: 'nats://localhost:4222',
      streamName: 'test-stream-mixed',
      filterSubjects: ['test.mixed.subject1', 'test.mixed.subject2'],
      stream: {
        description: 'Test stream with mixed options'
      },
      logger
    });

    jsWithLegacyOptions.addHandler('test.subject.event', async () => { return {}; }, true);
    jsWithNewOptions.addHandler('test.new.subject.event', async () => { return {}; }, true);
    jsWithMixedOptions.addHandler('test.mixed.subject1.event', async () => { return {}; }, true);

    try {
      await jsWithLegacyOptions.listen(() => { logger.log('Legacy connected'); });
      await jsWithLegacyOptions.close();

      await jsWithNewOptions.listen(() => { logger.log('New connected'); });
      await jsWithNewOptions.close();

      await jsWithMixedOptions.listen(() => { logger.log('Mixed connected'); });
      await jsWithMixedOptions.close();
    } finally {
      // ensure cleanup if something threw
      try { if (typeof (jsWithLegacyOptions as any).close === 'function') await (jsWithLegacyOptions as any).close(); } catch (_) { }
      try { if (typeof (jsWithNewOptions as any).close === 'function') await (jsWithNewOptions as any).close(); } catch (_) { }
      try { if (typeof (jsWithMixedOptions as any).close === 'function') await (jsWithMixedOptions as any).close(); } catch (_) { }
    }
  }, 20000);
});

