# NestJS NATS JetStream Transport

A NestJS microservice transport for NATS JetStream, providing seamless integration between NestJS microservices and NATS JetStream, a persistent streaming system built on top of NATS.

## Installation

```bash
  npm install @initbit/nestjs-jetstream @nestjs/microservices nats
```

## Overview

This package provides a custom transport strategy for NestJS applications to communicate using NATS JetStream. It integrates with NestJS's microservices architecture and supports both message patterns (request-response) and event patterns (publish-subscribe).

## Key Features

- Connect to NATS JetStream with configurable options
- Create and manage streams and consumers
- Handle JetStream messages with acknowledgments
- Support for request-response patterns
- Support for event-based patterns
- Queue group support
- Configurable consumer options
- Proper connection management with reconnection handling
- Support for multiple server addresses for high availability
- Graceful shutdown and connection draining

## Usage

### Module Registration

You can register the module in two ways:

#### Static Registration

```typescript
import { Module } from '@nestjs/common';
import { NatsJetStreamModule } from '@initbit/nestjs-jetstream';

@Module({
  imports: [
    NatsJetStreamModule.register({
      connection: {
        servers: ['nats://localhost:4222']
      },
      streamName: 'my-stream',
      durableName: 'my-consumer'
    })
  ]
})
export class AppModule {}
```

#### Async Registration

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NatsJetStreamModule } from '@initbit/nestjs-jetstream';

@Module({
  imports: [
    ConfigModule.forRoot(),
    NatsJetStreamModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          servers: [configService.get<string>('NATS_URL') || 'nats://localhost:4222']
        },
        streamName: configService.get<string>('NATS_STREAM') || 'my-stream',
        durableName: configService.get<string>('NATS_CONSUMER') || 'my-consumer',
        queue: configService.get<string>('NATS_QUEUE')
      })
    })
  ]
})
export class AppModule {}
```

### Creating a Microservice

```typescript
import { NestFactory } from '@nestjs/core';
import { JetStream, JETSTREAM_TRANSPORT_TOKEN } from '@initbit/nestjs-jetstream';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get the JetStream transport from the module
  const transport = app.get<JetStream>(JETSTREAM_TRANSPORT_TOKEN);

  // Create a microservice with the transport
  app.connectMicroservice({
    strategy: transport
  });

  // Start the microservice
  await app.startAllMicroservices();
  await app.listen(3000);
}
bootstrap();
```

### Controller Example

```typescript
import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern } from '@nestjs/microservices';

@Controller()
export class AppController {
  // Handle request-response patterns
  @MessagePattern('get.user')
  getUser(data: { id: string }) {
    return { id: data.id, name: 'John Doe' };
  }

  // Handle event-based patterns
  @EventPattern('user.created')
  handleUserCreated(data: any) {
    console.log('User created:', data);
  }
}
```

### Client Example

```typescript
import { Injectable } from '@nestjs/common';
import { NatsClient, JETSTREAM_SERVICE_TOKEN } from '@initbit/nestjs-jetstream';
import { Inject } from '@nestjs/common';

@Injectable()
export class AppService {
  constructor(
    @Inject(JETSTREAM_SERVICE_TOKEN)
    private readonly client: NatsClient
  ) {}

  // Send a request and get a response
  async getUser(id: string) {
    return this.client.send('get.user', { id });
  }

  // Emit an event (no response)
  async createUser(user: any) {
    return this.client.emit('user.created', user);
  }
}
```

## Configuration Options

The `NatsJetStreamOptions` interface provides the following configuration options:

- `connection`: NATS connection options
- `codec`: NATS codec for encoding and decoding messages
- `consumer`: Function to configure JetStream consumer options
- `queue`: Queue group name for NATS queue subscriptions
- `streamName`: JetStream stream name
- `durableName`: JetStream durable consumer name

## Technical Requirements

- Compatible with NestJS versions 9, 10, and 11
- Requires Node.js version 18 or higher
- Uses NATS client library version 2.x
- TypeScript support for type safety

## Future Roadmap

The following improvements are planned for future releases:

### Phase 1: Critical Fixes
- Fix critical bugs in the codebase
- Address inconsistencies in the API
- Improve basic documentation

### Phase 2: Core Enhancements
- Implement missing features
- Enhance error handling
- Improve type definitions
- Increase test coverage

### Phase 3: Performance and Developer Experience
- Optimize performance for high-throughput scenarios
- Enhance developer experience with better APIs
- Add comprehensive documentation

### Phase 4: Advanced Features
- Implement plugin system
- Add middleware support
- Create additional utilities and helpers

## Building

Run `nx build nats-jetstream` to build the library.

## Running unit tests

Run `nx test nats-jetstream` to execute the unit tests via [Jest](https://jestjs.io).
