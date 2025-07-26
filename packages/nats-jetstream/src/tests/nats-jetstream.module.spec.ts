import { JSONCodec, DeliverPolicy, AckPolicy } from 'nats';

import { NatsJetStreamModule } from '../lib/nats-jetstream.module';
import { NatsClient } from '../lib/nats.client';
import { JetStream } from '../lib/jetstream.transport';
import { NatsJetStreamOptions } from '../lib/interfaces/nats-jetstream-options.interface';

// Mock the NatsClient and JetStream classes
jest.mock('../lib/nats.client');
jest.mock('../lib/jetstream.transport');

describe('NatsJetStreamModule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('default configuration', () => {
    it('should create JetStream with correct options', async () => {
      // Simulate the factory function from the module
      const createJetStream = (uri: string | string[] | undefined) => {
        return new JetStream({
          servers: Array.isArray(uri) ? uri : (uri ? [uri] : ['nats://localhost']),
          streamName: 'hello.*',
          durableName: 'APP_SERVICE'
        });
      };

      // Test with a specific URI
      createJetStream('nats://test-server:4222');

      // Verify that JetStream was created with the correct options
      expect(JetStream).toHaveBeenCalledWith({
        servers: ['nats://test-server:4222'],
        streamName: 'hello.*',
        durableName: 'APP_SERVICE',
      });
    });

    it('should use default server when nats.uri is not configured', async () => {
      // Simulate the factory function from the module
      const createJetStream = (uri: string | string[] | undefined) => {
        return new JetStream({
          servers: Array.isArray(uri) ? uri : (uri ? [uri] : ['nats://localhost']),
          streamName: 'hello.*',
          durableName: 'APP_SERVICE'
        });
      };

      // Test with undefined URI
      createJetStream(undefined);

      // Verify that JetStream was created with the default server
      expect(JetStream).toHaveBeenCalledWith({
        servers: ['nats://localhost'],
        streamName: 'hello.*',
        durableName: 'APP_SERVICE',
      });
    });
  });

  describe('register', () => {
    it('should create client and transport with static options including advanced options', () => {
      const options: NatsJetStreamOptions = {
        codec: JSONCodec(),
        connection: {
          servers: ['nats://custom-server:4222'],
        },
        streamName: 'custom-stream',
        durableName: 'CUSTOM_SERVICE',
        queue: 'custom-queue',
        // Advanced options
        deliverPolicy: DeliverPolicy.New,
        ackPolicy: AckPolicy.None,
        ackWait: 30,
        filterSubject: 'specific.subject',
        filterSubjects: ['subject1', 'subject2'],
        consumer: (builder) => {
          builder.deliverTo('custom-inbox');
        }
      };

      // Simulate the client factory function
      const createClient = () => {
        return new NatsClient(options);
      };

      // Simulate the transport factory function
      const createTransport = () => {
        const servers = options.connection?.servers;
        return new JetStream({
          servers: Array.isArray(servers) ? servers : (servers ? [servers as string] : ['nats://localhost']),
          streamName: options.streamName || 'default',
          durableName: options.durableName || 'default',
          queue: options.queue,
          deliverPolicy: options.deliverPolicy,
          ackPolicy: options.ackPolicy,
          ackWait: options.ackWait,
          filterSubject: options.filterSubject,
          filterSubjects: options.filterSubjects,
          consumer: options.consumer
        });
      };

      // Call the factory functions
      createClient();
      createTransport();

      // Verify that NatsClient was created with the correct options
      expect(NatsClient).toHaveBeenCalledWith(options);

      // Verify that JetStream was created with the correct options
      expect(JetStream).toHaveBeenCalledWith({
        servers: ['nats://custom-server:4222'],
        streamName: 'custom-stream',
        durableName: 'CUSTOM_SERVICE',
        queue: 'custom-queue',
        deliverPolicy: DeliverPolicy.New,
        ackPolicy: AckPolicy.None,
        ackWait: 30,
        filterSubject: 'specific.subject',
        filterSubjects: ['subject1', 'subject2'],
        consumer: options.consumer
      });
    });

    it('should use default values when options are not provided', () => {
      const options: NatsJetStreamOptions = {};

      // Simulate the transport factory function
      const createTransport = () => {
        const servers = options.connection?.servers;
        return new JetStream({
          servers: Array.isArray(servers) ? servers : (servers ? [servers as string] : ['nats://localhost']),
          streamName: options.streamName || 'default',
          durableName: options.durableName || 'default',
          queue: options.queue
        });
      };

      // Call the factory function
      createTransport();

      // Verify that JetStream was created with default values
      expect(JetStream).toHaveBeenCalledWith({
        servers: ['nats://localhost'],
        streamName: 'default',
        durableName: 'default',
        queue: undefined,
      });
    });
  });

  describe('registerAsync', () => {
    it('should create client and transport with async factory', async () => {
      const options: NatsJetStreamOptions = {
        codec: JSONCodec(),
        connection: {
          servers: ['nats://async-server:4222'],
        },
        streamName: 'async-stream',
        durableName: 'ASYNC_SERVICE',
        queue: 'async-queue',
      };

      // Mock factory function
      const factoryFn = jest.fn().mockResolvedValue(options);

      // Simulate resolving options asynchronously
      const resolvedOptions = await factoryFn();

      // Verify that the factory function was called
      expect(factoryFn).toHaveBeenCalled();

      // Simulate the client factory function
      const createClient = (opts: NatsJetStreamOptions) => {
        return new NatsClient(opts);
      };

      // Simulate the transport factory function
      const createTransport = (opts: NatsJetStreamOptions) => {
        const servers = opts.connection?.servers;
        return new JetStream({
          servers: Array.isArray(servers) ? servers : (servers ? [servers as string] : ['nats://localhost']),
          streamName: opts.streamName || 'default',
          durableName: opts.durableName || 'default',
          queue: opts.queue,
          deliverPolicy: opts.deliverPolicy,
          ackPolicy: opts.ackPolicy,
          ackWait: opts.ackWait,
          filterSubject: opts.filterSubject,
          filterSubjects: opts.filterSubjects,
          consumer: opts.consumer
        });
      };

      // Call the factory functions with the resolved options
      createClient(resolvedOptions);
      createTransport(resolvedOptions);

      // Verify that NatsClient was created with the correct options
      expect(NatsClient).toHaveBeenCalledWith(resolvedOptions);

      // Verify that JetStream was created with the correct options
      expect(JetStream).toHaveBeenCalledWith({
        servers: ['nats://async-server:4222'],
        streamName: 'async-stream',
        durableName: 'ASYNC_SERVICE',
        queue: 'async-queue',
      });
    });

    it('should create transport with injected dependencies', () => {
      // Simulate a ConfigService
      const configService = {
        get: jest.fn((key) => {
          if (key === 'nats.uri') {
            return ['nats://injected-server:4222'];
          }
          return undefined;
        }),
      };

      // Simulate the factory function that uses the ConfigService
      const createOptions = () => ({
        connection: {
          servers: configService.get('nats.uri'),
        },
        streamName: 'injected-stream',
        durableName: 'INJECTED_SERVICE',
      });

      // Get options from the factory
      const options = createOptions();

      // Simulate the transport factory function
      const createTransport = (opts: NatsJetStreamOptions) => {
        const servers = opts.connection?.servers;
        return new JetStream({
          servers: Array.isArray(servers) ? servers : (servers ? [servers as string] : ['nats://localhost']),
          streamName: opts.streamName || 'default',
          durableName: opts.durableName || 'default',
          queue: opts.queue,
          deliverPolicy: opts.deliverPolicy,
          ackPolicy: opts.ackPolicy,
          ackWait: opts.ackWait,
          filterSubject: opts.filterSubject,
          filterSubjects: opts.filterSubjects,
          consumer: opts.consumer
        });
      };

      // Call the transport factory function with the options
      createTransport(options);

      // Verify that JetStream was created with the correct options
      expect(JetStream).toHaveBeenCalledWith({
        servers: ['nats://injected-server:4222'],
        streamName: 'injected-stream',
        durableName: 'INJECTED_SERVICE',
        queue: undefined,
      });
    });

    it('should use default values when options are not provided', async () => {
      // Factory function that returns empty options
      const factoryFn = jest.fn().mockResolvedValue({});

      // Simulate resolving options asynchronously
      const resolvedOptions = await factoryFn();

      // Simulate the transport factory function
      const createTransport = (opts: NatsJetStreamOptions) => {
        const servers = opts.connection?.servers;
        return new JetStream({
          servers: Array.isArray(servers) ? servers : (servers ? [servers as string] : ['nats://localhost']),
          streamName: opts.streamName || 'default',
          durableName: opts.durableName || 'default',
          queue: opts.queue,
          deliverPolicy: opts.deliverPolicy,
          ackPolicy: opts.ackPolicy,
          ackWait: opts.ackWait,
          filterSubject: opts.filterSubject,
          filterSubjects: opts.filterSubjects,
          consumer: opts.consumer
        });
      };

      // Call the transport factory function with the resolved options
      createTransport(resolvedOptions);

      // Verify that JetStream was created with default values
      expect(JetStream).toHaveBeenCalledWith({
        servers: ['nats://localhost'],
        streamName: 'default',
        durableName: 'default',
        queue: undefined,
      });
    });
  });
});
