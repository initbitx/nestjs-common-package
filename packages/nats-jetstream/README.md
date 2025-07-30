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
- Advanced consumer configuration options (DeliverPolicy, AckPolicy, etc.)
- Direct access to NATS API through NatsContext

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
      // Stream configuration with name, description and subjects
      stream: {
        name: 'my-stream', // Stream name should be part of stream options
        description: 'My stream for processing orders',
        subjects: ['orders.*', 'users.events']
      },
      // Consumer configuration with name and other options
      consumerOptions: {
        name: 'my-consumer', // Consumer name should be part of consumer options
        durable: true, // Set to false for ephemeral consumers
        max_deliver: 10, // Maximum delivery attempts
        ack_wait: 30_000_000_000 // 30 seconds in nanoseconds
      },
      // Queue group for load balancing
      queue: 'processing-group'
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
        // Stream configuration with name, description and subjects
        stream: {
          name: configService.get<string>('NATS_STREAM') || 'my-stream',
          description: configService.get<string>('NATS_STREAM_DESCRIPTION') || 'My stream for processing events',
          subjects: configService.get<string[]>('NATS_STREAM_SUBJECTS') || ['events.*', 'notifications.*']
        },
        // Consumer configuration with name and other options
        consumerOptions: {
          name: configService.get<string>('NATS_CONSUMER') || 'my-consumer',
          durable: configService.get<boolean>('NATS_CONSUMER_DURABLE') !== false,
          max_deliver: configService.get<number>('NATS_MAX_DELIVER') || 10,
          ack_wait: configService.get<number>('NATS_ACK_WAIT_NS') || 30_000_000_000 // 30 seconds in nanoseconds
        },
        // Queue group for load balancing
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
import { JetStream, JETSTREAM_TRANSPORT } from '@initbit/nestjs-jetstream';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get the JetStream transport from the module
  const transport = app.get<JetStream>(JETSTREAM_TRANSPORT);

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
import { NatsClient, JETSTREAM_CLIENT } from '@initbit/nestjs-jetstream';
import { Inject } from '@nestjs/common';

