import { DynamicModule, Module, Logger, LoggerService } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';
import { APP_LOGGER } from './nats.constants';
import { AckPolicy, DeliverPolicy } from 'nats';

import { NatsClient } from './nats.client';
import { JetStream } from './jetstream.transport';
import { JETSTREAM_OPTIONS, JETSTREAM_CLIENT, JETSTREAM_TRANSPORT } from './nats.constants';
import { NatsJetStreamOptions } from './interfaces/nats-jetstream-options.interface';
import { ConsumerHealthService } from './consumer-health.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: JETSTREAM_CLIENT,
        imports: [ ConfigModule ],
        inject: [ ConfigService ],
        useFactory: async (config: ConfigService) => ({
          customClass: NatsClient,
          options: {
            connection: {
              servers: config.get<string | string[]>('nats.uri') || 'nats://localhost'
            }
          }
        })
      }
    ])
  ],
  exports: [ JETSTREAM_TRANSPORT, JETSTREAM_CLIENT ]
})

export class NatsJetStreamModule {
  /**
   * Register the NatsJetStream module with static options
   * @param options Configuration options for the JetStream transport
   */
  static register(options: NatsJetStreamOptions): DynamicModule {
    const loggerProvider = {
      provide: APP_LOGGER,
      useFactory: () => {
        return options.logger || new Logger('NatsJetStream');
      }
    };

    const clientProvider = {
      provide: JETSTREAM_CLIENT,
      inject: [APP_LOGGER],
      useFactory: (logger: LoggerService) => {
        return new NatsClient({
          ...options,
          logger
        });
      }
    };

    const transportProvider = {
      provide: JETSTREAM_TRANSPORT,
      inject: [APP_LOGGER],
      useFactory: (logger: LoggerService) => {
        const servers = options.connection?.servers || 'nats://localhost';

        // Prepare stream options
        let streamOpts = options.stream || {};
        if (options.streamName) {
          // If streamName is provided at top level, ensure it's also in stream.name
          streamOpts = { ...streamOpts, name: options.streamName };
        }

        // Prepare consumer options
        let consumerOpts = options.consumerOptions || {};
        if (options.durableName) {
          // If durableName is provided at top level, ensure it's also in consumerOptions.name
          consumerOpts = { ...consumerOpts, name: options.durableName };
        }

        return new JetStream({
          servers: servers,
          // Keep these for backward compatibility
          streamName: options.streamName,
          durableName: options.durableName,
          queue: options.queue,
          deliverPolicy: options.deliverPolicy,
          ackPolicy: options.ackPolicy,
          ackWait: options.ackWait,
          filterSubject: options.filterSubject,
          filterSubjects: options.filterSubjects,
          consumer: options.consumer,
          // Updated options
          stream: streamOpts,
          consumerOptions: consumerOpts,
          // Pass through multiStream configuration when provided
          multiStream: options.multiStream,
          logger
        });
      }
    };

    const healthServiceProvider = {
      provide: ConsumerHealthService,
      inject: [JETSTREAM_TRANSPORT],
      useFactory: async (transport: JetStream) => {
        // Initialize the transport to ensure JetStreamManager is available
        await transport.initialize();

        // Create the health service using the JetStreamManager from the transport
        const manager = transport.getManager?.();
        if (!manager) {
          throw new Error('JetStreamManager is not initialized');
        }
        return new ConsumerHealthService(manager, options.consumerHealth);
      }
    };

    return {
      module: NatsJetStreamModule,
      providers: [
        {
          provide: JETSTREAM_OPTIONS,
          useValue: options
        },
        loggerProvider,
        clientProvider,
        transportProvider,
        healthServiceProvider
      ],
      exports: [JETSTREAM_OPTIONS, JETSTREAM_CLIENT, JETSTREAM_TRANSPORT, APP_LOGGER, ConsumerHealthService]
    };
  }

  /**
   * Register the NatsJetStream module with async options
   * @param options Async configuration options for the JetStream transport
   */
  static registerAsync(options: {
    imports?: any[];
    useFactory: (...args: any[]) => Promise<NatsJetStreamOptions> | NatsJetStreamOptions;
    inject?: any[];
  }): DynamicModule {
    const loggerProvider = {
      provide: APP_LOGGER,
      inject: [JETSTREAM_OPTIONS],
      useFactory: (options: NatsJetStreamOptions) => {
        return options.logger || new Logger('NatsJetStream');
      }
    };

    const clientProvider = {
      provide: JETSTREAM_CLIENT,
      inject: [JETSTREAM_OPTIONS, APP_LOGGER],
      useFactory: (options: NatsJetStreamOptions, logger: LoggerService) => {
        return new NatsClient({
          ...options,
          logger
        });
      }
    };

    const transportProvider = {
      provide: JETSTREAM_TRANSPORT,
      inject: [JETSTREAM_OPTIONS, APP_LOGGER],
      useFactory: (options: NatsJetStreamOptions, logger: LoggerService) => {
        const servers = options.connection?.servers || 'nats://localhost';

        // Prepare stream options
        let streamOpts = options.stream || {};
        if (options.streamName) {
          // If streamName is provided at top level, ensure it's also in stream.name
          streamOpts = { ...streamOpts, name: options.streamName };
        }

        // Prepare consumer options
        let consumerOpts = options.consumerOptions || {};
        if (options.durableName) {
          // If durableName is provided at top level, ensure it's also in consumerOptions.name
          consumerOpts = { ...consumerOpts, name: options.durableName };
        }

        return new JetStream({
          servers: servers,
          // Keep these for backward compatibility
          streamName: options.streamName,
          durableName: options.durableName,
          queue: options.queue,
          deliverPolicy: options.deliverPolicy,
          ackPolicy: options.ackPolicy,
          ackWait: options.ackWait,
          filterSubject: options.filterSubject,
          filterSubjects: options.filterSubjects,
          consumer: options.consumer,
          // Updated options
          stream: streamOpts,
          consumerOptions: consumerOpts,
          // Pass through multiStream configuration when provided
          multiStream: options.multiStream,
          logger
        });
      }
    };

    const healthServiceProvider = {
      provide: ConsumerHealthService,
      inject: [JETSTREAM_TRANSPORT, JETSTREAM_OPTIONS],
      useFactory: async (transport: JetStream, options: NatsJetStreamOptions) => {
        // Initialize the transport to ensure JetStreamManager is available
        await transport.initialize();

        // Create the health service using the JetStreamManager from the transport
        const manager = transport.getManager?.();
        if (!manager) {
          throw new Error('JetStreamManager is not initialized');
        }
        return new ConsumerHealthService(manager, options.consumerHealth);
      }
    };

    return {
      module: NatsJetStreamModule,
      imports: options.imports || [],
      providers: [
        {
          provide: JETSTREAM_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || []
        },
        loggerProvider,
        clientProvider,
        transportProvider,
        healthServiceProvider
      ],
      exports: [JETSTREAM_OPTIONS, JETSTREAM_CLIENT, JETSTREAM_TRANSPORT, APP_LOGGER, ConsumerHealthService]
    };
  }
}
