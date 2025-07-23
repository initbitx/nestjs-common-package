import { Codec, ConsumerOptsBuilder, JetStreamClient, JetStreamManager, JsMsg, JSONCodec, Msg, NatsConnection, StringCodec } from 'nats';

import { NatsContext } from '../lib/nats.context';

import { JetStream } from '../lib/jetstream.transport';
import { NACK, TERM } from '../lib/nats.constants';
import { createMock } from '@golevelup/ts-jest';

describe('NatsTransportStrategy', () => {
  let strategy: JetStream;

  beforeEach(() => {
    strategy = new JetStream({
      servers: 'nats://localhost:4222',
      streamName: 'test-stream',
      durableName: 'test-consumer'
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

  // These tests were removed because the methods are not part of the public API

  describe('handleJetStreamMessage', () => {
    let strategy: JetStream;

    beforeAll(() => {
      strategy = new JetStream({
        servers: 'nats://localhost:4222',
        streamName: 'test-stream',
        durableName: 'test-consumer'
      });
      // Set the codec property directly for testing
      (strategy as any).codec = StringCodec();
    });

    it('should ack', async () => {
      const message = createMock<JsMsg>({
        data: new Uint8Array([ 104, 101, 108, 108, 111 ])
      });

      const handler = jest.fn().mockResolvedValue(undefined);

      await strategy.handleJetStreamMessage(message, handler);

      expect(handler).toBeCalledTimes(1);
      // Only check the first argument, as the second is a NatsContext instance
      expect(handler.mock.calls[0][0]).toBe('hello');
      // Verify the second argument is a NatsContext instance
      expect(handler.mock.calls[0][1]).toBeInstanceOf(NatsContext);

      expect(message.ack).toBeCalledTimes(1);
      expect(message.nak).not.toBeCalled();
      expect(message.term).not.toBeCalled();
      expect(message.working).toBeCalledTimes(1);
    });

    it('should nack', async () => {
      const message = createMock<JsMsg>({
        data: new Uint8Array([ 104, 101, 108, 108, 111 ])
      });

      const handler = jest.fn().mockRejectedValue(NACK);

      await strategy.handleJetStreamMessage(message, handler);

      expect(handler).toBeCalledTimes(1);
      // Only check the first argument, as the second is a NatsContext instance
      expect(handler.mock.calls[0][0]).toBe('hello');
      // Verify the second argument is a NatsContext instance
      expect(handler.mock.calls[0][1]).toBeInstanceOf(NatsContext);

      expect(message.ack).not.toBeCalled();
      expect(message.nak).toBeCalledTimes(1);
      expect(message.term).not.toBeCalled();
      expect(message.working).toBeCalledTimes(1);
    });

    it('should term', async () => {
      const message = createMock<JsMsg>({
        data: new Uint8Array([ 104, 101, 108, 108, 111 ])
      });

      const handler = jest.fn().mockRejectedValue(TERM);

      await strategy.handleJetStreamMessage(message, handler);

      expect(handler).toBeCalledTimes(1);
      // Only check the first argument, as the second is a NatsContext instance
      expect(handler.mock.calls[0][0]).toBe('hello');
      // Verify the second argument is a NatsContext instance
      expect(handler.mock.calls[0][1]).toBeInstanceOf(NatsContext);

      expect(message.ack).not.toBeCalled();
      expect(message.nak).not.toBeCalled();
      expect(message.term).toBeCalledTimes(1);
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

      const defaultConsumerOptions = expect.objectContaining({
        config: expect.objectContaining({
          deliver_subject: expect.stringMatching(/^_INBOX\./)
        }),
        mack: true
      });

      expect(client.subscribe).toBeCalledTimes(2);
      expect(client.subscribe).toBeCalledWith('my.first.event', defaultConsumerOptions);
      expect(client.subscribe).toBeCalledWith('my.second.event', defaultConsumerOptions);
      expect(client.subscribe).not.toBeCalledWith('my.first.message');
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
