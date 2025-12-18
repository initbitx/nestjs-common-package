import {
  JetStreamManager,
  StreamConfig,
  ConsumerConfig,
  AckPolicy,
  DeliverPolicy,
  ReplayPolicy,
  RetentionPolicy,
  StorageType,
  DiscardPolicy,
  createInbox
} from 'nats';
import { StreamOptions, MultiStreamOptions, ConsumerOptions } from './interfaces/nats-jetstream-options.interface';
import { LoggerService } from '@nestjs/common';

/**
 * Result of stream registration operation
 */
export interface StreamRegistrationResult {
  streamName: string;
  success: boolean;
  error?: string;
}

/**
 * Manages multiple streams and their consumers
 */
export class StreamManager {
  constructor(
    private readonly jsm: JetStreamManager,
    private readonly logger: LoggerService
  ) {}

  /**
   * Register multiple streams based on configuration
   */
  async registerStreams(multiStreamOptions: MultiStreamOptions): Promise<StreamRegistrationResult[]> {
    const results: StreamRegistrationResult[] = [];

    if (multiStreamOptions.asyncRegistration) {
      // Register streams asynchronously
      const promises = multiStreamOptions.streams.map(stream =>
        this.registerSingleStream(stream)
      );

      const streamResults = await Promise.allSettled(promises);

      streamResults.forEach((result, index) => {
        const streamName = multiStreamOptions.streams[index].name || 'unknown';
        if (result.status === 'fulfilled') {
          // The fulfilled value may indicate success or failure. Respect the returned success flag.
          const value = result.value as StreamRegistrationResult;
          if (value && value.success === false) {
            results.push({ streamName: value.streamName || streamName, success: false, error: value.error });
          } else {
            results.push({ streamName: value?.streamName || streamName, success: true });
          }
        } else {
          results.push({
            streamName,
            success: false,
            error: result.reason?.message || 'Unknown error'
          });
        }
      });
    } else {
      // Register streams synchronously
      for (const stream of multiStreamOptions.streams) {
        const result = await this.registerSingleStream(stream);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Get stream name for a specific pattern
   */
  getStreamForPattern(pattern: string, multiStreamOptions: MultiStreamOptions): string {
    // Check pattern-to-stream mapping first
    if (multiStreamOptions.patternToStream?.has(pattern)) {
      return multiStreamOptions.patternToStream.get(pattern)!;
    }

    // Fall back to default stream
    return multiStreamOptions.defaultStream || multiStreamOptions.streams[0]?.name || 'default';
  }

  /**
   * Get consumer options for a specific stream
   */
  getConsumerOptionsForStream(streamName: string, multiStreamOptions: MultiStreamOptions): ConsumerOptions | undefined {
    return multiStreamOptions.streamConsumers?.get(streamName);
  }

  /**
   * Try to locate an existing stream whose subjects overlap with the provided subjects
   */
  private async findStreamBySubjectsOverlap(subjects: string[] | undefined): Promise<string | undefined> {
    if (!subjects || subjects.length === 0) return undefined;

    try {
      const listIter = this.jsm.streams.list();
      for await (const s of listIter) {
        if (!s || !s.config || !s.config.subjects) continue;
        const existingSubjects = s.config.subjects || [];
        // Simple overlap check: if any subject strings are equal or one is wildcard-match of the other
        for (const subj of subjects) {
          for (const ex of existingSubjects) {
            // Check equality
            if (subj === ex) return s.config.name;
            // Convert ex wildcard to regex and test subj
            const regexStr = ex.replace(/\./g, '\\.').replace(/\*/g, '[^.]+').replace(/>/g, '.*');
            try {
              const regex = new RegExp(`^${regexStr}$`);
              if (regex.test(subj)) return s.config.name;
            } catch (_) {
              // ignore regex errors
            }
            // Also test reverse: subj may be wildcard and match existing subject
            const subjRegexStr = subj.replace(/\./g, '\\.').replace(/\*/g, '[^.]+').replace(/>/g, '.*');
            try {
              const subjRegex = new RegExp(`^${subjRegexStr}$`);
              if (subjRegex.test(ex)) return s.config.name;
            } catch (_) {
              // ignore
            }
          }
        }
      }
    } catch (err) {
      this.logger.error(`Error searching for overlapping streams: ${err instanceof Error ? err.message : String(err)}`);
    }

    return undefined;
  }

  /**
   * Create consumers for all streams in the configuration
   */
  async createStreamConsumers(multiStreamOptions: MultiStreamOptions): Promise<void> {
    for (const stream of multiStreamOptions.streams) {
      let streamName = stream.name || 'default';

      // Ensure stream exists; if not, attempt to find an overlapping existing stream and use that instead
      try {
        await this.jsm.streams.info(streamName);
      } catch (err) {
        const overlapping = await this.findStreamBySubjectsOverlap(stream.subjects);
        if (overlapping) {
          this.logger.log(`Stream "${streamName}" not found; mapping consumers to overlapping existing stream "${overlapping}"`);
          streamName = overlapping;
        }
      }

      const consumerOptions = this.getConsumerOptionsForStream(streamName, multiStreamOptions);

      if (consumerOptions) {
        await this.createConsumerForStream(streamName, consumerOptions);
      }
    }
  }

  /**
   * Register a single stream
   */
  private async registerSingleStream(streamOptions: StreamOptions): Promise<StreamRegistrationResult> {
    const streamName = streamOptions.name || 'default';

    try {
      const streamConfig: StreamConfig = {
        name: streamName,
        subjects: streamOptions.subjects || ['*'],
        retention: RetentionPolicy.Limits,
        storage: StorageType.File,
        max_consumers: 0,
        sealed: false,
        first_seq: 0,
        max_msgs_per_subject: 0,
        max_msgs: 0,
        max_age: 0,
        max_bytes: 0,
        max_msg_size: 0,
        discard: DiscardPolicy.Old,
        discard_new_per_subject: false,
        duplicate_window: 0,
        allow_rollup_hdrs: false,
        num_replicas: 0,
        deny_delete: false,
        deny_purge: false,
        allow_direct: false,
        mirror_direct: false
      };

      if (streamOptions.description) {
        streamConfig.description = streamOptions.description;
      }

      // Check if stream exists
      try {
        await this.jsm.streams.info(streamName);
        await this.jsm.streams.update(streamName, streamConfig);
        this.logger.log(`Stream "${streamName}" updated.`);
      } catch (error: any) {
        try {
          await this.jsm.streams.add(streamConfig);
          this.logger.log(`Stream "${streamName}" created.`);
        } catch (addError: any) {
          // If the error is due to subject overlap, attempt to find the existing overlapping stream
          if (addError && addError.message && /overlap/i.test(addError.message)) {
            this.logger.warn(`Stream "${streamName}" not created due to subject overlap: ${addError.message}`);
            const overlapping = await this.findStreamBySubjectsOverlap(streamConfig.subjects as string[]);
            if (overlapping) {
              this.logger.log(`Found overlapping existing stream "${overlapping}" for requested stream "${streamName}". Will use existing stream.`);
              // Ensure overlapping stream includes requested subjects to allow consumers filtering
              try {
                const existing = await this.jsm.streams.info(overlapping);
                const existingSubjects: string[] = existing?.config?.subjects || [];
                const requestedSubjects: string[] = streamConfig.subjects || [];
                const missing = requestedSubjects.filter(s => !existingSubjects.includes(s));
                if (missing.length > 0) {
                  const updated = { ...existing.config, subjects: [...new Set([...existingSubjects, ...missing])] };
                  await this.jsm.streams.update(overlapping, updated);
                  this.logger.log(`Updated overlapping stream "${overlapping}" with additional subjects: ${missing.join(', ')}`);
                }
              } catch (updateErr) {
                this.logger.warn(`Failed to update overlapping stream "${overlapping}" subjects: ${updateErr instanceof Error ? updateErr.message : String(updateErr)}`);
              }
               return { streamName: overlapping, success: true };
             }
             // If we couldn't find an overlapping stream, return failure with the addError message
             return { streamName, success: false, error: addError.message };
           }
          // Re-throw non-overlap errors to be caught by outer catch
          throw addError;
        }
      }

      return { streamName, success: true };
    } catch (error: any) {
      this.logger.error(`Error creating/updating stream "${streamName}": ${error.message}`);
      return { streamName, success: false, error: error.message };
    }
  }

  /**
   * Create a consumer for a specific stream
   */
  private async createConsumerForStream(streamName: string, consumerOptions: ConsumerOptions): Promise<void> {
    try {
      const consumerConfig: ConsumerConfig = {
        ack_policy: consumerOptions.ack_policy || AckPolicy.Explicit,
        deliver_policy: consumerOptions.deliver_policy || DeliverPolicy.All,
        replay_policy: consumerOptions.replay_policy || ReplayPolicy.Original
      };

      // Set consumer name (separate from durable_name if provided)
      if (consumerOptions.name) {
        (consumerConfig as any).name = consumerOptions.name;
      }

      // For multi-stream setup, use push-based consumers with deliver_subject
      // Generate a unique deliver subject for this consumer
      const deliverSubject = createInbox();

      // Add durable_name if this is a durable consumer
      if (consumerOptions.durable !== false && consumerOptions.name) {
        consumerConfig.durable_name = consumerOptions.name;
        // Even durable consumers need deliver_subject for push-based delivery
        consumerConfig.deliver_subject = deliverSubject;
      } else {
        // For non-durable consumers, we always need a deliver_subject
        consumerConfig.deliver_subject = deliverSubject;
      }

      // Add ackWait if specified
      if (consumerOptions.ack_wait !== undefined) {
        consumerConfig.ack_wait = consumerOptions.ack_wait * 1_000_000; // Convert to nanoseconds
      }

      // Add filterSubject if specified
      if (consumerOptions.filter_subject) {
        consumerConfig.filter_subject = consumerOptions.filter_subject;
      }

      // Add filterSubjects if specified
      if (consumerOptions.filter_subjects && consumerOptions.filter_subjects.length > 0) {
        consumerConfig.filter_subjects = consumerOptions.filter_subjects;
      }

      // Apply additional consumer options, excluding fields already handled
      const {
        durable: _,
        name: __,
        deliver_subject: ___,
        ack_policy: ____,
        deliver_policy: _____,
        replay_policy: ______,
        ack_wait: _______,
        filter_subject: ________,
        filter_subjects: _________,
        max_waiting: __________,  // Exclude max_waiting (only valid for pull-based consumers)
        ...restOptions
      } = consumerOptions;

      Object.assign(consumerConfig, restOptions);

      // Note: max_waiting is only valid for pull-based consumers and is excluded above
      // backoff is valid for both push and pull consumers, so it's included in restOptions

      // Create or update the consumer
      try {
        if (consumerOptions.durable !== false && consumerOptions.name) {
          await this.jsm.consumers.info(streamName, consumerOptions.name);
          await this.jsm.consumers.update(streamName, consumerOptions.name, consumerConfig);
          this.logger.log(`Durable consumer "${consumerOptions.name}" updated for stream "${streamName}".`);
        } else {
          await this.jsm.consumers.add(streamName, consumerConfig);
          this.logger.log(`Ephemeral consumer created for stream "${streamName}".`);
        }
      } catch (error) {
        // Consumer doesn't exist, create it
        await this.jsm.consumers.add(streamName, consumerConfig);
        this.logger.log(`Consumer created for stream "${streamName}".`);
      }
    } catch (error: any) {
      this.logger.error(`Error creating consumer for stream "${streamName}": ${error.message}`);
    }
  }
}
