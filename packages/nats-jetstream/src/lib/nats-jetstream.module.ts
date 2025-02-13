import { DynamicModule, Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';

import { NatsClient } from './nats.client';
import { JetStream } from './jetstream.transport';
import { JETSTREAM_OPTIONS, JETSTREAM_SERVICE_TOKEN, JETSTREAM_TRANSPORT_TOKEN } from './nats.constants';
import { NatsJetStreamOptions } from './interfaces/nats-jetstream-options.interface';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: JETSTREAM_SERVICE_TOKEN,
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
  providers: [
    {
      provide: JETSTREAM_TRANSPORT_TOKEN,
      inject: [ ConfigService ],
      useFactory: async (config: ConfigService) => {
        const servers = config.get<string | string[]>('nats.uri') || 'nats://localhost';
        return new JetStream({
          servers: servers,
          streamName: 'hello.*',
          durableName: 'APP_SERVICE'
        });
      }
    }
  ],
  exports: [ JETSTREAM_TRANSPORT_TOKEN, JETSTREAM_SERVICE_TOKEN ]
})

export class NatsJetStreamModule {
  /**
   * Register the NatsJetStream module with static options
   * @param options Configuration options for the JetStream transport
   */
  static register(options: NatsJetStreamOptions): DynamicModule {
    const clientProvider = {
      provide: JETSTREAM_SERVICE_TOKEN,
      useFactory: () => {
        return new NatsClient(options);
      }
    };

    const transportProvider = {
      provide: JETSTREAM_TRANSPORT_TOKEN,
      useFactory: () => {
        const servers = options.connection?.servers || 'nats://localhost';
        return new JetStream({
          servers: servers,
          streamName: options.streamName || 'default',
          durableName: options.durableName || 'default',
          queue: options.queue
        });
      }
    };

    return {
      module: NatsJetStreamModule,
      providers: [
        {
          provide: JETSTREAM_OPTIONS,
          useValue: options
        },
        clientProvider,
        transportProvider
      ],
      exports: [JETSTREAM_OPTIONS, JETSTREAM_SERVICE_TOKEN, JETSTREAM_TRANSPORT_TOKEN]
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
    const clientProvider = {
      provide: JETSTREAM_SERVICE_TOKEN,
      inject: [JETSTREAM_OPTIONS],
      useFactory: (options: NatsJetStreamOptions) => {
        return new NatsClient(options);
      }
    };

    const transportProvider = {
      provide: JETSTREAM_TRANSPORT_TOKEN,
      inject: [JETSTREAM_OPTIONS],
      useFactory: (options: NatsJetStreamOptions) => {
        const servers = options.connection?.servers || 'nats://localhost';
        return new JetStream({
          servers: servers,
          streamName: options.streamName || 'default',
          durableName: options.durableName || 'default',
          queue: options.queue
        });
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
        clientProvider,
        transportProvider
      ],
      exports: [JETSTREAM_OPTIONS, JETSTREAM_SERVICE_TOKEN, JETSTREAM_TRANSPORT_TOKEN]
    };
  }
}