@Injectable()
export class AppService {
  constructor(
    @Inject(JETSTREAM_CLIENT)
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

### Advanced Consumer Configuration

The JetStream transport supports advanced consumer configuration options:

```typescript
import { Module } from '@nestjs/common';
import { NatsJetStreamModule } from '@initbit/nestjs-jetstream';
import { DeliverPolicy, AckPolicy } from 'nats';

@Module({
  imports: [
    NatsJetStreamModule.register({
      connection: {
        servers: ['nats://localhost:4222']
      },
      // Stream configuration
      stream: {
        name: 'my-stream',
        subjects: ['orders.*', 'users.*'] // Define subjects for the stream
      },
      // Advanced consumer configuration
      consumerOptions: {
        name: 'my-consumer',
        deliver_policy: DeliverPolicy.New,
        ack_policy: AckPolicy.Explicit,
        ack_wait: 30_000_000_000, // 30 seconds in nanoseconds
        filter_subject: 'orders.created',
        // Or use multiple filter subjects
        filter_subjects: ['orders.created', 'orders.updated'],
        // Additional consumer options
        max_deliver: 10,
        max_ack_pending: 100
      }
    })
  ]
})
export class AppModule {}
```

### Using NatsContext for NATS API Access

The NatsContext provides direct access to the underlying NATS API:

```typescript
import { Controller } from '@nestjs/common';
import { EventPattern, Ctx } from '@nestjs/microservices';
import { NatsContext } from '@initbit/nestjs-jetstream';

@Controller()
export class OrdersController {
  @EventPattern('orders.created')
  async handleOrderCreated(data: any, @Ctx() context: NatsContext) {
    try {
      // Check if this is a JetStream message
      if (context.isJetStream()) {
        // Mark the message as being worked on (extends ack wait time)
        context.working();
        
        // Get JetStream metadata
        const metadata = context.getMetadata();
        console.log('Stream:', metadata.stream);
        console.log('Consumer:', metadata.consumer);
        console.log('Delivered:', metadata.delivered.count);
        
        // Process the message
        await this.processOrder(data);
        
        // Acknowledge the message on success
        context.ack();
      } else {
        // Handle regular NATS message
        console.log('Regular NATS message:', data);
      }
    } catch (error) {
      if (context.isJetStream()) {
        if (error.retryable) {
          // Negative acknowledge for retryable errors (will be redelivered)
          context.nack();
        } else {
          // Terminate for non-retryable errors (will not be redelivered)
          context.term();
        }
      }
      throw error;
    }
  }

  private async processOrder(order: any) {
    // Process the order...
  }
}
```

## Configuration Options

The `NatsJetStreamOptions` interface provides the following configuration options:

### Basic Options
- `connection`: NATS connection options
- `codec`: NATS codec for encoding and decoding messages
- `consumer`: Function to configure JetStream consumer options
- `queue`: Queue group name for NATS queue subscriptions

### Stream Configuration (Recommended Approach)
- `stream`: Configuration options for the NATS stream
  - `name`: Name of the stream (replaces top-level `streamName`)
  - `description`: Description of the stream
  - `subjects`: Array of subjects associated with the stream (if not provided, defaults to ['*', '>'])

### Consumer Configuration (Recommended Approach)
- `consumerOptions`: Configuration options for the NATS consumer
  - `name`: Name of the consumer (replaces top-level `durableName`)
  - `durable`: Whether this consumer should be durable (if false, name will be ignored)
  - `deliver_policy`: Delivery policy for the consumer (e.g., DeliverPolicy.All, DeliverPolicy.New)
  - `ack_policy`: Acknowledgment policy for the consumer (e.g., AckPolicy.Explicit, AckPolicy.None)
  - `ack_wait`: How long to wait for an acknowledgment (in nanoseconds)
  - `filter_subject`: A single subject to filter messages from the stream
  - `filter_subjects`: Multiple subjects to filter messages from the stream
  - Plus any other properties from the NATS ConsumerConfig interface (max_deliver, max_ack_pending, etc.)

### Legacy Options (Deprecated)
- `streamName`: **DEPRECATED** - JetStream stream name (use `stream.name` instead)
- `durableName`: **DEPRECATED** - JetStream durable consumer name (use `consumerOptions.name` instead)
- `deliverPolicy`: **DEPRECATED** - Delivery policy for the consumer (use `consumerOptions.deliver_policy` instead)
- `ackPolicy`: **DEPRECATED** - Acknowledgment policy for the consumer (use `consumerOptions.ack_policy` instead)
- `ackWait`: **DEPRECATED** - How long to wait for an acknowledgment in seconds (use `consumerOptions.ack_wait` in nanoseconds instead)
- `filterSubject`: **DEPRECATED** - A single subject to filter messages (use `consumerOptions.filter_subject` instead)
- `filterSubjects`: **DEPRECATED** - Multiple subjects to filter messages (use `consumerOptions.filter_subjects` instead)

> **Important**: These legacy options are now officially deprecated and will be removed in the next major release. Please migrate to the recommended structured options as soon as possible.

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

## Recent Improvements

The following improvements have been implemented in recent releases:

### Deprecated Legacy Registration Options
- Legacy registration options have been officially deprecated and will be removed in the next major release
- This includes: `streamName`, `durableName`, `deliverPolicy`, `ackPolicy`, `ackWait`, `filterSubject`, and `filterSubjects`
- Users should migrate to the structured options (`stream` and `consumerOptions`) as soon as possible
- The library will continue to support legacy options until the next major release for backward compatibility

### NestJS Application Logger Integration
- The package now properly integrates with NestJS application logger
- When configured with `app.useLogger(app.get(Logger))`, the transport will use the application's logger
- Logger can be provided via the options object: `NatsJetStreamModule.register({ logger: yourLogger })`
- Both `NatsClient` and `JetStream` classes now accept a logger through their options

### Event Emission Enhancements
- Improved event emission reliability with automatic reconnection
- Added retry logic with exponential backoff for failed event publications
- Specific handling for 503 errors (service unavailable) with reconnection attempts
- Better error reporting and logging for event dispatch issues

### Subject Subscription Fixes
- Fixed an issue where subject subscriptions were always prefixed with the stream name
- Event patterns like `@EventPattern('domain.user.greet')` now subscribe correctly without modification
- Stream configuration now uses wildcard subjects (`*`, `>`) to capture all patterns

### Configuration Options
- Added `logger` option to `NatsJetStreamOptions` and `NatsClientOptions` interfaces
- Updated the module to properly inject and use the provided logger

## Building

Run `nx build nats-jetstream` to build the library.

## Running unit tests

Run `nx test nats-jetstream` to execute the unit tests via [Jest](https://jestjs.io).

## License

This package is open source and available under the [MIT License](../../LICENSE).

## Repository

This package is part of the [nestjs-common-package](https://github.com/initbitx/nestjs-common-package) monorepo. You can find the source code for this package in the [packages/nats-jetstream](https://github.com/initbitx/nestjs-common-package/tree/main/packages/nats-jetstream) directory.

## Issues and Bug Reports

If you encounter any issues or bugs, please report them on our [GitHub Issues page](https://github.com/initbitx/nestjs-common-package/issues).

When reporting an issue, please include:
- A clear and descriptive title
- Steps to reproduce the issue
- Expected behavior
- Actual behavior
- Any relevant logs or error messages
- Your environment (Node.js version, NestJS version, etc.)
