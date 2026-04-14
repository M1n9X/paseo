import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import type { AgentProvider, AgentTimelineItem } from "../src/server/agent/agent-sdk-types.js";
import type { AgentTimelineRow } from "../src/server/agent/agent-manager.js";
import {
  projectTimelineRows,
  selectTimelineWindowByProjectedLimit,
} from "../src/server/agent/timeline-projection.js";
import {
  parseNumberFlag,
  parseStringFlag,
  hasFlag,
  roundMetric,
  summarizeTimings,
  writeBenchmarkJsonOutput,
} from "./benchmark-shared.js";

export type TimelineFetchBenchmarkScenarioResult = {
  label: string;
  iterations: number;
  sampleCount: number;
  timingsMs: number[];
  meanMs: number;
  minMs: number;
  maxMs: number;
  rowsProcessed: number;
  entriesReturned: number;
};

export type TimelineFetchBenchmarkResult = {
  suite: "timeline-fetch";
  timestamp: string;
  environment: {
    platform: NodeJS.Platform;
    nodeVersion: string;
  };
  config: {
    totalRows: number;
    projectedTailLimit: number;
  };
  scenarios: TimelineFetchBenchmarkScenarioResult[];
};

function makeSyntheticItem(index: number): AgentTimelineItem {
  const bucket = index % 5;
  if (bucket === 0) {
    return { type: "assistant_message", text: `assistant-${index}` };
  }
  if (bucket === 1) {
    return {
      type: "tool_call",
      callId: `call-${Math.floor(index / 5)}`,
      name: "read",
      status: "started",
      detail: { type: "unknown" },
      metadata: undefined,
    };
  }
  if (bucket === 2) {
    return {
      type: "tool_call",
      callId: `call-${Math.floor(index / 5)}`,
      name: "read",
      status: "completed",
      detail: { type: "unknown" },
      metadata: undefined,
      error: null,
    };
  }
  if (bucket === 3) {
    return { type: "reasoning", text: `reasoning-${index}` };
  }
  return { type: "assistant_message", text: `assistant-tail-${index}` };
}

function buildSyntheticRows(totalRows: number): AgentTimelineRow[] {
  const rows: AgentTimelineRow[] = [];
  for (let index = 0; index < totalRows; index += 1) {
    rows.push({
      seq: index + 1,
      timestamp: new Date(1_700_000_000_000 + index * 1000).toISOString(),
      item: makeSyntheticItem(index),
    });
  }
  return rows;
}

function benchmarkScenario<T>(
  iterations: number,
  run: () => T,
): { timingsMs: number[]; sample: T } {
  const timingsMs: number[] = [];
  let sample: T | null = null;
  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now();
    sample = run();
    timingsMs.push(roundMetric(performance.now() - start));
  }
  return {
    timingsMs,
    sample: sample as T,
  };
}

export async function runTimelineFetchBenchmarks(options?: {
  iterations?: number;
  totalRows?: number;
  projectedTailLimit?: number;
  provider?: AgentProvider;
}): Promise<TimelineFetchBenchmarkResult> {
  const iterations = options?.iterations ?? 20;
  const totalRows = options?.totalRows ?? 5000;
  const projectedTailLimit = options?.projectedTailLimit ?? 20;
  const provider = options?.provider ?? "claude";
  const rows = buildSyntheticRows(totalRows);

  const fullProjected = benchmarkScenario(iterations, () =>
    projectTimelineRows(rows, provider, "projected"),
  );
  const projectedTail = benchmarkScenario(iterations, () =>
    projectTimelineRows(rows.slice(-projectedTailLimit), provider, "projected"),
  );
  const canonicalTailWindow = benchmarkScenario(iterations, () =>
    selectTimelineWindowByProjectedLimit({
      rows,
      provider,
      direction: "tail",
      limit: projectedTailLimit,
      collapseToolLifecycle: false,
    }),
  );

  return {
    suite: "timeline-fetch",
    timestamp: new Date().toISOString(),
    environment: {
      platform: process.platform,
      nodeVersion: process.version,
    },
    config: {
      totalRows,
      projectedTailLimit,
    },
    scenarios: [
      {
        label: "projected-full-history",
        iterations,
        ...summarizeTimings(fullProjected.timingsMs),
        rowsProcessed: rows.length,
        entriesReturned: fullProjected.sample.length,
      },
      {
        label: "projected-tail-window",
        iterations,
        ...summarizeTimings(projectedTail.timingsMs),
        rowsProcessed: projectedTailLimit,
        entriesReturned: projectedTail.sample.length,
      },
      {
        label: "canonical-tail-window",
        iterations,
        ...summarizeTimings(canonicalTailWindow.timingsMs),
        rowsProcessed: canonicalTailWindow.sample.selectedRows.length,
        entriesReturned: canonicalTailWindow.sample.projectedEntries.length,
      },
    ],
  };
}

export function formatTimelineFetchBenchmarkSummary(result: TimelineFetchBenchmarkResult): string {
  const lines = [
    `Timeline fetch benchmark (${result.config.totalRows} rows, tail ${result.config.projectedTailLimit})`,
  ];
  for (const scenario of result.scenarios) {
    lines.push(
      [
        `- ${scenario.label}`,
        `mean=${scenario.meanMs}ms`,
        `min=${scenario.minMs}ms`,
        `max=${scenario.maxMs}ms`,
        `rowsProcessed=${scenario.rowsProcessed}`,
        `entriesReturned=${scenario.entriesReturned}`,
      ].join(" "),
    );
  }
  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const iterations = parseNumberFlag(args, ["--iterations"], 20);
  const totalRows = parseNumberFlag(args, ["--rows"], 5000);
  const projectedTailLimit = parseNumberFlag(args, ["--tail-limit"], 20);
  const json = hasFlag(args, ["--json"]);
  const jsonOutput = parseStringFlag(args, ["--json-output"]);
  const result = await runTimelineFetchBenchmarks({
    iterations,
    totalRows,
    projectedTailLimit,
  });

  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(formatTimelineFetchBenchmarkSummary(result));
  }

  if (jsonOutput) {
    await writeBenchmarkJsonOutput(jsonOutput, result);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
