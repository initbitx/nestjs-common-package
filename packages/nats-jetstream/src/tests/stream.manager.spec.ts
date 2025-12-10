import { StreamManager } from '../lib/stream.manager';
import { MultiStreamOptions } from '../lib/interfaces/nats-jetstream-options.interface';
import { LoggerService } from '@nestjs/common';

describe('StreamManager', () => {
  let streamManager: StreamManager;
  let mockJsm: any;
  let mockLogger: LoggerService;

  beforeEach(() => {
    mockJsm = {
      streams: {
        info: jest.fn(),
        add: jest.fn(),
        update: jest.fn()
      },
      consumers: {
        info: jest.fn(),
        add: jest.fn(),
        update: jest.fn()
      }
    };

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn()
    };

    streamManager = new StreamManager(mockJsm, mockLogger);
  });

  describe('getStreamForPattern', () => {
    it('should return mapped stream for known pattern', () => {
      const multiStreamOptions: MultiStreamOptions = {
        streams: [
          { name: 'events', subjects: ['events.*'] },
          { name: 'commands', subjects: ['commands.*'] }
        ],
        patternToStream: new Map([
          ['events.user.created', 'events'],
          ['commands.user.create', 'commands']
        ])
      };

      expect(streamManager.getStreamForPattern('events.user.created', multiStreamOptions)).toBe('events');
      expect(streamManager.getStreamForPattern('commands.user.create', multiStreamOptions)).toBe('commands');
    });

    it('should return default stream for unknown pattern', () => {
      const multiStreamOptions: MultiStreamOptions = {
        streams: [
          { name: 'events', subjects: ['events.*'] },
          { name: 'commands', subjects: ['commands.*'] }
        ],
        defaultStream: 'events'
      };

      expect(streamManager.getStreamForPattern('unknown.pattern', multiStreamOptions)).toBe('events');
    });

    it('should return first stream when no default is specified', () => {
      const multiStreamOptions: MultiStreamOptions = {
        streams: [
          { name: 'events', subjects: ['events.*'] },
          { name: 'commands', subjects: ['commands.*'] }
        ]
      };

      expect(streamManager.getStreamForPattern('unknown.pattern', multiStreamOptions)).toBe('events');
    });

    it('should return default when no streams are configured', () => {
      const multiStreamOptions: MultiStreamOptions = {
        streams: [],
        defaultStream: 'default'
      };

      expect(streamManager.getStreamForPattern('unknown.pattern', multiStreamOptions)).toBe('default');
    });
  });

  describe('getConsumerOptionsForStream', () => {
    it('should return consumer options for known stream', () => {
      const multiStreamOptions: MultiStreamOptions = {
        streams: [
          { name: 'events', subjects: ['events.*'] },
          { name: 'commands', subjects: ['commands.*'] }
        ],
        streamConsumers: new Map([
          ['events', { name: 'events-consumer', durable: true }],
          ['commands', { name: 'commands-consumer', durable: true }]
        ])
      };

      const eventsConsumer = streamManager.getConsumerOptionsForStream('events', multiStreamOptions);
      const commandsConsumer = streamManager.getConsumerOptionsForStream('commands', multiStreamOptions);

      expect(eventsConsumer?.name).toBe('events-consumer');
      expect(commandsConsumer?.name).toBe('commands-consumer');
    });

    it('should return undefined for unknown stream', () => {
      const multiStreamOptions: MultiStreamOptions = {
        streams: [
          { name: 'events', subjects: ['events.*'] }
        ],
        streamConsumers: new Map([
          ['events', { name: 'events-consumer', durable: true }]
        ])
      };

      const unknownConsumer = streamManager.getConsumerOptionsForStream('unknown', multiStreamOptions);
      expect(unknownConsumer).toBeUndefined();
    });

    it('should return undefined when no stream consumers are configured', () => {
      const multiStreamOptions: MultiStreamOptions = {
        streams: [
          { name: 'events', subjects: ['events.*'] }
        ]
      };

      const consumer = streamManager.getConsumerOptionsForStream('events', multiStreamOptions);
      expect(consumer).toBeUndefined();
    });
  });

  describe('registerStreams', () => {
    it('should register streams synchronously when asyncRegistration is false', async () => {
      const multiStreamOptions: MultiStreamOptions = {
        streams: [
          { name: 'stream1', subjects: ['test.1'] },
          { name: 'stream2', subjects: ['test.2'] }
        ],
        asyncRegistration: false
      };

      mockJsm.streams.info.mockRejectedValue(new Error('Stream not found'));
      mockJsm.streams.add.mockResolvedValue({});

      const results = await streamManager.registerStreams(multiStreamOptions);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
      expect(mockJsm.streams.add).toHaveBeenCalledTimes(2);
    });

    it('should register streams asynchronously when asyncRegistration is true', async () => {
      const multiStreamOptions: MultiStreamOptions = {
        streams: [
          { name: 'stream1', subjects: ['test.1'] },
          { name: 'stream2', subjects: ['test.2'] }
        ],
        asyncRegistration: true
      };

      mockJsm.streams.info.mockRejectedValue(new Error('Stream not found'));
      mockJsm.streams.add.mockResolvedValue({});

      const results = await streamManager.registerStreams(multiStreamOptions);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
      expect(mockJsm.streams.add).toHaveBeenCalledTimes(2);
    });

    it('should handle stream registration errors', async () => {
      const multiStreamOptions: MultiStreamOptions = {
        streams: [
          { name: 'stream1', subjects: ['test.1'] },
          { name: 'stream2', subjects: ['test.2'] }
        ],
        asyncRegistration: false
      };

      mockJsm.streams.info.mockRejectedValue(new Error('Stream not found'));
      mockJsm.streams.add
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Failed to create stream'));

      const results = await streamManager.registerStreams(multiStreamOptions);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe('Failed to create stream');
    });
  });
}); 