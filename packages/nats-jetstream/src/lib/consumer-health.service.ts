import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConsumerHealth, ConsumerHealthMonitoring } from './interfaces/consumer-health.interface';
import { JetStreamManager } from 'nats';
import { ConsumerHealthOptions } from './interfaces/nats-jetstream-options.interface';

/**
 * Service for monitoring JetStream consumer health
 * Provides methods to check consumer status and metrics
 */
@Injectable()
export class ConsumerHealthService implements ConsumerHealthMonitoring, OnModuleDestroy {
  private readonly logger = new Logger(ConsumerHealthService.name);
  private healthUpdateCallbacks: ((health: ConsumerHealth) => void)[] = [];
  // store health along with last updated timestamp for TTL eviction
  private healthCache = new Map<string, { health: ConsumerHealth; updatedAt: number }>();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private MONITORING_INTERVAL = 30000; // 30 seconds default, can be overridden by options

  private pendingThreshold = 1000;
  private redeliveryThreshold = 100;
  private idleTimeoutMs = 300000; // 5 minutes default
  private cacheTtlMs = 15 * 60 * 1000; // 15 minutes default

  constructor(private readonly jsm: JetStreamManager, options?: ConsumerHealthOptions) {
    // apply options
    if (options?.monitoringIntervalMs !== undefined) this.MONITORING_INTERVAL = options.monitoringIntervalMs;
    if (options?.pendingThreshold !== undefined) this.pendingThreshold = options.pendingThreshold;
    if (options?.redeliveryThreshold !== undefined) this.redeliveryThreshold = options.redeliveryThreshold;
    if (options?.idleTimeoutMs !== undefined) this.idleTimeoutMs = options.idleTimeoutMs;
    if (options?.cacheTtlMs !== undefined) this.cacheTtlMs = options.cacheTtlMs;

    // Start monitoring when service is created
    this.startMonitoring();
  }

  onModuleDestroy(): void {
    this.stopMonitoring();
  }

  /**
   * Convert various numeric representations (number | bigint | string | undefined) to a safe number
   */
  private toNumber(value: number | bigint | string | undefined, fallback = 0): number {
    if (value === undefined || value === null) return fallback;
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'string') {
      // try parse as integer
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
  }

  /**
   * Convert nanoseconds (number | bigint | string) or milliseconds to Date
   * If value looks like nanoseconds (very large), convert to ms accordingly.
   */
  private toDateFromNsOrMs(value: number | bigint | string | undefined): Date {
    if (value === undefined || value === null) return new Date();

    // Normalize to number if possible
    try {
      let asNumber: number;
      if (typeof value === 'bigint') {
        // convert nanoseconds bigint to milliseconds
        asNumber = Number(value / BigInt(1_000_000));
        return new Date(asNumber);
      }

      if (typeof value === 'string') {
        // try to detect if string represents a big integer
        if (/^\d+$/.test(value)) {
          // it's an integer string; if it's very long assume nanoseconds
          if (value.length > 15) {
            // treat as nanoseconds
            const asBigInt = BigInt(value);
            return new Date(Number(asBigInt / BigInt(1_000_000)));
          }
          const parsed = Number(value);
          return new Date(parsed);
        }

        // fallback to Date parse
        const parsedDate = Date.parse(value);
        if (!Number.isNaN(parsedDate)) return new Date(parsedDate);
        return new Date();
      }

      // number
      asNumber = value as number;
      // Heuristic: if value > 1e12 assume nanoseconds, else milliseconds/epoch
      // Use 1e15 as threshold for nanoseconds (ns since epoch ~1e18), ms since epoch ~1e12
      if (asNumber > 1e15) {
        return new Date(Math.floor(asNumber / 1_000_000));
      }
      return new Date(asNumber);
    } catch (err) {
      this.logger.warn('Failed to convert timestamp to Date, using now');
      return new Date();
    }
  }

