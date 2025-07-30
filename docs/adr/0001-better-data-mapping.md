# ADR 0001: Better Data Mapping in NATS JetStream Transport

## Status

Proposed

## Context

The current NATS JetStream transport for NestJS has a basic data mapping mechanism. It decodes the entire message payload and routes it based on the NATS subject. This limits the flexibility of message handling and doesn't align with modern microservice architecture patterns that often use message envelopes with metadata for routing and processing.

The goal of "better data mapping" is to introduce a more sophisticated and flexible way to handle incoming messages, allowing for routing based on message content (e.g., a `type` field in a JSON payload) in addition to the NATS subject.

## Decision

We will enhance the NATS JetStream transport to support a more flexible data mapping strategy. The key decisions are:

1.  **Envelope-based Routing**: We will introduce support for a structured message envelope. This envelope will contain the message payload along with metadata, such as a message `type` and `headers`.

2.  **Hybrid Routing Strategy**: The transport will support a hybrid routing strategy that combines NATS subject-based routing with envelope-based routing. This allows for a graceful transition from the old system and provides more routing options.

3.  **Custom Mapper Callbacks**: Users will be able to provide their own custom logic for mapping and transforming messages. This will be achieved by allowing a custom mapper function to be passed in the transport options.

4.  **Backward Compatibility**: These new features will be introduced in a way that is backward compatible with the existing implementation. The new data mapping features will be opt-in, and the default behavior will remain unchanged.

## Consequences

### Positive

*   **Increased Flexibility**: Developers will have more control over how messages are routed and processed.
*   **Improved Developer Experience**: The new API will be more intuitive and align better with common microservice patterns.
*   **Enhanced Extensibility**: The custom mapper function will allow for a wide range of custom data mapping scenarios.

### Negative

*   **Increased Complexity**: The new data mapping features will add some complexity to the transport's configuration.
*   **Documentation Overhead**: The new features will need to be thoroughly documented to ensure developers can use them effectively.

### Risks

*   **Performance Overhead**: The new data mapping logic may introduce a small performance overhead. This will be mitigated by efficient implementation and benchmarking.

## Implementation Plan

1.  **Define a `MessageEnvelope` interface**: This interface will define the structure of the message envelope, including `type`, `payload`, and `headers`.
2.  **Update `JetStream` transport**:
    *   Add a `dataMapper` option to the transport configuration.
    *   Implement the logic to handle the new data mapping strategies.
    *   Ensure backward compatibility by defaulting to the current behavior.
3.  **Update `NatsJetStreamOptions`**: Add the `dataMapper` option to the `NatsJetStreamOptions` interface.
4.  **Update documentation**:
    *   Create a new section in the README to explain the new data mapping features.
    *   Provide examples of how to use the new features.
5.  **Add new tests**:
    *   Add unit tests for the new data mapping logic.
    *   Add integration tests to verify the end-to-end functionality.

