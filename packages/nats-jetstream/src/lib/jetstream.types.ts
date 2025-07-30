import { JsMsg } from 'nats';

export interface JetStreamEnvelope<T = any> {
  type?: string;          // logical event name
  payload: T;             // actual business data
  meta?: Record<string, any>; // optional extra
}

export type JetStreamMapper = (msg: JsMsg, decoded: unknown) => {
  handlerKey: string;     // key used in `messageHandlers`
  data: any;              // payload forwarded to handler
  ctxExtras?: Record<string, any>;
};
