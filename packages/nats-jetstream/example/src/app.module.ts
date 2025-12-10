import { Module, Logger } from '@nestjs/common';
import { NatsJetStreamModule } from '../../src';
import { ExampleController } from './example.controller';
import { buildExampleMultiStreamConfig } from './validate-config';

const exampleCfg = buildExampleMultiStreamConfig();

// Ensure servers array is a mutable string[] to satisfy ConnectionOptions typing
const connection =
  exampleCfg.connection && exampleCfg.connection.servers
    ? { servers: [...(exampleCfg.connection.servers as readonly string[])] }
    : undefined;

@Module({
  imports: [
    NatsJetStreamModule.register({
      connection: connection as any,
      multiStream: exampleCfg.multiStream,
      appName: exampleCfg.appName,
      logger: new Logger('Example'),
    } as any),
  ],
  controllers: [ExampleController],
})
export class AppModule {}
