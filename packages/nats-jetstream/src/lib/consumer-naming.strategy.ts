/**
 * Interface for consumer naming strategies
 */
export interface ConsumerNamingStrategy {
  /**
   * Generate a consumer name based on pattern, stream name, and app name
   */
  generateName(pattern: string, streamName: string, appName?: string): string;
  
  /**
   * Validate a consumer name according to NATS rules
   */
  validateName(name: string): boolean;
}

/**
 * Default consumer naming strategy implementation
 */
export class DefaultConsumerNamingStrategy implements ConsumerNamingStrategy {
  /**
   * Generate a consumer name using the format: {appName}-{streamName}-{patternHash}
   */
  generateName(pattern: string, streamName: string, appName: string = 'app'): string {
    const patternHash = this.hashPattern(pattern);
    return `${appName}-${streamName}-${patternHash}`;
  }
  
  /**
   * Validate consumer name according to NATS rules
   * - Only alphanumeric characters, hyphens, and underscores
   * - Maximum 32 characters
   */
  validateName(name: string): boolean {
    return /^[a-zA-Z0-9_-]+$/.test(name) && name.length <= 32;
  }
  
  /**
   * Simple hash function for pattern to generate consistent hash
   */
  private hashPattern(pattern: string): string {
    let hash = 0;
    for (let i = 0; i < pattern.length; i++) {
      const char = pattern.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
} 