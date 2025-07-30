import { JetStream } from '../lib/jetstream.transport';
import { createMock } from '@golevelup/ts-jest';
import { JsMsg } from 'nats';

describe('JetStream Subject-Handler Mapping', () => {
  let strategy: JetStream;

  beforeEach(() => {
    strategy = new JetStream({
      servers: 'nats://localhost:4222',
      streamName: 'test-stream',
      durableName: 'test-consumer',
      defaultMapper: 'envelope'
    });
  });

  describe('addHandler with envelope mapping', () => {
    it('should store subject-to-handler mapping when envelope mapping is enabled', () => {
      const mockHandler = jest.fn();
      
      // Add a handler for an event
      strategy.addHandler('user.created', mockHandler, true);
      
      // Get the mapping
      const mapping = strategy.getSubjectToHandlerMapping();
      
      // Verify the mapping was stored
      expect(mapping.get('user.created')).toBe('user.created');
    });

    it('should use custom handler key when provided in extras', () => {
      const mockHandler = jest.fn();
      
      // Add a handler with custom handler key
      strategy.addHandler('user.created', mockHandler, true, { handlerKey: 'UserCreatedHandler' });
      
      // Get the mapping
      const mapping = strategy.getSubjectToHandlerMapping();
      
      // Verify the mapping was stored with custom handler key
      expect(mapping.get('user.created')).toBe('UserCreatedHandler');
    });

    it('should not store mapping for non-event handlers', () => {
      const mockHandler = jest.fn();
      
      // Add a message handler (not event handler)
      strategy.addHandler('user.create', mockHandler, false);
      
      // Get the mapping
      const mapping = strategy.getSubjectToHandlerMapping();
      
      // Verify no mapping was stored
      expect(mapping.size).toBe(0);
    });

    it('should not store mapping when envelope mapping is not enabled', () => {
      // Create strategy without envelope mapping
      const subjectStrategy = new JetStream({
        servers: 'nats://localhost:4222',
        streamName: 'test-stream',
        durableName: 'test-consumer',
        // defaultMapper defaults to 'subject'
      });

      const mockHandler = jest.fn();
      
      // Add a handler for an event
      subjectStrategy.addHandler('user.created', mockHandler, true);
      
      // Get the mapping
      const mapping = subjectStrategy.getSubjectToHandlerMapping();
      
      // Verify no mapping was stored
      expect(mapping.size).toBe(0);
    });
  });

  describe('envelope mapper with subject-handler mapping', () => {
    beforeEach(() => {
      // Add some handlers to simulate real usage
      strategy.addHandler('user.events', jest.fn(), true, { handlerKey: 'UserCreatedHandler' });
      strategy.addHandler('order.events', jest.fn(), true, { handlerKey: 'OrderProcessedHandler' });
    });

    it('should use direct handler key match for backward compatibility', () => {
      const mockMessage = createMock<JsMsg>({
        subject: 'user.events',
        data: new Uint8Array(Buffer.from(JSON.stringify({
          type: 'UserCreatedHandler',
          payload: { userId: '123' },
          meta: { timestamp: Date.now() }
        })))
      });

      // Access the private codec to decode
      const codec = (strategy as any).codec;
      const decoded = codec.decode(mockMessage.data);
      
      // Access the private mapper
      const mapper = (strategy as any).options.mapper;
      const result = mapper(mockMessage, decoded);
      
      // Should use direct handler key match
      expect(result.handlerKey).toBe('UserCreatedHandler');
      expect(result.data).toEqual({ userId: '123' });
      expect(result.ctxExtras).toEqual({ timestamp: expect.any(Number) });
    });

    it('should use subject-to-handler mapping when direct match fails', () => {
      const mockMessage = createMock<JsMsg>({
        subject: 'user.events',
        data: new Uint8Array(Buffer.from(JSON.stringify({
          type: 'NonExistentHandler',
          payload: { userId: '123' },
          meta: { timestamp: Date.now() }
        })))
      });

      // Access the private codec to decode
      const codec = (strategy as any).codec;
      const decoded = codec.decode(mockMessage.data);
      
      // Access the private mapper
      const mapper = (strategy as any).options.mapper;
      const result = mapper(mockMessage, decoded);
      
      // Should use subject-to-handler mapping
      expect(result.handlerKey).toBe('UserCreatedHandler');
      expect(result.data).toEqual({ userId: '123' });
      expect(result.ctxExtras).toEqual({ timestamp: expect.any(Number) });
    });

    it('should fallback to subject-based routing when no mapping exists', () => {
      const mockMessage = createMock<JsMsg>({
        subject: 'unknown.events',
        data: new Uint8Array(Buffer.from(JSON.stringify({
          type: 'NonExistentHandler',
          payload: { data: 'test' }
        })))
      });

      // Access the private codec to decode
      const codec = (strategy as any).codec;
      const decoded = codec.decode(mockMessage.data);
      
      // Access the private mapper
      const mapper = (strategy as any).options.mapper;
      const result = mapper(mockMessage, decoded);
      
      // Should fallback to subject-based routing
      expect(result.handlerKey).toBe('unknown.events');
      expect(result.data).toEqual({
        type: 'NonExistentHandler',
        payload: { data: 'test' }
      });
    });

    it('should fallback to subject-based routing for invalid envelopes', () => {
      const mockMessage = createMock<JsMsg>({
        subject: 'user.events',
        data: new Uint8Array(Buffer.from(JSON.stringify({
          // Missing 'type' field
          payload: { userId: '123' }
        })))
      });

      // Access the private codec to decode
      const codec = (strategy as any).codec;
      const decoded = codec.decode(mockMessage.data);
      
      // Access the private mapper
      const mapper = (strategy as any).options.mapper;
      const result = mapper(mockMessage, decoded);
      
      // Should fallback to subject-based routing
      expect(result.handlerKey).toBe('user.events');
      expect(result.data).toEqual({
        payload: { userId: '123' }
      });
    });
  });
});
