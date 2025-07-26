import { DynamicModule, Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';
import { AckPolicy, DeliverPolicy } from 'nats';

import { NatsClient } from './nats.client';
import { JetStream } from './jetstream.transport';
import { JETSTREAM_OPTIONS, JETSTREAM_CLIENT, JETSTREAM_TRANSPORT } from './nats.constants';
import { NatsJetStreamOptions } from './interfaces/nats-jetstream-options.interface';

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
  providers: [
    {
      provide: JETSTREAM_TRANSPORT,
      inject: [ ConfigService ],
      useFactory: async (config: ConfigService) => {
        const servers = config.get<string | string[]>('nats.uri') || 'nats://localhost';
        return new JetStream({
          servers: servers,
          streamName: config.get<string>('nats.stream') || 'hello.*',
          durableName: config.get<string>('nats.consumer') || 'APP_SERVICE',
          queue: config.get<string>('nats.queue'),
          deliverPolicy: config.get<DeliverPolicy>('nats.deliverPolicy'),
          ackPolicy: config.get<AckPolicy>('nats.ackPolicy'),
          ackWait: config.get<number>('nats.ackWait'),
          filterSubject: config.get<string>('nats.filterSubject'),
          filterSubjects: config.get<string[]>('nats.filterSubjects')
        });
      }
    }
  ],
  exports: [ JETSTREAM_TRANSPORT, JETSTREAM_CLIENT ]
})

export class NatsJetStreamModule {
  /**
   * Register the NatsJetStream module with static options
   * @param options Configuration options for the JetStream transport
   */
  static register(options: NatsJetStreamOptions): DynamicModule {
    const clientProvider = {
      provide: JETSTREAM_CLIENT,
      useFactory: () => {
        return new NatsClient(options);
      }
    };

    const transportProvider = {
      provide: JETSTREAM_TRANSPORT,
      useFactory: () => {
        const servers = options.connection?.servers || 'nats://localhost';
        return new JetStream({
          servers: servers,
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
      exports: [JETSTREAM_OPTIONS, JETSTREAM_CLIENT, JETSTREAM_TRANSPORT]
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
      provide: JETSTREAM_CLIENT,
      inject: [JETSTREAM_OPTIONS],
      useFactory: (options: NatsJetStreamOptions) => {
        return new NatsClient(options);
      }
    };

    const transportProvider = {
      provide: JETSTREAM_TRANSPORT,
      inject: [JETSTREAM_OPTIONS],
      useFactory: (options: NatsJetStreamOptions) => {
        const servers = options.connection?.servers || 'nats://localhost';
        return new JetStream({
          servers: servers,
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
      exports: [JETSTREAM_OPTIONS, JETSTREAM_CLIENT, JETSTREAM_TRANSPORT]
    };
  }
}
