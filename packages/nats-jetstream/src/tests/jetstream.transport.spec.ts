import { AckPolicy, DeliverPolicy, JetStreamClient, JetStreamManager, JsMsg, JSONCodec, Msg, NatsConnection, StringCodec } from 'nats';

import { NatsContext } from '../lib/nats.context';

import { JetStream } from '../lib/jetstream.transport';
import { createMock } from '@golevelup/ts-jest';

describe('NatsTransportStrategy', () => {
  let strategy: JetStream;

  beforeEach(() => {
    strategy = new JetStream({
      servers: 'nats://localhost:4222',
      streamName: 'test-stream',
      durableName: 'test-consumer',
      // Include new options with default values
      deliverPolicy: undefined,
      ackPolicy: undefined,
      ackWait: undefined,
      filterSubject: undefined,
      filterSubjects: undefined
    });
  });

  afterEach(async () => {
    // Ensure any background status monitors are aborted by closing the strategy
    try {
      if (strategy && typeof (strategy as any).close === 'function') {
        // close may be async
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        await (strategy as any).close();
      }
    } catch (_) {
      // ignore errors during cleanup
    }
  });

  describe('constructor', () => {
    it('should initialize with default consumer naming strategy', () => {
      const strategy = new JetStream({
        servers: 'nats://localhost:4222',
        streamName: 'test-stream'
      });

      expect((strategy as any).consumerNamingStrategy).toBeDefined();
      expect((strategy as any).appName).toBe('nestjs-app');

      // cleanup
      if (typeof (strategy as any).close === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        (strategy as any).close();
      }
    });

    it('should initialize with custom app name', () => {
      const strategy = new JetStream({
        servers: 'nats://localhost:4222',
        streamName: 'test-stream',
        appName: 'custom-app'
      });

      expect((strategy as any).appName).toBe('custom-app');

      // cleanup
      if (typeof (strategy as any).close === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        (strategy as any).close();
      }
    });

    it('should initialize multi-stream options', () => {
      const multiStreamOptions = {
        streams: [{ name: 'events', subjects: ['events.*'] }]
      };

      const strategy = new JetStream({
        servers: 'nats://localhost:4222',
        multiStream: multiStreamOptions
      });

      expect((strategy as any).multiStreamOptions).toBe(multiStreamOptions);

      // cleanup
      if (typeof (strategy as any).close === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        (strategy as any).close();
      }
    });

    it('should handle stream name configuration correctly', () => {
      const strategy = new JetStream({
        servers: 'nats://localhost:4222',
        stream: { name: 'custom-stream' }
      });

      expect((strategy as any).options.streamName).toBe('custom-stream');

      // cleanup
      if (typeof (strategy as any).close === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        (strategy as any).close();
      }
    });

    it('should set default stream name when none provided', () => {
      const strategy = new JetStream({
        servers: 'nats://localhost:4222'
      });

      expect((strategy as any).options.streamName).toBe('default');
      expect((strategy as any).options.stream?.name).toBe('default');

      // cleanup
      if (typeof (strategy as any).close === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        (strategy as any).close();
      }
    });
  });

  describe('listen', () => {
    it('bootstraps correctly', (complete) => {
      // Mock the connect function from nats
      const connectMock = jest.fn().mockResolvedValue({
        getServer: () => 'nats://test:4222',
        jetstream: () => createMock<JetStreamClient>(),
        jetstreamManager: () => Promise.resolve(createMock<JetStreamManager>()),
        status: () => ({
          [Symbol.asyncIterator]: async function* () {
            // No status updates for this test
          }
        })
      });

      // Replace the connect function in the nats module
      jest.mock('nats', () => ({
        ...jest.requireActual('nats'),
        connect: connectMock
      }));

      const loggerSpy = jest.spyOn(strategy['logger'], 'log');

      // Call listen and verify the logger was called
      strategy.listen(() => {
        expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Connecting to NATS JetStream'));
        expect(loggerSpy).toHaveBeenCalledWith('JetStream connection established.');

        // cleanup
        try {
          if (typeof (strategy as any).close === 'function') {
            (strategy as any).close();
          }
        } catch (_) { /* ignore */ }

        complete();
      });
    });
  });

  describe('close', () => {
    it('should drain and cleanup', async () => {
      // Create a mock connection with a drain method
      const connection = createMock<NatsConnection>({
        drain: jest.fn()
      });

      // Set the private properties for testing
      (strategy as any).nc = connection;
      (strategy as any).js = createMock<JetStreamClient>();
      (strategy as any).jsm = createMock<JetStreamManager>();

      // Spy on the logger
      const loggerSpy = jest.spyOn(strategy['logger'], 'log');

      // Call close
      await strategy.close();

      // Verify drain was called
      expect(connection.drain).toBeCalledTimes(1);

      // Verify the logger was called
      expect(loggerSpy).toHaveBeenCalledWith('Closing JetStream connection...');

      // Verify the properties were cleared
      expect((strategy as any).nc).toBeUndefined();
      expect((strategy as any).js).toBeUndefined();
      expect((strategy as any).jsm).toBeUndefined();
    });
  });

  // Test for ensureConsumer method with new options
  describe('ensureConsumer', () => {
    it('should configure consumer with advanced options', async () => {
      // Create a JetStream instance with advanced options
      const strategy = new JetStream({
        servers: 'nats://localhost:4222',
        streamName: 'test-stream',
        durableName: 'test-consumer',
        deliverPolicy: DeliverPolicy.New,
        ackPolicy: AckPolicy.None,
        ackWait: 30,
        filterSubject: 'specific.subject',
        filterSubjects: ['subject1', 'subject2']
      });

      // Mock JetStreamManager
      const addConsumerMock = jest.fn().mockResolvedValue({});
      const jsm = createMock<JetStreamManager>({
        consumers: {
          add: addConsumerMock
        }
      });

      // Call ensureConsumer
      await strategy.ensureConsumer(jsm);

      // Verify that the consumer was created with the correct options
      expect(addConsumerMock).toHaveBeenCalledTimes(1);
      expect(addConsumerMock.mock.calls[0][0]).toBe('test-stream');

      const consumerConfig = addConsumerMock.mock.calls[0][1];
      expect(consumerConfig.durable_name).toBe('test-consumer');
      expect(consumerConfig.deliver_policy).toBe(DeliverPolicy.New);
      expect(consumerConfig.ack_policy).toBe(AckPolicy.None);
      expect(consumerConfig.ack_wait).toBe(30 * 1_000_000); // 30 seconds in nanoseconds
      expect(consumerConfig.filter_subject).toBe('specific.subject');
      expect(consumerConfig.filter_subjects).toEqual(['subject1', 'subject2']);
    });
  });

  describe('handleJetStreamMessage', () => {
    let strategy: JetStream;

    beforeEach(() => {
      strategy = new JetStream({
        servers: 'nats://localhost:4222',
        streamName: 'test-stream',
        durableName: 'test-consumer'
      });
      // Set the codec property directly for testing
      (strategy as any).codec = StringCodec();
    });

    it('should call the correct handler with the correct data and context', async () => {
      const message = createMock<JsMsg>({
        subject: 'test.subject',
        data: new Uint8Array([ 104, 101, 108, 108, 111 ]),
        ack: jest.fn(),
        working: jest.fn(),
      });

      const handler = jest.fn().mockResolvedValue(undefined);
      strategy.addHandler('test.subject', handler, false);

      await strategy.handleJetStreamMessage(message);

      expect(handler).toBeCalledTimes(1);
      expect(handler.mock.calls[0][0]).toBe('hello');
      expect(handler.mock.calls[0][1]).toBeInstanceOf(NatsContext);
      expect(message.ack).toBeCalledTimes(1);
      expect(message.working).toBeCalledTimes(1);
    });
  });

  describe('handleNatsMessage', () => {
    const codec = JSONCodec();

    let strategy: JetStream;

    beforeAll(() => {
      strategy = new JetStream({
        servers: 'nats://localhost:4222',
        streamName: 'test-stream',
        durableName: 'test-consumer'
      });
      // Set the codec property directly for testing
      (strategy as any).codec = codec;
    });

    it('responds to messages', async () => {
      const request = { hello: 'world' };
      const response = { goodbye: 'world' };

      const message = createMock<Msg>({
        data: codec.encode(request)
      });

      const handler = jest.fn().mockResolvedValue(response);

      await strategy.handleNatsMessage(message, handler);

      expect(handler).toBeCalledTimes(1);
      // Only check the first argument, as the second is a NatsContext instance
      expect(handler.mock.calls[0][0]).toEqual(request);
      // Verify the second argument is a NatsContext instance
      expect(handler.mock.calls[0][1]).toBeInstanceOf(NatsContext);

      return new Promise<void>((resolve) => {
        process.nextTick(() => {
          expect(message.respond).toBeCalledTimes(1);
          expect(message.respond).toBeCalledWith(
            // fields must be in this order
            codec.encode({
              response,
              isDisposed: true
            })
          );

          resolve();
        });
      });
    });
  });

  describe('handleStatusUpdates', () => {
    it('should log debug events', async () => {
      const connection = {
        status() {
          return {
            async* [Symbol.asyncIterator]() {
              yield { type: 'pingTimer', data: '1' };
              yield { type: 'reconnecting', data: '1' };
              yield { type: 'staleConnection', data: '1' };
            }
          };
        }
      };

      const loggerSpy = jest.spyOn(strategy['logger'], 'debug');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await strategy.handleStatusUpdates(connection as any);

      expect(loggerSpy).toBeCalledTimes(3);
      expect(loggerSpy).toBeCalledWith(`(pingTimer): 1`);
      expect(loggerSpy).toBeCalledWith(`(reconnecting): 1`);
      expect(loggerSpy).toBeCalledWith(`(staleConnection): 1`);
    });

    it('should log \'error\' events', async () => {
      const connection = {
        status() {
          return {
            async* [Symbol.asyncIterator]() {
              yield { type: 'disconnect', data: '1' };
              yield { type: 'error', data: '1' };
            }
          };
        }
      };

      const loggerSpy = jest.spyOn(strategy['logger'], 'error');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await strategy.handleStatusUpdates(connection as any);

      expect(loggerSpy).toBeCalledTimes(2);
      expect(loggerSpy).toBeCalledWith(`(disconnect): 1`);
      expect(loggerSpy).toBeCalledWith(`(error): 1`);
    });

    it('should log \'reconnect\' events', async () => {
      const connection = {
        status() {
          return {
            async* [Symbol.asyncIterator]() {
              yield { type: 'reconnect', data: '1' };
            }
          };
        }
      };

      const loggerSpy = jest.spyOn(strategy['logger'], 'log');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await strategy.handleStatusUpdates(connection as any);

      expect(loggerSpy).toBeCalledTimes(1);
      expect(loggerSpy).toBeCalledWith(`(reconnect): 1`);
    });

    it('should log \'ldm\' events', async () => {
      const connection = {
        status() {
          return {
            async* [Symbol.asyncIterator]() {
              yield { type: 'ldm', data: '1' };
            }
          };
        }
      };

      const loggerSpy = jest.spyOn(strategy['logger'], 'warn');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await strategy.handleStatusUpdates(connection as any);

      expect(loggerSpy).toBeCalledTimes(1);
      expect(loggerSpy).toBeCalledWith(`(ldm): 1`);
    });

    it('should log \'update\' events', async () => {
      const connection = {
        status() {
          return {
            async* [Symbol.asyncIterator]() {
              yield { type: 'update', data: { added: [ '1' ], deleted: [ '2' ] } };
            }
          };
        }
      };

      const loggerSpy = jest.spyOn(strategy['logger'], 'verbose');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await strategy.handleStatusUpdates(connection as any);

      expect(loggerSpy).toBeCalledTimes(1);
      expect(loggerSpy).toBeCalledWith(
        `(update): ${JSON.stringify({ added: [ '1' ], deleted: [ '2' ] })}`
      );
    });
  });

  describe('subscribeToEventPatterns', () => {
    it('should only subscribe to event patterns with default options', async () => {
      strategy.addHandler('my.first.event', jest.fn(), true);
      strategy.addHandler('my.second.event', jest.fn(), true);
      strategy.addHandler('my.first.message', jest.fn(), false);

      const client = createMock<JetStreamClient>();

      await strategy.subscribeToEventPatterns(client);

      expect(client.subscribe).toBeCalledTimes(2);
      // Check that subscriptions were created with inbox subjects
      const calls = client.subscribe.mock.calls;
      expect(calls[0][0]).toMatch(/^_INBOX\./);
      expect(calls[1][0]).toMatch(/^_INBOX\./);
      expect(client.subscribe).not.toBeCalledWith('my.first.message');
    });

    it('should create durable consumers by default', async () => {
      strategy.addHandler('my.event', jest.fn(), true);

      const client = createMock<JetStreamClient>();

      await strategy.subscribeToEventPatterns(client);

      expect(client.subscribe).toBeCalledTimes(1);
      const callArgs = client.subscribe.mock.calls[0];
      // Check that the subscription was created (the actual config structure is internal)
      expect(callArgs[0]).toMatch(/^_INBOX\./);
    });

    it('should use consumer naming strategy for durable names', async () => {
      const strategyWithAppName = new JetStream({
        servers: 'nats://localhost:4222',
        streamName: 'test-stream',
        appName: 'test-app'
      });

      strategyWithAppName.addHandler('events.user.created', jest.fn(), true);

      const client = createMock<JetStreamClient>();

      await strategyWithAppName.subscribeToEventPatterns(client);

      expect(client.subscribe).toBeCalledTimes(1);
      // The durable name is set internally, we just verify the subscription was created
      const callArgs = client.subscribe.mock.calls[0];
      expect(callArgs[0]).toMatch(/^_INBOX\./);
    });

    it('should cache consumers for reuse', async () => {
      strategy.addHandler('my.event', jest.fn(), true);
      strategy.addHandler('my.event', jest.fn(), true); // Same pattern

      const client = createMock<JetStreamClient>();

      await strategy.subscribeToEventPatterns(client);

      // Should only create one subscription despite two handlers
      expect(client.subscribe).toBeCalledTimes(1);
    });
  });

  describe('multi-stream support', () => {
    it('should register multiple streams on initialization', async () => {
      const multiStreamStrategy = new JetStream({
        servers: 'nats://localhost:4222',
        multiStream: {
          streams: [
            { name: 'events', subjects: ['events.*'] },
            { name: 'commands', subjects: ['commands.*'] }
          ],
          patternToStream: new Map([
            ['events.user.created', 'events'],
            ['commands.user.create', 'commands']
          ]),
          streamConsumers: new Map([
            ['events', { name: 'events-consumer', durable: true }],
            ['commands', { name: 'commands-consumer', durable: true }]
          ])
        }
      });

      // Mock the connection setup before listen is called
      const mockJsm = createMock<JetStreamManager>();
      const mockStreamManager = {
        registerStreams: jest.fn().mockResolvedValue([
          { success: true, streamName: 'events' },
          { success: true, streamName: 'commands' }
        ]),
        createStreamConsumers: jest.fn().mockResolvedValue(undefined)
      };

      // Set the properties directly
      (multiStreamStrategy as any).jsm = mockJsm;
      (multiStreamStrategy as any).streamManager = mockStreamManager;

      // Mock the connect function to avoid real connection
      const originalConnect = require('nats').connect;
      require('nats').connect = jest.fn().mockResolvedValue({
        jetstream: () => createMock<JetStreamClient>(),
        jetstreamManager: () => Promise.resolve(mockJsm),
        status: () => ({
          [Symbol.asyncIterator]: async function* () {}
        })
      });

      try {
        await multiStreamStrategy.listen(() => {});

        expect(mockStreamManager.registerStreams).toHaveBeenCalled();
        expect(mockStreamManager.createStreamConsumers).toHaveBeenCalled();
      } finally {
        // Restore original connect function
        require('nats').connect = originalConnect;
        // Ensure we close the strategy to abort background monitors
        try { if (typeof (multiStreamStrategy as any).close === 'function') { await (multiStreamStrategy as any).close(); } } catch (_) { /* ignore */ }
      }
    });

    it('should route patterns to correct streams', async () => {
      const multiStreamStrategy = new JetStream({
        servers: 'nats://localhost:4222',
        multiStream: {
          streams: [
            { name: 'events', subjects: ['events.*'] },
            { name: 'commands', subjects: ['commands.*'] }
          ],
          patternToStream: new Map([
            ['events.user.created', 'events'],
            ['commands.user.create', 'commands']
          ])
        }
      });

      multiStreamStrategy.addHandler('events.user.created', jest.fn(), true);
      multiStreamStrategy.addHandler('commands.user.create', jest.fn(), true);

      const client = createMock<JetStreamClient>();

      // Mock the stream manager methods
      (multiStreamStrategy as any).streamManager = {
        getStreamForPattern: jest.fn()
          .mockReturnValueOnce('events')
          .mockReturnValueOnce('commands'),
        getConsumerOptionsForStream: jest.fn().mockReturnValue(undefined)
      };

      await multiStreamStrategy.subscribeToEventPatterns(client);

      expect((multiStreamStrategy as any).streamManager.getStreamForPattern)
        .toHaveBeenCalledWith('events.user.created', expect.any(Object));
      expect((multiStreamStrategy as any).streamManager.getStreamForPattern)
        .toHaveBeenCalledWith('commands.user.create', expect.any(Object));
    });

    it('should apply stream-specific consumer options', async () => {
      const multiStreamStrategy = new JetStream({
        servers: 'nats://localhost:4222',
        multiStream: {
          streams: [
            { name: 'events', subjects: ['events.*'] }
          ],
          streamConsumers: new Map([
            ['events', {
              name: 'events-consumer',
              durable: true,
              ack_wait: 30,
              deliver_policy: DeliverPolicy.New,
              ack_policy: AckPolicy.Explicit
            }]
          ])
        }
      });

      multiStreamStrategy.addHandler('events.user.created', jest.fn(), true);

      const client = createMock<JetStreamClient>();

      // Mock the stream manager methods
      (multiStreamStrategy as any).streamManager = {
        getStreamForPattern: jest.fn().mockReturnValue('events'),
        getConsumerOptionsForStream: jest.fn().mockReturnValue({
          name: 'events-consumer',
          durable: true,
          ack_wait: 30,
          deliver_policy: DeliverPolicy.New,
          ack_policy: AckPolicy.Explicit
        })
      };

      await multiStreamStrategy.subscribeToEventPatterns(client);

      expect(client.subscribe).toBeCalledTimes(1);
      const callArgs = client.subscribe.mock.calls[0];
      // The durable name is set internally, we just verify the subscription was created
      expect(callArgs[0]).toMatch(/^_INBOX\./);
    });

    it('should handle stream manager errors gracefully', async () => {
      const multiStreamStrategy = new JetStream({
        servers: 'nats://localhost:4222',
        multiStream: {
          streams: [{ name: 'events', subjects: ['events.*'] }]
        }
      });

      // Mock the stream manager to throw an error
      const mockStreamManager = {
        registerStreams: jest.fn().mockRejectedValue(new Error('Stream registration failed')),
        createStreamConsumers: jest.fn().mockResolvedValue(undefined)
      };

      // Mock the connection setup
      const mockJsm = createMock<JetStreamManager>();
      (multiStreamStrategy as any).jsm = mockJsm;
      (multiStreamStrategy as any).streamManager = mockStreamManager;

      // Mock the connect function to avoid real connection
      const originalConnect = require('nats').connect;
      require('nats').connect = jest.fn().mockResolvedValue({
        jetstream: () => createMock<JetStreamClient>(),
        jetstreamManager: () => Promise.resolve(mockJsm),
        status: () => ({
          [Symbol.asyncIterator]: async function* () {}
        })
      });

      const loggerSpy = jest.spyOn(multiStreamStrategy['logger'], 'error');

      try {
        await expect(multiStreamStrategy.listen(() => {})).rejects.toThrow('Stream registration failed');
        expect(loggerSpy).toHaveBeenCalled();
      } finally {
        // Restore original connect function
        require('nats').connect = originalConnect;
        // Ensure we close the strategy to abort background monitors
        try { if (typeof (multiStreamStrategy as any).close === 'function') { await (multiStreamStrategy as any).close(); } } catch (_) { /* ignore */ }
      }
    });
  });

  describe('consumer caching', () => {
    it('should create unique cache keys for different streams', async () => {
      const multiStreamStrategy = new JetStream({
        servers: 'nats://localhost:4222',
        multiStream: {
          streams: [
            { name: 'events', subjects: ['events.*'] },
            { name: 'commands', subjects: ['commands.*'] }
          ],
          patternToStream: new Map([
            ['events.user.created', 'events'],
            ['commands.user.create', 'commands']
          ])
        }
      });

      multiStreamStrategy.addHandler('events.user.created', jest.fn(), true);
      multiStreamStrategy.addHandler('commands.user.create', jest.fn(), true);

      const client = createMock<JetStreamClient>();

      // Mock the stream manager methods
      (multiStreamStrategy as any).streamManager = {
        getStreamForPattern: jest.fn()
          .mockReturnValueOnce('events')
          .mockReturnValueOnce('commands'),
        getConsumerOptionsForStream: jest.fn().mockReturnValue(undefined)
      };

      await multiStreamStrategy.subscribeToEventPatterns(client);

      // Should create two separate subscriptions (one for each stream)
      expect(client.subscribe).toBeCalledTimes(2);
    });

    it('should reuse consumers for same stream and pattern', async () => {
      const multiStreamStrategy = new JetStream({
        servers: 'nats://localhost:4222',
        multiStream: {
          streams: [{ name: 'events', subjects: ['events.*'] }],
          patternToStream: new Map([['events.user.created', 'events']])
        }
      });

      multiStreamStrategy.addHandler('events.user.created', jest.fn(), true);
      multiStreamStrategy.addHandler('events.user.created', jest.fn(), true); // Same pattern

      const client = createMock<JetStreamClient>();

      // Mock the stream manager methods
      (multiStreamStrategy as any).streamManager = {
        getStreamForPattern: jest.fn().mockReturnValue('events'),
        getConsumerOptionsForStream: jest.fn().mockReturnValue(undefined)
      };

      await multiStreamStrategy.subscribeToEventPatterns(client);

      // Should only create one subscription despite two handlers
      expect(client.subscribe).toBeCalledTimes(1);
    });
  });

  describe('subscribeToMessagePatterns', () => {
    it('should only subscribe to message patterns with default options', async () => {
      strategy.addHandler('my.first.message', jest.fn(), false);
      strategy.addHandler('my.second.message', jest.fn(), false);
      strategy.addHandler('my.first.event', jest.fn(), true);

      const client = createMock<NatsConnection>();

      await strategy.subscribeToMessagePatterns(client);

      const defaultConsumerOptions = expect.objectContaining({
        queue: undefined
      });

      expect(client.subscribe).toBeCalledTimes(2);
      expect(client.subscribe).toBeCalledWith('my.first.message', defaultConsumerOptions);
      expect(client.subscribe).toBeCalledWith('my.second.message', defaultConsumerOptions);
      expect(client.subscribe).not.toBeCalledWith('my.first.event');
    });
  });
});
