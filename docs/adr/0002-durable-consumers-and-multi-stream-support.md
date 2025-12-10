# ADR 0002: Durable Consumers and Multi-Stream Support for NATS JetStream Transport

## Status

Proposed

## Context

The current NATS JetStream transport for NestJS has limitations in consumer management and stream configuration:

1. **Ephemeral Consumers for Event Patterns**: The current implementation creates ephemeral consumers for `@EventPattern` subjects, which means consumers are lost when the application restarts, leading to message loss and inconsistent state.

2. **Single Stream Limitation**: The current implementation only supports a single stream configuration per module, limiting the flexibility for applications that need to work with multiple streams for different types of events or data.

3. **Consumer Reuse Inefficiency**: While there is a consumer caching mechanism, it doesn't properly handle durable consumers for event subscriptions, leading to resource waste and potential message duplication.

## Decision

We will enhance the NATS JetStream transport to support durable consumers for event patterns and multi-stream configurations. The key decisions are:

### 1. Durable Consumer Support for Event Patterns
- **Default Durable Consumers**: Make durable consumers the default for `@EventPattern` subscriptions to ensure message persistence and reliable delivery.
- **Configurable Durability**: Allow developers to opt-out of durable consumers when needed (e.g., for testing or specific use cases).
- **Consumer Naming Strategy**: Implement a consistent naming strategy for durable consumers based on stream name, pattern, and application context.
- **Consumer Reuse**: Enhance the existing consumer caching mechanism to properly handle durable consumers and prevent duplicate subscriptions.

### 2. Multi-Stream Support
- **Stream Configuration Array**: Support an array of stream configurations in the module options, allowing multiple streams to be managed simultaneously.
- **Multiple Durable Consumers**: Create separate durable consumers for each stream, ensuring proper isolation and management of different event types.
- **Stream-Specific Consumer Configuration**: Allow consumers to be configured per stream, providing granular control over consumer behavior.
- **Pattern-to-Stream Mapping**: Support mapping specific event patterns to specific streams, enabling logical separation of different types of events.
- **Subject-Based Consumer Selection**: Event subscriptions should use specific consumers based on the subject/stream mapping, ensuring proper message routing and consumer management.
- **Async Stream Registration**: Support both synchronous and asynchronous stream registration to handle complex initialization scenarios.

### 3. Enhanced Consumer Management
- **Consumer Lifecycle Management**: Implement proper consumer lifecycle management including creation, updates, and cleanup.
- **Consumer Health Monitoring**: Add monitoring capabilities for consumer health and performance.
- **Consumer Configuration Validation**: Validate consumer configurations to prevent runtime errors.

## Consequences

### Positive

*   **Improved Reliability**: Durable consumers ensure message persistence and reliable delivery across application restarts.
*   **Better Resource Management**: Proper consumer reuse reduces resource consumption and improves performance.
*   **Enhanced Flexibility**: Multi-stream support allows for better organization of different types of events and data.
*   **Scalability**: Support for multiple streams enables better scalability and separation of concerns.
*   **Developer Experience**: More intuitive configuration options and better error handling.

### Negative

*   **Increased Complexity**: The new features add complexity to the configuration and implementation.
*   **Resource Overhead**: Durable consumers require more server-side resources for persistence.
*   **Configuration Complexity**: Multi-stream support requires more complex configuration options.

### Risks

*   **Backward Compatibility**: Need to ensure existing applications continue to work without modification.
*   **Performance Impact**: Additional complexity may impact performance, requiring careful optimization.
*   **Configuration Errors**: More complex configuration options increase the risk of misconfiguration.

## Implementation Plan

### Phase 1: Durable Consumer Enhancement
1. **Update Consumer Options Interface**: Enhance the `ConsumerOptions` interface to better support durable consumer configuration.
2. **Modify Event Pattern Subscription**: Update the `subscribeToEventPatterns` method to create durable consumers by default.
3. **Enhance Consumer Caching**: Improve the consumer caching mechanism to properly handle durable consumers.
4. **Add Consumer Naming Strategy**: Implement a consistent naming strategy for durable consumers.

### Phase 2: Multi-Stream Support
1. **Update Stream Options Interface**: Enhance the `StreamOptions` interface to support multiple streams.
2. **Implement Stream Manager**: Create a stream manager to handle multiple stream configurations.
3. **Add Pattern-to-Stream Mapping**: Implement mapping between event patterns and specific streams.
4. **Support Async Stream Registration**: Add support for asynchronous stream registration.

### Phase 3: Consumer Management Enhancement
1. **Consumer Lifecycle Management**: Implement proper consumer lifecycle management.
2. **Health Monitoring**: Add consumer health monitoring capabilities.
3. **Configuration Validation**: Add validation for consumer and stream configurations.

### Phase 4: Documentation and Testing
1. **Update Documentation**: Update README and API documentation with new features.
2. **Add Examples**: Provide comprehensive examples for the new features.
3. **Enhance Tests**: Add unit and integration tests for the new functionality.

## Technical Details

### Consumer Naming Strategy
```typescript
// Format: {appName}-{streamName}-{patternHash}
const consumerName = `${appName}-${streamName}-${hashPattern(pattern)}`;
```

### Multi-Stream Configuration
```typescript
interface MultiStreamOptions {
  streams: StreamOptions[];
  defaultStream?: string;
  patternToStream?: Map<string, string>;
  streamConsumers?: Map<string, ConsumerOptions>; // Consumer config per stream
}
```

### Durable Consumer Configuration
```typescript
interface DurableConsumerOptions extends ConsumerOptions {
  durable: boolean; // default: true for event patterns
  consumerName?: string; // auto-generated if not provided
  streamName?: string; // required for multi-stream support
}
```

## Migration Strategy

1. **Backward Compatibility**: Ensure existing configurations continue to work without modification.
2. **Gradual Migration**: Provide migration guides for users to adopt new features.
3. **Deprecation Warnings**: Add deprecation warnings for old configuration patterns.
4. **Feature Flags**: Use feature flags to enable/disable new features during transition.

## Conclusion

This ADR addresses the critical limitations in the current NATS JetStream transport implementation. By implementing durable consumers for event patterns and multi-stream support, we will significantly improve the reliability, flexibility, and scalability of the package. The proposed changes maintain backward compatibility while providing powerful new capabilities for developers building robust microservices with NestJS and NATS JetStream. 