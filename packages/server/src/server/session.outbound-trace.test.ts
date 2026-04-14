import { describe, expect, it } from "vitest";
import { getOutboundTracePayloadBytes } from "./session.js";

describe("getOutboundTracePayloadBytes", () => {
  it("skips payload serialization for high-frequency agent stream messages", () => {
    expect(
      getOutboundTracePayloadBytes({
        type: "agent_stream",
        payload: {
          agentId: "agent-1",
          event: {
            type: "timeline",
            provider: "claude",
            item: { type: "assistant_message", text: "hello" },
          },
          timestamp: "2026-04-14T00:00:00.000Z",
        },
      } as any),
    ).toBeNull();
  });

  it("keeps payload size logging for request-response style messages", () => {
    expect(
      getOutboundTracePayloadBytes({
        type: "fetch_agent_response",
        payload: {
          requestId: "req-1",
          agent: null,
          project: null,
          error: null,
        },
      } as any),
    ).toBeGreaterThan(0);
  });
});