  /**
   * Start periodic health monitoring
   */
  private startMonitoring(): void {
    if (this.monitoringInterval) {
      return;
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.updateAllConsumersHealth();
      } catch (error) {
        this.logger.error(`Error updating consumer health: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }, this.MONITORING_INTERVAL);
  }

  /**
   * Stop health monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Update health information for all consumers
   */
  private async updateAllConsumersHealth(): Promise<void> {
    try {
      const streams = await this.jsm.streams.list();

      for await (const stream of streams) {
        if (!stream.config?.name) continue;

        const consumers = await this.jsm.consumers.list(stream.config.name);

        for await (const consumer of consumers) {
          if (!consumer.name) continue;

          try {
            const info = await this.jsm.consumers.info(stream.config.name, consumer.name);

            const deliveredSeq = this.toNumber(info.delivered?.consumer_seq);
            const ackedSeq = this.toNumber(info.ack_floor?.consumer_seq);
            const waiting = this.toNumber(info.num_waiting);
            const pending = this.toNumber(info.num_pending);
            const redelivered = this.toNumber(info.num_redelivered);
            const lastActivity = this.toDateFromNsOrMs(info.delivered?.last_active);

            const health: ConsumerHealth = {
              name: consumer.name,
              streamName: stream.config.name,
              delivered: deliveredSeq,
              acknowledged: ackedSeq,
              waiting: waiting,
              pendingAcks: pending,
              redelivered: redelivered,
              lastActivity: lastActivity,
              status: 'active'
            };

            // Determine status based on metrics
            if (pending > this.pendingThreshold || redelivered > this.redeliveryThreshold) {
              health.status = 'error';
              health.errorMessage = 'High number of pending messages or redeliveries';
            } else if (Date.now() - health.lastActivity.getTime() > 300000) { // 5 minutes
              health.status = 'idle';
            }

            // Update cache
            const cacheKey = `${stream.config.name}:${consumer.name}`;
            this.healthCache.set(cacheKey, { health, updatedAt: Date.now() });

            // Notify callbacks
            this.notifyHealthUpdate(health);
          } catch (error) {
            this.logger.error(`Error getting consumer info for ${consumer.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);

            // Create error health entry
            const errorHealth: ConsumerHealth = {
              name: consumer.name,
              streamName: stream.config.name,
              delivered: 0,
              acknowledged: 0,
              waiting: 0,
              pendingAcks: 0,
              redelivered: 0,
              lastActivity: new Date(),
              status: 'error',
              errorMessage: error instanceof Error ? error.message : 'Unknown error'
            };

            const cacheKey = `${stream.config.name}:${consumer.name}`;
            this.healthCache.set(cacheKey, { health: errorHealth, updatedAt: Date.now() });

            this.notifyHealthUpdate(errorHealth);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error listing streams: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Notify all registered callbacks about health updates
   */
  private notifyHealthUpdate(health: ConsumerHealth): void {
    for (const callback of this.healthUpdateCallbacks.slice()) {
      try {
        callback(health);
      } catch (error) {
        this.logger.error(`Error in health update callback: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Get health information for all consumers
   */
  public async getAllConsumersHealth(): Promise<ConsumerHealth[]> {
    // Force update if cache is empty
    if (this.healthCache.size === 0) {
      await this.updateAllConsumersHealth();
    }

    // prune expired entries
    const now = Date.now();
    for (const [key, entry] of this.healthCache.entries()) {
      if (now - entry.updatedAt > this.cacheTtlMs) this.healthCache.delete(key);
    }

    return Array.from(this.healthCache.values()).map(e => e.health);
  }

  /**
   * Get health information for a specific consumer
   * @param consumerName Name of the consumer
   * @param streamName Name of the stream
   */
  public async getConsumerHealth(consumerName: string, streamName: string): Promise<ConsumerHealth | null> {
    const cacheKey = `${streamName}:${consumerName}`;

    // Check cache first
    const cached = this.healthCache.get(cacheKey);
    if (cached && (Date.now() - cached.updatedAt) <= this.cacheTtlMs) {
      return cached.health;
    }

    // If not in cache, try to get directly
    try {
      const info = await this.jsm.consumers.info(streamName, consumerName);

      const deliveredSeq = this.toNumber(info.delivered?.consumer_seq);
      const ackedSeq = this.toNumber(info.ack_floor?.consumer_seq);
      const waiting = this.toNumber(info.num_waiting);
      const pending = this.toNumber(info.num_pending);
      const redelivered = this.toNumber(info.num_redelivered);
      const lastActivity = this.toDateFromNsOrMs(info.delivered?.last_active);

      const health: ConsumerHealth = {
        name: consumerName,
        streamName: streamName,
        delivered: deliveredSeq,
        acknowledged: ackedSeq,
        waiting: waiting,
        pendingAcks: pending,
        redelivered: redelivered,
        lastActivity: lastActivity,
        status: 'active'
      };

      // Determine status based on metrics
      if (pending > this.pendingThreshold || redelivered > this.redeliveryThreshold) {
        health.status = 'error';
        health.errorMessage = 'High number of pending messages or redeliveries';
      } else if (Date.now() - health.lastActivity.getTime() > 300000) { // 5 minutes
        health.status = 'idle';
      }

      // Update cache
      this.healthCache.set(cacheKey, { health, updatedAt: Date.now() });

      return health;
    } catch (error) {
      this.logger.error(`Error getting consumer info for ${consumerName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Register a callback to be called when consumer health changes
   * @param callback Function to be called with updated health information
   */
  public onHealthUpdate(callback: (health: ConsumerHealth) => void): () => void {
    this.healthUpdateCallbacks.push(callback);
    // Return unsubscribe function
    return () => {
      const idx = this.healthUpdateCallbacks.indexOf(callback);
      if (idx >= 0) this.healthUpdateCallbacks.splice(idx, 1);
    };
  }

  /**
   * Check if a consumer is healthy
   * @param consumerName Name of the consumer
   * @param streamName Name of the stream
   */
  public async isConsumerHealthy(consumerName: string, streamName: string): Promise<boolean> {
    const health = await this.getConsumerHealth(consumerName, streamName);
    return health !== null && health.status === 'active';
  }
}
