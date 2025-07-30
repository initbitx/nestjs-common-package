import { BaseRpcContext } from "@nestjs/microservices/ctx-host/base-rpc.context";

import { JsMsg, Msg, MsgHdrs } from "nats";

type NatsContextArgs = [JsMsg | Msg, Record<string, any> | undefined];

export class NatsContext extends BaseRpcContext<NatsContextArgs> {
  private extras?: Record<string, any>;
  constructor(args: NatsContextArgs) {
    super(args);
    this.extras = args[1];
  }

  /**
   * Returns message headers (if exist).
   */
  getHeaders(): MsgHdrs | undefined {
    return this.args[0].headers;
  }

  /**
   * Returns the message object.
   */
  getMessage(): JsMsg | Msg {
    return this.args[0];
  }

  /**
   * Returns the name of the subject.
   */
  getSubject(): string {
    return this.args[0].subject;
  }

  /**
   * Checks if the message is a JetStream message.
   */
  isJetStream(): boolean {
    return 'ack' in this.args[0];
  }

  /**
   * Acknowledges the message (JetStream only).
   * @throws Error if the message is not a JetStream message
   */
  ack(): void {
    if (!this.isJetStream()) {
      throw new Error('Cannot acknowledge a non-JetStream message');
    }
    (this.args[0] as JsMsg).ack();
  }

  /**
   * Negative acknowledges the message, indicating it should be redelivered (JetStream only).
   * @throws Error if the message is not a JetStream message
   */
  nack(): void {
    if (!this.isJetStream()) {
      throw new Error('Cannot negative acknowledge a non-JetStream message');
    }
    (this.args[0] as JsMsg).nak();
  }

  /**
   * Terminates the message, indicating it should not be redelivered (JetStream only).
   * @throws Error if the message is not a JetStream message
   */
  term(): void {
    if (!this.isJetStream()) {
      throw new Error('Cannot terminate a non-JetStream message');
    }
    (this.args[0] as JsMsg).term();
  }

  /**
   * Marks the message as being worked on, extending the ack wait time (JetStream only).
   * @throws Error if the message is not a JetStream message
   */
  working(): void {
    if (!this.isJetStream()) {
      throw new Error('Cannot mark a non-JetStream message as working');
    }
    (this.args[0] as JsMsg).working();
  }

  /**
   * Returns the JetStream message metadata (JetStream only).
   * @throws Error if the message is not a JetStream message
   */
  getMetadata(): any {
    if (!this.isJetStream()) {
      throw new Error('Cannot get metadata from a non-JetStream message');
    }
    return (this.args[0] as JsMsg).info;
  }

  /**
   * Returns the extras object.
   */
  getExtras(): Record<string, any> | undefined {
    return this.extras;
  }
}
