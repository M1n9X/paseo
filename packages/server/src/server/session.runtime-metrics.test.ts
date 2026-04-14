import { describe, expect, test, vi } from "vitest";
import { Session } from "./session.js";

function createSessionForRuntimeMetricsTests() {
  const logger = {
    child: () => logger,
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  return new Session({
    clientId: "test-client",
    appVersion: null,
    onMessage: vi.fn(),
    logger: logger as any,
    downloadTokenStore: {} as any,
    pushTokenStore: {} as any,
    paseoHome: "/tmp/paseo-test",
    agentManager: {
      subscribe: () => () => {},
      getAgent: () => null,
      fetchTimeline: vi.fn(),
      listAgents: () => [],
    } as any,
    agentStorage: {
      list: async () => [],
      get: async () => null,
    } as any,
    projectRegistry: {
      initialize: async () => {},
      existsOnDisk: async () => true,
      list: async () => [],
      get: async () => null,
      upsert: async () => {},
      archive: async () => {},
      remove: async () => {},
    } as any,
    workspaceRegistry: {
      initialize: async () => {},
      existsOnDisk: async () => true,
      list: async () => [],
      get: async () => null,
      upsert: async () => {},
      archive: async () => {},
      remove: async () => {},
    } as any,
    chatService: {} as any,
    scheduleService: {} as any,
    loopService: {} as any,
    checkoutDiffManager: {
      getMetrics: () => ({
        checkoutDiffTargetCount: 0,
        checkoutDiffSubscriptionCount: 0,
        checkoutDiffWatcherCount: 0,
        checkoutDiffFallbackRefreshTargetCount: 0,
      }),
    } as any,
    workspaceGitService: {
      subscribe: async () => ({
        initial: null,
        unsubscribe: () => {},
      }),
      peekSnapshot: () => null,
      getSnapshot: async () => null,
      refresh: async () => {},
      dispose: () => {},
    } as any,
    daemonConfigStore: {
      onChange: () => () => {},
    } as any,
  });
}

describe("Session runtime metrics", () => {
  test("tracks timeline fetch request and entry counts", async () => {
    const session = createSessionForRuntimeMetricsTests();
    (session as any).ensureAgentLoaded = vi.fn(async () => ({
      id: "agent-1",
      provider: "claude",
    }));
    (session as any).buildAgentPayload = vi.fn(async () => ({
      id: "agent-1",
      provider: "claude",
      cwd: "/tmp/project",
      model: null,
      thinkingOptionId: null,
      effectiveThinkingOptionId: null,
      createdAt: "2026-04-14T00:00:00.000Z",
      updatedAt: "2026-04-14T00:00:00.000Z",
      lastUserMessageAt: null,
      status: "idle",
      capabilities: {
        supportsStreaming: true,
        supportsSessionPersistence: true,
        supportsDynamicModes: true,
        supportsMcpServers: true,
        supportsReasoningStream: true,
        supportsToolInvocations: true,
      },
      currentModeId: null,
      availableModes: [],
      pendingPermissions: [],
      persistence: null,
      runtimeInfo: null,
      title: null,
      labels: {},
      requiresAttention: false,
      attentionReason: null,
      attentionTimestamp: null,
      archivedAt: null,
    }));
    (session as any).agentManager.fetchTimeline = vi
      .fn()
      .mockReturnValueOnce({
        epoch: "epoch-1",
        direction: "tail",
        reset: false,
        staleCursor: false,
        gap: false,
        window: { minSeq: 1, maxSeq: 2, nextSeq: 3 },
        hasOlder: false,
        hasNewer: false,
        rows: [
          {
            seq: 1,
            timestamp: "2026-04-14T00:00:00.000Z",
            item: { type: "assistant_message", text: "hello" },
          },
          {
            seq: 2,
            timestamp: "2026-04-14T00:00:01.000Z",
            item: { type: "assistant_message", text: "world" },
          },
        ],
      })
      .mockReturnValueOnce({
        epoch: "epoch-1",
        direction: "tail",
        reset: false,
        staleCursor: false,
        gap: false,
        window: { minSeq: 1, maxSeq: 1, nextSeq: 2 },
        hasOlder: false,
        hasNewer: false,
        rows: [
          {
            seq: 1,
            timestamp: "2026-04-14T00:00:00.000Z",
            item: { type: "assistant_message", text: "hello" },
          },
        ],
      });

    await (session as any).handleFetchAgentTimelineRequest({
      type: "fetch_agent_timeline_request",
      requestId: "req-1",
      agentId: "agent-1",
      projection: "projected",
      limit: 5,
    });
    await (session as any).handleFetchAgentTimelineRequest({
      type: "fetch_agent_timeline_request",
      requestId: "req-2",
      agentId: "agent-1",
      projection: "canonical",
    });

    expect(session.getRuntimeMetrics()).toMatchObject({
      timelineFetchRequestCount: 2,
      timelineFetchEntriesReturned: 2,
      timelineFetchProjectedEntriesReturned: 1,
      timelineFetchBoundedRequestCount: 1,
      timelineFetchUnboundedRequestCount: 1,
    });
  });

  test("resets timeline fetch metrics when runtime window resets", () => {
    const session = createSessionForRuntimeMetricsTests();
    (session as any).timelineFetchRequestCount = 3;
    (session as any).timelineFetchEntriesReturned = 9;
    (session as any).timelineFetchProjectedEntriesReturned = 7;
    (session as any).timelineFetchBoundedRequestCount = 2;
    (session as any).timelineFetchUnboundedRequestCount = 1;

    session.resetPeakInflight();

    expect(session.getRuntimeMetrics()).toMatchObject({
      timelineFetchRequestCount: 0,
      timelineFetchEntriesReturned: 0,
      timelineFetchProjectedEntriesReturned: 0,
      timelineFetchBoundedRequestCount: 0,
      timelineFetchUnboundedRequestCount: 0,
    });
  });
});
