#!/usr/bin/env npx tsx

import assert from "node:assert/strict";

console.log("📋 Phase 34: Timeline Fetch Limit Tests\n");

const timelineModule = await import(new URL("../src/utils/timeline.ts", import.meta.url).href);
const logsModule = await import(new URL("../src/commands/agent/logs.ts", import.meta.url).href);
const attachModule = await import(new URL("../src/commands/agent/attach.ts", import.meta.url).href);
const waitModule = await import(new URL("../src/commands/agent/wait.ts", import.meta.url).href);

type TimelineRequest = {
  agentId: string;
  options: Record<string, unknown>;
};

const requests: TimelineRequest[] = [];
const timelineEntries = Array.from({ length: 50 }, (_, index) => ({
  item: {
    type: "assistant_message" as const,
    text: `message-${index + 1}`,
  },
}));

const fakeClient = {
  async fetchAgentTimeline(agentId: string, options: Record<string, unknown>) {
    requests.push({ agentId, options });
    return {
      entries: timelineEntries,
    };
  },
};

console.log("  Testing shared projected timeline helper fetches projected history unbounded...");
const sharedItems = await timelineModule.fetchProjectedTimelineItems({
  client: fakeClient,
  agentId: "agent-1",
  limit: 7,
});
assert.deepEqual(requests.at(-1), {
  agentId: "agent-1",
  options: {
    direction: "tail",
    limit: 0,
    projection: "projected",
  },
});
assert.deepEqual(
  sharedItems.map((item: { text: string }) => item.text),
  timelineEntries.slice(-7).map((entry) => entry.item.text),
);
console.log("  ✅ Shared helper fetches unbounded projected history and tails locally");

console.log("  Testing logs helper tails projected items locally...");
const logItems = await logsModule.fetchAgentTimelineItems(fakeClient, "agent-2", 12);
assert.equal(requests.at(-1)?.options.limit, 0);
assert.deepEqual(
  logItems.map((item: { text: string }) => item.text),
  timelineEntries.slice(-12).map((entry) => entry.item.text),
);
console.log("  ✅ Logs helper tails projected items locally");

console.log("  Testing attach helper trims warmup output locally...");
const attachItems = await attachModule.fetchAttachTimelineItems(fakeClient, "agent-3");
assert.equal(requests.at(-1)?.options.limit, 0);
assert.equal(attachItems.length, attachModule.ATTACH_INITIAL_TAIL_COUNT);
assert.deepEqual(
  attachItems.map((item: { text: string }) => item.text),
  timelineEntries.slice(-attachModule.ATTACH_INITIAL_TAIL_COUNT).map((entry) => entry.item.text),
);
console.log("  ✅ Attach helper trims warmup output locally");

console.log("  Testing wait helper trims preview output locally...");
const transcript = await waitModule.getRecentActivityTranscript(fakeClient, "agent-4");
assert.equal(requests.at(-1)?.options.limit, 0);
assert(transcript?.includes("message-50"));
assert(!transcript?.includes("message-44"));
console.log("  ✅ Wait helper trims preview output locally");

console.log("\n✅ Phase 34: Timeline Fetch Limit Tests PASSED");
