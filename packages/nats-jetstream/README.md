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
- **Multi-stream support** with pattern-based routing
- **Consumer caching** for improved efficiency and resource usage
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
- **Enhanced logging integration** with NestJS application logger
- Server-side consumer filtering via `filter_subject` / `filter_subjects` for durable consumers

Note: this transport no longer creates a plain `nc.subscribe(pattern, ...)` fallback for event patterns. Consumers are expected to be JetStream consumers (server-side) and publishers should send events using JetStream (e.g., `js.publish(...)`) to ensure proper JetStream semantics (durable storage, acknowledgments, redelivery, etc.). For quick CLI testing you can still publish using the JetStream API (or configure a small dev-only fallback), but the library's default behavior is JetStream-first.
***

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

#### Multi-Stream Registration

```typescript
import { Module } from '@nestjs/common';
import { NatsJetStreamModule } from '@initbit/nestjs-jetstream';

@Module({
  imports: [
    NatsJetStreamModule.register({
      connection: {
        servers: ['nats://localhost:4222']
      },
      // Multi-stream configuration
      multiStream: {
        streams: [
          {
            name: 'orders-stream',
            description: 'Stream for order processing',
            subjects: ['orders.*']
          },
          {
            name: 'users-stream',
            description: 'Stream for user events',
            subjects: ['users.*']
          }
        ],
        defaultStream: 'orders-stream',
        // Map specific patterns to streams
        patternToStream: new Map([
          ['orders.created', 'orders-stream'],
          ['users.registered', 'users-stream']
        ]),
        // Consumer configuration per stream
        streamConsumers: new Map([
          ['orders-stream', {
            name: 'orders-consumer',
            durable: true,
            max_deliver: 5,
            // Server-side filter: only receive these subjects for this consumer
            filter_subjects: ['orders.created']
          }],
          ['users-stream', {
            name: 'users-consumer',
            durable: true,
            max_deliver: 3,
            filter_subjects: ['users.registered']
          }]
        ]),
        // Register streams asynchronously for better performance
        asyncRegistration: true
      }
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
          durable: configService.get<boolean>('NATS_CONSUMER_DURABLE') === 'true',
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

  // Handle multi-stream patterns
  @EventPattern('orders.created')
  handleOrderCreated(data: any) {
    console.log('Order created:', data);
  }

  @EventPattern('users.registered')
  handleUserRegistered(data: any) {
    console.log('User registered:', data);
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

### Custom Message Mapping

The transport provides a flexible message mapping system that allows you to control how incoming NATS messages are mapped to NestJS handlers. You can choose between two default mappers or provide your own custom mapper function.

#### Default Mappers

- `subject` (default): This mapper uses the NATS message subject as the handler key. The entire decoded message data is passed as the handler payload.
- `envelope`: This mapper assumes the message is in a specific envelope format with a `type` property. It uses the `type` property as the handler key and the `payload` property as the handler payload.

You can select the default mapper using the `defaultMapper` option:

```typescript
NatsJetStreamModule.register({
  // ... other options
  defaultMapper: 'envelope'
})
```

#### Custom Mapper Function

For more advanced scenarios, you can provide a custom `mapper` function. This function takes the NATS message (`JsMsg`) and the decoded data as input and should return an object with `handlerKey` and `data` properties.

```typescript
import { JsMsg } from 'nats';
import { JetStreamMapper } from '@initbit/nestjs-jetstream';

const customMapper: JetStreamMapper = (msg: JsMsg, decoded: unknown) => {
  // Your custom logic to determine the handler key and data
  if ((decoded as any).eventType) {
    return {
      handlerKey: (decoded as any).eventType,
      data: (decoded as any).eventData,
      ctxExtras: (decoded as any).meta,
    };
  }
  return { handlerKey: msg.subject, data: decoded };
};

@Module({
  imports: [
    NatsJetStreamModule.register({
      // ... other options
      mapper: customMapper,
    }),
  ],
})
export class AppModule {}
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

### Enhanced Consumer Configuration (v1.3.1)

Version 1.3.1 introduces additional consumer configuration options for production-grade deployments:

