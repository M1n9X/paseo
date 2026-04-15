#!/usr/bin/env npx tsx

import assert from "node:assert/strict";

console.log("📋 Phase 35: Logs Filter Tail Tests\n");

const logsModule = await import(new URL("../src/commands/agent/logs.ts", import.meta.url).href);

const timelineItems = [
  { type: "assistant_message", text: "assistant-1" },
  { type: "error", message: "error-1" },
  { type: "assistant_message", text: "assistant-2" },
  { type: "error", message: "error-2" },
  { type: "assistant_message", text: "assistant-3" },
  { type: "error", message: "error-3" },
];

console.log("  Testing logs fetch limit stays unbounded when filter and tail are combined...");
assert.equal(
  logsModule.getLogTimelineFetchLimit?.({
    filter: "errors",
    tailCount: 2,
  }),
  undefined,
);
console.log("  ✅ Combined filter + tail uses unbounded fetch");

console.log("  Testing logs fetch limit stays bounded without a filter...");
assert.equal(logsModule.getLogTimelineFetchLimit?.({ tailCount: 2 }), 2);
console.log("  ✅ Tail-only fetch stays bounded");

console.log("  Testing logs apply filter before tailing...");
const selectedItems = logsModule.selectLogTimelineItems?.(timelineItems, {
  filter: "errors",
  tailCount: 2,
});
assert.deepEqual(
  selectedItems?.map((item: { message?: string }) => item.message),
  ["error-2", "error-3"],
);
console.log("  ✅ Filtered logs keep the last matching items");

console.log("\n✅ Phase 35: Logs Filter Tail Tests PASSED");
