import { Codec, ConnectionOptions } from "nats";
import { LoggerService } from "@nestjs/common";

export interface NatsClientOptions {
  /**
   * NATS codec to use for encoding and decoding messages
   */
  codec?: Codec<unknown>;

  /**
   * NATS connection options
   */
  connection?: ConnectionOptions;

  /**
   * Logger service to use for logging
   */
  logger?: LoggerService;
}
