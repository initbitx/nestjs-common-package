# NATS JetStream Integration - Task List

This document contains the task list for implementing the improvements to the NATS JetStream integration based on the requirements in `docs/requirements.md` and the improvement plan in `docs/plan.md`.

## Phase 1: Critical Fixes and Durable Consumers

- [x] Fix JetStream Transport Provider: Correct the useFactory in NatsJetStreamModule to properly return the JetStream instance
- [x] Complete subscribeToTopics Implementation: Implement proper subscription logic in the subscribeToTopics method
- [x] Fix Options Handling: Ensure consistent options handling between module and transport classes
- [x] Fix handleStatusUpdates: Properly handle the infinite loop in handleStatusUpdates to prevent memory leaks
- [x] Implement durable consumers for event patterns: Make durable consumers the default for event patterns to ensure message persistence
- [x] Enhance consumer caching mechanism: Improve consumer reuse for better resource management
- [x] Add consumer naming strategies: Implement consistent naming for durable consumers

## Phase 2: Multi-Stream Support and Core Enhancements

- [x] Add multi-stream support with sync/async registration: Support multiple streams per module
- [x] Implement pattern-to-stream mapping: Map specific event patterns to specific streams
- [x] Add stream management utilities: Create a dedicated class for managing streams and consumers
- [x] Implement multiple durable consumers: Support one consumer per stream for proper isolation
- [x] Add stream-specific consumer configurations: Allow different consumer settings for each stream
- [x] Implement subject-based consumer selection: Select consumers based on the subject/stream mapping

## Phase 3: Performance and Developer Experience

- [x] Optimize performance for high-throughput scenarios
- [x] Enhance developer experience with better APIs
- [x] Add comprehensive documentation and examples
- [x] Implement consumer health monitoring hooks

## Phase 4: Advanced Features

- [ ] Implement plugin system
- [ ] Add middleware support
- [ ] Create additional utilities and helpers
