import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { JETSTREAM_TRANSPORT } from '../../src';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: new Logger('Example') });

  // Retrieve the transport provider instance from the container
  const transport = app.get(JETSTREAM_TRANSPORT as any);

  // Connect the microservice using the JetStream transport
  app.connectMicroservice({strategy: transport});
  await app.startAllMicroservices();

  // Use a local Logger instance instead of trying to resolve Logger from the DI container
  const logger = new Logger('Example');
  logger.log('Microservice is listening for JetStream events...');
}

bootstrap().catch(err => {
  console.error('Error bootstrapping example:', err);
  process.exit(1);
});
