import { afterEach, describe, expect, it, vi } from "vitest";
import { wrapSessionMessage } from "./messages.js";

const wsModuleMock = vi.hoisted(() => {
  class MockWebSocketServer {
    readonly handlers = new Map<string, (...args: any[]) => void>();

    constructor(_options: unknown) {}

    on(event: string, handler: (...args: any[]) => void) {
      this.handlers.set(event, handler);
      return this;
    }

    close() {
      // no-op
    }
  }

  return { MockWebSocketServer };
});

vi.mock("ws", () => ({
  WebSocketServer: wsModuleMock.MockWebSocketServer,
}));

vi.mock("./session.js", () => ({
  Session: class {},
}));

vi.mock("./push/token-store.js", () => ({
  PushTokenStore: class {
    getAllTokens(): string[] {
      return [];
    }
  },
}));

vi.mock("./push/push-service.js", () => ({
  PushService: class {
    async sendPush(): Promise<void> {
      // no-op
    }
  },
}));

import { VoiceAssistantWebSocketServer } from "./websocket-server.js";

class MockSocket {
  readyState = 1;
  bufferedAmount = 0;
  sent: unknown[] = [];
  on(): void {}
  once(): void {}
  close(): void {}
  send(data: unknown): void {
    this.sent.push(data);
  }
}

function createLogger() {
  const logger = {
    child: vi.fn(() => logger),
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  return logger;
}

function createServer() {
  const logger = createLogger();
  const daemonConfigStore = {
    onChange: vi.fn(() => () => {}),
  };

  const server = new VoiceAssistantWebSocketServer(
    {} as any,
    logger as any,
    "srv-test",
    {
      setAgentAttentionCallback: vi.fn(),
      getAgent: vi.fn(() => null),
      getMetricsSnapshot: vi.fn(() => ({
        totalAgents: 0,
        idleAgents: 0,
        runningAgents: 0,
        pendingPermissionAgents: 0,
        erroredAgents: 0,
      })),
    } as any,
    {} as any,
    {} as any,
    "/tmp/paseo-test",
    daemonConfigStore as any,
    null,
    { allowedOrigins: new Set() },
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    "1.2.3-test",
    undefined,
    undefined,
    undefined,
    {} as any,
    {} as any,
    {} as any,
    {
      subscribe: vi.fn(),
      scheduleRefreshForCwd: vi.fn(),
      getMetrics: vi.fn(() => ({
        checkoutDiffTargetCount: 0,
        checkoutDiffSubscriptionCount: 0,
        checkoutDiffWatcherCount: 0,
        checkoutDiffFallbackRefreshTargetCount: 0,
      })),
      dispose: vi.fn(),
    } as any,
  );

  return { server, logger };
}

describe("VoiceAssistantWebSocketServer slow-client handling", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("drops high-frequency agent stream messages for backed-up clients", () => {
    const { server } = createServer();
    const socket = new MockSocket();
    socket.bufferedAmount = 512_000;

    (server as any).sendToClient(
      socket,
      wrapSessionMessage({
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
      }),
    );

    expect(socket.sent).toHaveLength(0);
  });

  it("preserves agent stream control events for backed-up clients", () => {
    const { server } = createServer();
    const socket = new MockSocket();
    socket.bufferedAmount = 512_000;

    (server as any).sendToClient(
      socket,
      wrapSessionMessage({
        type: "agent_stream",
        payload: {
          agentId: "agent-1",
          event: {
            type: "turn_started",
            provider: "claude",
          },
          timestamp: "2026-04-14T00:00:00.000Z",
        },
      }),
    );

    (server as any).sendToClient(
      socket,
      wrapSessionMessage({
        type: "agent_stream",
        payload: {
          agentId: "agent-1",
          event: {
            type: "attention_required",
            provider: "claude",
            reason: "permission",
            timestamp: "2026-04-14T00:00:00.500Z",
            shouldNotify: true,
          },
          timestamp: "2026-04-14T00:00:00.500Z",
        },
      }),
    );

    expect(socket.sent).toHaveLength(2);
    expect(String(socket.sent[0])).toContain('"type":"turn_started"');
    expect(String(socket.sent[1])).toContain('"type":"attention_required"');
  });

  it("still sends rpc/status messages for backed-up clients", () => {
    const { server } = createServer();
    const socket = new MockSocket();
    socket.bufferedAmount = 512_000;

    (server as any).sendToClient(
      socket,
      wrapSessionMessage({
        type: "fetch_agent_response",
        payload: {
          requestId: "req-1",
          agent: null,
          project: null,
          error: null,
        },
      }),
    );

    expect(socket.sent).toHaveLength(1);
  });

  it("reports outbound and slow-client metrics in ws_runtime_metrics", () => {
    const { server, logger } = createServer();
    const socket = new MockSocket();

    (server as any).externalSessionsByKey.set("client-1", {
      session: {
        getRuntimeMetrics: () => ({
          terminalDirectorySubscriptionCount: 0,
          terminalSubscriptionCount: 0,
          inflightRequests: 0,
          peakInflightRequests: 0,
          timelineFetchRequestCount: 2,
          timelineFetchEntriesReturned: 5,
          timelineFetchProjectedEntriesReturned: 3,
          timelineFetchBoundedRequestCount: 1,
          timelineFetchUnboundedRequestCount: 1,
        }),
        resetPeakInflight: () => {},
      },
      clientId: "client-1",
      appVersion: null,
      connectionLogger: logger,
      sockets: new Set<any>(),
      externalDisconnectCleanupTimeout: null,
    });

    (server as any).sendToClient(
      socket,
      wrapSessionMessage({
        type: "fetch_agent_response",
        payload: {
          requestId: "req-1",
          agent: null,
          project: null,
          error: null,
        },
      }),
    );

    socket.bufferedAmount = 512_000;
    (server as any).sendToClient(
      socket,
      wrapSessionMessage({
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
      }),
    );

    (server as any).flushRuntimeMetrics({ final: true });

    const runtimeMetricCall = logger.info.mock.calls.find(
      (call) => call[1] === "ws_runtime_metrics",
    );
    expect(runtimeMetricCall?.[0]).toMatchObject({
      outbound: {
        sentMessages: 1,
        sentAgentStreamMessages: 0,
        droppedAgentStreamMessages: 1,
        slowClientDropEvents: 1,
        slowClientSocketsSeen: 1,
      },
      runtime: {
        timelineFetchRequestCount: 2,
        timelineFetchEntriesReturned: 5,
        timelineFetchProjectedEntriesReturned: 3,
        timelineFetchBoundedRequestCount: 1,
        timelineFetchUnboundedRequestCount: 1,
      },
    });
    expect(runtimeMetricCall?.[0]?.outbound?.sentBytes).toBeGreaterThan(0);
    expect(runtimeMetricCall?.[0]?.outbound?.maxBufferedAmountSeen).toBeGreaterThanOrEqual(512_000);
  });
});