```typescript
import { Module } from '@nestjs/common';
import { NatsJetStreamModule } from '@initbit/nestjs-jetstream';
import { DeliverPolicy, AckPolicy, ReplayPolicy } from 'nats';

@Module({
  imports: [
    NatsJetStreamModule.register({
      connection: {
        servers: ['nats://localhost:4222']
      },
      stream: {
        name: 'ticket-stream',
        subjects: ['ticket.events.*', 'ticket.commands.*']
      },
      consumerOptions: {
        // Separate consumer name from durable name (v1.3.1)
        name: 'ticket-processor-consumer',
        durable: true,
        
        // Control replay behavior (v1.3.1)
        replay_policy: ReplayPolicy.Instant, // or ReplayPolicy.Original
        
        // Standard consumer options
        deliver_policy: DeliverPolicy.All,
        ack_policy: AckPolicy.Explicit,
        ack_wait: 30_000_000_000, // 30 seconds
        
        // Enhanced configuration (v1.3.1)
        max_waiting: 512,                     // Max waiting pulls
        backoff: [1, 2, 5, 10, 30, 60, 120, 300], // Backoff in seconds
        inactive_threshold: 300_000_000_000,  // 5 minutes in nanoseconds
        num_replicas: 3,                      // For high availability
        mem_storage: true,                    // Use memory storage
        sample_freq: '10%',                   // Sample 10% of messages
        
        // Filter configuration
        filter_subject: 'ticket.events.*',
        max_deliver: 3,
        max_ack_pending: 100
      }
    })
  ]
})
export class AppModule {}
```

### Example: Multi-Stream with durable consumers

The following example shows a full NestJS module registration that configures two streams and durable consumers for each stream. It also includes a minimal controller that demonstrates how to handle messages coming from durable consumers and use `NatsContext` to `ack()` / `nack()` / `term()` messages.

```typescript
import { Module, Injectable, Controller } from '@nestjs/common';
import { NatsJetStreamModule, NatsClient, JETSTREAM_CLIENT, ConsumerHealthService, NatsContext } from '@initbit/nestjs-jetstream';
import { EventPattern, Ctx } from '@nestjs/microservices';
import { DeliverPolicy, AckPolicy } from 'nats';

@Module({
  imports: [
    NatsJetStreamModule.register({
      connection: { servers: ['nats://localhost:4222'] },

      // Configure multi-stream topology
      multiStream: {
        streams: [
          {
            name: 'orders-stream',
            description: 'Stream for order events',
            subjects: ['orders.*']
          },
          {
            name: 'users-stream',
            description: 'Stream for user events',
            subjects: ['users.*']
          }
        ],

        // map specific patterns to streams
        patternToStream: new Map<string, string>([
          ['orders.created', 'orders-stream'],
          ['orders.updated', 'orders-stream'],
          ['users.registered', 'users-stream']
        ]),

        // define durable consumers per-stream
        streamConsumers: new Map<string, any>([
          ['orders-stream', {
            name: 'orders-durable-consumer',
            durable: true,
            // high-throughput friendly defaults
            ack_wait: 30_000_000_000, // 30s in ns
            deliver_policy: DeliverPolicy.New,
            ack_policy: AckPolicy.Explicit,
            max_deliver: 10,
            max_ack_pending: 500,
            // Server-side filter subjects for this durable consumer
            filter_subjects: ['orders.created']
          }],
          ['users-stream', {
            name: 'users-durable-consumer',
            durable: true,
            ack_wait: 30_000_000_000,
            deliver_policy: DeliverPolicy.All,
            ack_policy: AckPolicy.Explicit,
            max_deliver: 5,
            max_ack_pending: 200,
            filter_subjects: ['users.registered']
          }]
        ])
      },

      // optional: provide an application name used for naming when needed
      appName: 'my-app'
    })
  ]
})
export class AppModule {}

// Controller that handles events routed to streams above
@Controller()
export class EventsController {
  // An order created event will be routed to the orders-stream and handled by this method
  @EventPattern('orders.created')
  async handleOrderCreated(data: any, @Ctx() ctx: NatsContext) {
    try {
      // Business logic
      console.log('Processing order.created:', data);

      // Acknowledge on success (durable consumer)
      if (ctx.isJetStream()) ctx.ack();
    } catch (err: any) {
      // For retryable errors, negative-ack; for terminal errors, terminate
      if (ctx.isJetStream()) {
        if (err && err.retryable) ctx.nack();
        else ctx.term();
      }
      throw err;
    }
  }

  @EventPattern('users.registered')
  async handleUserRegistered(data: any, @Ctx() ctx: NatsContext) {
    try {
      console.log('Processing users.registered:', data);
      if (ctx.isJetStream()) ctx.ack();
    } catch (err: any) {
      if (ctx.isJetStream()) {
        if (err && err.retryable) ctx.nack();
        else ctx.term();
      }
      throw err;
    }
  }
}
```

