#!/usr/bin/env npx tsx

import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

console.log("📋 Phase 34: Timeline Fetch Limit Tests\n");

const timelineModule = await import(
  pathToFileURL(path.join(process.cwd(), "packages/cli/src/utils/timeline.ts")).href
);
const logsModule = await import(
  pathToFileURL(path.join(process.cwd(), "packages/cli/src/commands/agent/logs.ts")).href
);
const attachModule = await import(
  pathToFileURL(path.join(process.cwd(), "packages/cli/src/commands/agent/attach.ts")).href
);
const waitModule = await import(
  pathToFileURL(path.join(process.cwd(), "packages/cli/src/commands/agent/wait.ts")).href
);

type TimelineRequest = {
  agentId: string;
  options: Record<string, unknown>;
};

const requests: TimelineRequest[] = [];
const fakeClient = {
  async fetchAgentTimeline(agentId: string, options: Record<string, unknown>) {
    requests.push({ agentId, options });
    return {
      entries: [
        {
          item: { type: "assistant_message", text: "hello" },
        },
      ],
    };
  },
};

console.log("  Testing shared projected timeline helper forwards bounded limit...");
await timelineModule.fetchProjectedTimelineItems({
  client: fakeClient,
  agentId: "agent-1",
  limit: 7,
});
assert.deepEqual(requests.at(-1), {
  agentId: "agent-1",
  options: {
    direction: "tail",
    limit: 7,
    projection: "projected",
  },
});
console.log("  ✅ Shared helper forwards explicit limit");

console.log("  Testing logs helper requests only requested tail window...");
await logsModule.fetchAgentTimelineItems(fakeClient, "agent-2", 12);
assert.equal(requests.at(-1)?.options.limit, 12);
console.log("  ✅ Logs helper uses bounded tail limit");

console.log("  Testing attach helper uses bounded warmup window...");
await attachModule.fetchAttachTimelineItems(fakeClient, "agent-3");
assert.equal(requests.at(-1)?.options.limit, attachModule.ATTACH_INITIAL_TAIL_COUNT);
console.log("  ✅ Attach helper uses bounded warmup limit");

console.log("  Testing wait helper uses preview-sized window...");
await waitModule.getRecentActivityTranscript(fakeClient, "agent-4");
assert.equal(requests.at(-1)?.options.limit, waitModule.WAIT_ACTIVITY_PREVIEW_COUNT);
console.log("  ✅ Wait helper uses preview limit");

console.log("\n✅ Phase 34: Timeline Fetch Limit Tests PASSED");
