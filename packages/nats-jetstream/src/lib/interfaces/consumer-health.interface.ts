/**
 * Interface for consumer health monitoring
 * Provides hooks and metrics for monitoring JetStream consumer health
 */
export interface ConsumerHealth {
  /**
   * Consumer name
   */
  name: string;

  /**
   * Stream name
   */
  streamName: string;

  /**
   * Number of messages delivered
   */
  delivered: number;

  /**
   * Number of messages acknowledged
   */
  acknowledged: number;

  /**
   * Number of messages waiting to be processed
   */
  waiting: number;

  /**
   * Number of pending acknowledgments
   */
  pendingAcks: number;

  /**
   * Number of redeliveries due to lack of acknowledgment
   */
  redelivered: number;

  /**
   * Last activity timestamp
   */
  lastActivity: Date;

  /**
   * Consumer status (active, idle, error)
   */
  status: 'active' | 'idle' | 'error';

  /**
   * Error message if status is 'error'
   */
  errorMessage?: string;
}

/**
 * Interface for consumer health monitoring hooks
 */
export interface ConsumerHealthMonitoring {
  /**
   * Get health information for all consumers
   */
  getAllConsumersHealth(): Promise<ConsumerHealth[]>;

  /**
   * Get health information for a specific consumer
   * @param consumerName Name of the consumer
   * @param streamName Name of the stream
   */
  getConsumerHealth(consumerName: string, streamName: string): Promise<ConsumerHealth | null>;

  /**
   * Register a callback to be called when consumer health changes
   * @param callback Function to be called with updated health information
   * @returns unsubscribe function to remove the callback
   */
  onHealthUpdate(callback: (health: ConsumerHealth) => void): () => void;

  /**
   * Check if a consumer is healthy
   * @param consumerName Name of the consumer
   * @param streamName Name of the stream
   */
  isConsumerHealthy(consumerName: string, streamName: string): Promise<boolean>;
}