Notes and best-practices for durable consumers

- Use durable consumers when you need at-least-once processing and stable consumer state across restarts. Durable consumers keep track of the last acknowledged sequence.
- Configure `ack_wait` in nanoseconds (the NATS JetStream API expects nanoseconds) — in the example above we use 30_000_000_000 to represent 30 seconds.
- `max_deliver` controls how many times a message will be redelivered on failures; set it according to your retry strategy.
- `max_ack_pending` allows you to tune how many un-acked messages can be outstanding — useful for throughput tuning.
- When using envelope-based messages, the module will still map patterns to the configured streams via `patternToStream`.

Querying consumer health

If you need to monitor durable consumers, inject `ConsumerHealthService` (exported by the module) and subscribe to health updates:

```typescript
@Injectable()
export class DurableConsumerMonitor {
  constructor(private readonly consumerHealthService: ConsumerHealthService) {
    // subscribe to updates
    this.consumerHealthService.onHealthUpdate(this.onUpdate.bind(this));
  }

  onUpdate(health: any) {
    // react to unhealthy consumers (alerts, metrics, scaling)
    if (health.status !== 'active') {
      console.warn('Consumer unhealthy', health);
    }
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
- `logger`: Logger service to use for logging

### Message Mapping Options
- `mapper`: Custom mapper function for incoming messages (see [Custom Message Mapping](#custom-message-mapping))
- `defaultMapper`: Default mapper to use if no custom mapper is provided. Can be 'subject' (default) or 'envelope'

### Stream Configuration (Recommended Approach)
- `stream`: Configuration options for the NATS stream
  - `name`: Name of the stream (replaces top-level `streamName`)
  - `description`: Description of the stream
  - `subjects`: Array of subjects associated with the stream (if not provided, defaults to ['*', '>'])

### Multi-Stream Configuration (New Feature)
- `multiStream`: Configuration for multiple streams
  - `streams`: Array of stream configurations
  - `defaultStream`: Default stream name for backward compatibility
  - `patternToStream`: Mapping of event patterns to specific streams
  - `streamConsumers`: Consumer configuration per stream
  - `asyncRegistration`: Whether to register streams asynchronously

### Consumer Configuration (Recommended Approach)
- `consumerOptions`: Configuration options for the NATS consumer
  - `name`: Name of the consumer (separate from and replaces `durable_name`)
  - `durable`: Whether this consumer should be durable (if false, name will be ignored)
  - `deliver_policy`: Delivery policy for the consumer (e.g., DeliverPolicy.All, DeliverPolicy.New)
  - `ack_policy`: Acknowledgment policy for the consumer (e.g., AckPolicy.Explicit, AckPolicy.None)
  - `ack_wait`: How long to wait for an acknowledgment (in nanoseconds)
  - `replay_policy`: How to replay messages (e.g., ReplayPolicy.Original, ReplayPolicy.Instant) **New in v1.3.1**
  - `filter_subject`: A single subject to filter messages from the stream
  - `filter_subjects`: Multiple subjects to filter messages from the stream
  - `max_waiting`: Maximum number of waiting pulls **New in v1.3.1**
  - `backoff`: Backoff intervals for retries (array of seconds) **New in v1.3.1**
  - `inactive_threshold`: Threshold for marking consumer as inactive (in nanoseconds) **New in v1.3.1**
  - `num_replicas`: Number of replicas **New in v1.3.1**
  - `mem_storage`: Use memory storage flag **New in v1.3.1**
  - `sample_freq`: Sampling frequency **New in v1.3.1**
  - Plus any other properties from the NATS ConsumerConfig interface (max_deliver, max_ack_pending, etc.)

### Application Configuration
- `appName`: Application name for consumer naming (defaults to 'nestjs-app')

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

### Enhanced Consumer Configuration (v1.3.1)
- **Separate Consumer Names**: Consumer `name` field is now separate from `durable_name` for better identification and management
- **Advanced Consumer Options**: Added support for additional consumer configuration:
  - `max_waiting`: Maximum number of waiting pulls for better flow control
  - `backoff`: Configurable backoff intervals for retries (array of seconds)
  - `replay_policy`: Control how messages are replayed (Original, Instant, etc.)
  - `inactive_threshold`: Threshold for marking consumer as inactive
  - `num_replicas`: Number of replicas for high availability
  - `mem_storage`: Memory storage option for performance optimization
  - `sample_freq`: Sampling frequency for monitoring
- **Durable Consumer Optimization**: Removed unnecessary `deliver_subject` for durable consumers, improving efficiency
- **Backward Compatibility**: All legacy configuration options remain supported during migration period

### Performance Optimizations and Developer Experience (v1.3.0)
- **High-Throughput Message Processing**: Optimized message handling for better performance in high-load scenarios
- **Enhanced Connection Management**: Improved connection handling with better error recovery and resource cleanup
- **Optimized Consumer Management**: More efficient consumer creation and subscription handling
- **Consumer Health Monitoring**: New tools to monitor and report on consumer health metrics
- **Developer-Friendly APIs**: Intuitive interfaces for working with streams and consumers
- **Comprehensive Error Handling**: Better error messages and recovery strategies

### Status Updates Handling (v1.2.1)
- **Bug Fix**: Fixed potential infinite loop in handleStatusUpdates method
- **Memory Leak Prevention**: Added proper termination conditions for status update loop
- **Error Handling**: Improved error handling with try/catch/finally blocks
- **Connection Monitoring**: Added connection state monitoring to properly end status updates

### Multi-Stream Support (v1.2.0)
- **New Feature**: Support for multiple streams with pattern-based routing
- **StreamManager**: Dedicated class for managing multiple streams and their consumers
- **Pattern Mapping**: Map specific event patterns to dedicated streams
- **Per-Stream Consumers**: Configure different consumer settings for each stream
- **Async Registration**: Option to register streams asynchronously for better performance
- **Backward Compatibility**: Maintains compatibility with single-stream configurations

### Consumer Caching Mechanism (v1.2.0)
- **Performance Improvement**: Consumer caching to reuse consumers with the same inbox or deliver_subject
- **Resource Efficiency**: Reduces resource usage by sharing consumers across multiple event patterns
- **Durable Consumer Support**: Proper handling of durable consumers with cache key including durable name
- **Stream-Pattern Mapping**: Efficient consumer reuse based on stream name and pattern combinations

### Enhanced Configuration Options (v1.2.0)
- **Structured Options**: New structured `stream` and `consumerOptions` configuration objects
- **Multi-Stream Configuration**: New `multiStream` option for complex multi-stream setups
- **Application Naming**: `appName` option for better consumer naming and identification
- **Improved Type Safety**: Better TypeScript interfaces and type definitions

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

### Subscription Registration Helper
- When subscribing to subject patterns, the transport now stores a mapping between the subject and handler key if envelope mapping is selected
- This ensures that even if the `type` in an incoming message doesn't match a handler key directly, the transport can still find the correct handler based on the subscription subject
- This provides greater flexibility and backward compatibility for applications using envelope-based routing

### Custom Message Mapping
- Added support for custom message mapping through the `mapper` option
- Introduced `defaultMapper` option to choose between 'subject' (default) and 'envelope' mapping strategies
- Custom mappers allow complete control over how NATS messages are mapped to NestJS handlers
- Envelope mapper provides backward compatibility for message envelope patterns with `type` and `payload` properties
- Subject-to-handler mapping system ensures correct routing when using envelope mode with different subject patterns

### Configuration Options
- Added `logger` option to `NatsJetStreamOptions` and `NatsClientOptions` interfaces
- Updated the module to properly inject and use the provided logger
- Added `mapper` and `defaultMapper` options for custom message mapping

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
