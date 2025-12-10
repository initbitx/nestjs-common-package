import { DefaultConsumerNamingStrategy } from '../lib/consumer-naming.strategy';

describe('DefaultConsumerNamingStrategy', () => {
  let strategy: DefaultConsumerNamingStrategy;

  beforeEach(() => {
    strategy = new DefaultConsumerNamingStrategy();
  });

  describe('generateName', () => {
    it('should generate consistent names for the same inputs', () => {
      const name1 = strategy.generateName('test.pattern', 'test-stream', 'test-app');
      const name2 = strategy.generateName('test.pattern', 'test-stream', 'test-app');
      
      expect(name1).toBe(name2);
    });

    it('should generate different names for different patterns', () => {
      const name1 = strategy.generateName('test.pattern1', 'test-stream', 'test-app');
      const name2 = strategy.generateName('test.pattern2', 'test-stream', 'test-app');
      
      expect(name1).not.toBe(name2);
    });

    it('should generate different names for different streams', () => {
      const name1 = strategy.generateName('test.pattern', 'stream1', 'test-app');
      const name2 = strategy.generateName('test.pattern', 'stream2', 'test-app');
      
      expect(name1).not.toBe(name2);
    });

    it('should use default app name when not provided', () => {
      const name = strategy.generateName('test.pattern', 'test-stream');
      expect(name).toMatch(/^app-test-stream-/);
    });

    it('should follow the expected format', () => {
      const name = strategy.generateName('events.user.created', 'events', 'my-app');
      expect(name).toMatch(/^my-app-events-[a-z0-9]+$/);
    });
  });

  describe('validateName', () => {
    it('should validate correct consumer names', () => {
      expect(strategy.validateName('valid-name-123')).toBe(true);
      expect(strategy.validateName('valid_name_123')).toBe(true);
      expect(strategy.validateName('ValidName123')).toBe(true);
      expect(strategy.validateName('a')).toBe(true);
      expect(strategy.validateName('a'.repeat(32))).toBe(true);
    });

    it('should reject invalid consumer names', () => {
      expect(strategy.validateName('invalid name with spaces')).toBe(false);
      expect(strategy.validateName('invalid-name-with-special-chars!')).toBe(false);
      expect(strategy.validateName('invalid-name-with-@symbol')).toBe(false);
      expect(strategy.validateName('')).toBe(false);
      expect(strategy.validateName('a'.repeat(33))).toBe(false);
    });
  });
}); 