import { JsMsg, Msg, MsgHdrs } from "nats";

import { NatsContext } from "../lib/nats.context";

import { createMock } from "@golevelup/ts-jest";

describe("NatsContext", () => {
  it("should return message headers", () => {
    const headers = createMock<MsgHdrs>();

    const message = createMock<Msg>({
      headers
    });

    const context = new NatsContext([message]);

    expect(context.getHeaders()).toStrictEqual(headers);
  });

  it("should return message object", () => {
    const message = createMock<Msg>();

    const context = new NatsContext([message]);

    expect(context.getMessage()).toStrictEqual(message);
  });

  it("should return message subject", () => {
    const subject = "my-subject";

    const message = createMock<Msg>({
      subject
    });

    const context = new NatsContext([message]);

    expect(context.getSubject()).toStrictEqual(subject);
  });

  describe("JetStream methods", () => {
    it("should detect JetStream message", () => {
      const jsMessage = createMock<JsMsg>({
        ack: jest.fn()
      });

      const regularMessage = createMock<Msg>();

      const jsContext = new NatsContext([jsMessage]);
      const regularContext = new NatsContext([regularMessage]);

      expect(jsContext.isJetStream()).toBe(true);
      expect(regularContext.isJetStream()).toBe(false);
    });

    it("should call ack on JetStream message", () => {
      const ackFn = jest.fn();
      const jsMessage = createMock<JsMsg>({
        ack: ackFn
      });

      const context = new NatsContext([jsMessage]);
      context.ack();

      expect(ackFn).toHaveBeenCalledTimes(1);
    });

    it("should throw error when calling ack on non-JetStream message", () => {
      const regularMessage = createMock<Msg>();
      const context = new NatsContext([regularMessage]);

      expect(() => context.ack()).toThrow('Cannot acknowledge a non-JetStream message');
    });

    it("should call nack on JetStream message", () => {
      const nakFn = jest.fn();
      const jsMessage = createMock<JsMsg>({
        nak: nakFn,
        ack: jest.fn() // Add ack property so isJetStream() returns true
      });

      const context = new NatsContext([jsMessage]);
      context.nack();

      expect(nakFn).toHaveBeenCalledTimes(1);
    });

    it("should throw error when calling nack on non-JetStream message", () => {
      const regularMessage = createMock<Msg>();
      const context = new NatsContext([regularMessage]);

      expect(() => context.nack()).toThrow('Cannot negative acknowledge a non-JetStream message');
    });

    it("should call term on JetStream message", () => {
      const termFn = jest.fn();
      const jsMessage = createMock<JsMsg>({
        term: termFn,
        ack: jest.fn() // Add ack property so isJetStream() returns true
      });

      const context = new NatsContext([jsMessage]);
      context.term();

      expect(termFn).toHaveBeenCalledTimes(1);
    });

    it("should throw error when calling term on non-JetStream message", () => {
      const regularMessage = createMock<Msg>();
      const context = new NatsContext([regularMessage]);

      expect(() => context.term()).toThrow('Cannot terminate a non-JetStream message');
    });

    it("should call working on JetStream message", () => {
      const workingFn = jest.fn();
      const jsMessage = createMock<JsMsg>({
        working: workingFn,
        ack: jest.fn() // Add ack property so isJetStream() returns true
      });

      const context = new NatsContext([jsMessage]);
      context.working();

      expect(workingFn).toHaveBeenCalledTimes(1);
    });

    it("should throw error when calling working on non-JetStream message", () => {
      const regularMessage = createMock<Msg>();
      const context = new NatsContext([regularMessage]);

      expect(() => context.working()).toThrow('Cannot mark a non-JetStream message as working');
    });

    it("should return metadata from JetStream message", () => {
      const metadata = { stream: 'test-stream', consumer: 'test-consumer' };
      const jsMessage = createMock<JsMsg>({
        info: metadata,
        ack: jest.fn() // Add ack property so isJetStream() returns true
      });

      const context = new NatsContext([jsMessage]);
      expect(context.getMetadata()).toEqual(metadata);
    });

    it("should throw error when getting metadata from non-JetStream message", () => {
      const regularMessage = createMock<Msg>();
      const context = new NatsContext([regularMessage]);

      expect(() => context.getMetadata()).toThrow('Cannot get metadata from a non-JetStream message');
    });
  });
});
