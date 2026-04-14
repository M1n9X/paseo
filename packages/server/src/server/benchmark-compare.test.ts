import { describe, expect, test } from "vitest";
import {
  compareBenchmarkResults,
  formatBenchmarkComparisonSummary,
} from "../../scripts/compare-benchmark-results.ts";

describe("compareBenchmarkResults", () => {
  test("rejects mismatched benchmark suites", () => {
    expect(() =>
      compareBenchmarkResults({
        baseline: {
          suite: "cli-startup",
          timestamp: "2026-04-14T00:00:00.000Z",
          environment: {
            platform: "darwin",
            nodeVersion: "v20.19.5",
            cwd: "/tmp/repo",
          },
          scenarios: [],
        },
        candidate: {
          suite: "timeline-fetch",
          timestamp: "2026-04-14T00:00:00.000Z",
          environment: {
            platform: "darwin",
            nodeVersion: "v20.19.5",
          },
          config: {
            totalRows: 500,
            projectedTailLimit: 10,
          },
          scenarios: [],
        },
      }),
    ).toThrow(/different benchmark suites/i);
  });

  test("classifies CLI startup scenarios as improved, regressed, and unchanged", () => {
    const result = compareBenchmarkResults({
      baseline: {
        suite: "cli-startup",
        timestamp: "2026-04-14T00:00:00.000Z",
        environment: {
          platform: "darwin",
          nodeVersion: "v20.19.5",
          cwd: "/tmp/repo",
        },
        scenarios: [
          {
            label: "version",
            command: "node",
            args: ["cli", "--version"],
            iterations: 3,
            sampleCount: 3,
            timingsMs: [100, 100, 100],
            meanMs: 100,
            minMs: 100,
            maxMs: 100,
            peakRssBytes: 1000,
          },
          {
            label: "help",
            command: "node",
            args: ["cli", "--help"],
            iterations: 3,
            sampleCount: 3,
            timingsMs: [100, 100, 100],
            meanMs: 100,
            minMs: 100,
            maxMs: 100,
            peakRssBytes: 1000,
          },
          {
            label: "ls-help",
            command: "node",
            args: ["cli", "ls", "--help"],
            iterations: 3,
            sampleCount: 3,
            timingsMs: [100, 100, 100],
            meanMs: 100,
            minMs: 100,
            maxMs: 100,
            peakRssBytes: 1000,
          },
        ],
      },
      candidate: {
        suite: "cli-startup",
        timestamp: "2026-04-14T00:05:00.000Z",
        environment: {
          platform: "darwin",
          nodeVersion: "v20.19.5",
          cwd: "/tmp/repo",
        },
        scenarios: [
          {
            label: "version",
            command: "node",
            args: ["cli", "--version"],
            iterations: 3,
            sampleCount: 3,
            timingsMs: [90, 90, 90],
            meanMs: 90,
            minMs: 90,
            maxMs: 90,
            peakRssBytes: 1200,
          },
          {
            label: "help",
            command: "node",
            args: ["cli", "--help"],
            iterations: 3,
            sampleCount: 3,
            timingsMs: [108, 108, 108],
            meanMs: 108,
            minMs: 108,
            maxMs: 108,
            peakRssBytes: 1000,
          },
          {
            label: "ls-help",
            command: "node",
            args: ["cli", "ls", "--help"],
            iterations: 3,
            sampleCount: 3,
            timingsMs: [103, 103, 103],
            meanMs: 103,
            minMs: 103,
            maxMs: 103,
            peakRssBytes: 1000,
          },
        ],
      },
      thresholds: {
        improveThresholdPct: 5,
        regressThresholdPct: 5,
        memoryThresholdPct: 10,
      },
    });

    expect(result.scenarios.map((scenario) => [scenario.label, scenario.status])).toEqual([
      ["help", "regressed"],
      ["ls-help", "unchanged"],
      ["version", "improved"],
    ]);
    expect(result.scenarios.find((scenario) => scenario.label === "version")?.warnings).toContain(
      "peakRssBytes regressed by 20%",
    );
  });

  test("marks timeline comparisons invalid when workload shape differs", () => {
    const result = compareBenchmarkResults({
      baseline: {
        suite: "timeline-fetch",
        timestamp: "2026-04-14T00:00:00.000Z",
        environment: {
          platform: "darwin",
          nodeVersion: "v20.19.5",
        },
        config: {
          totalRows: 500,
          projectedTailLimit: 10,
        },
        scenarios: [
          {
            label: "projected-tail-window",
            iterations: 3,
            sampleCount: 3,
            timingsMs: [10, 10, 10],
            meanMs: 10,
            minMs: 10,
            maxMs: 10,
            rowsProcessed: 10,
            entriesReturned: 7,
          },
        ],
      },
      candidate: {
        suite: "timeline-fetch",
        timestamp: "2026-04-14T00:05:00.000Z",
        environment: {
          platform: "darwin",
          nodeVersion: "v20.19.5",
        },
        config: {
          totalRows: 500,
          projectedTailLimit: 10,
        },
        scenarios: [
          {
            label: "projected-tail-window",
            iterations: 3,
            sampleCount: 3,
            timingsMs: [9, 9, 9],
            meanMs: 9,
            minMs: 9,
            maxMs: 9,
            rowsProcessed: 12,
            entriesReturned: 8,
          },
        ],
      },
    });

    expect(result.scenarios).toMatchObject([
      {
        label: "projected-tail-window",
        status: "invalid-comparison",
        invalidReasons: [
          "entriesReturned changed from 7 to 8",
          "rowsProcessed changed from 10 to 12",
        ],
      },
    ]);
  });

  test("reports structural scenario differences separately", () => {
    const result = compareBenchmarkResults({
      baseline: {
        suite: "cli-startup",
        timestamp: "2026-04-14T00:00:00.000Z",
        environment: {
          platform: "darwin",
          nodeVersion: "v20.19.5",
          cwd: "/tmp/repo",
        },
        scenarios: [
          {
            label: "only-baseline",
            command: "node",
            args: [],
            iterations: 1,
            sampleCount: 1,
            timingsMs: [100],
            meanMs: 100,
            minMs: 100,
            maxMs: 100,
            peakRssBytes: null,
          },
        ],
      },
      candidate: {
        suite: "cli-startup",
        timestamp: "2026-04-14T00:05:00.000Z",
        environment: {
          platform: "darwin",
          nodeVersion: "v20.19.5",
          cwd: "/tmp/repo",
        },
        scenarios: [
          {
            label: "only-candidate",
            command: "node",
            args: [],
            iterations: 1,
            sampleCount: 1,
            timingsMs: [100],
            meanMs: 100,
            minMs: 100,
            maxMs: 100,
            peakRssBytes: null,
          },
        ],
      },
    });

    expect(result.structuralDifferences).toEqual([
      { kind: "missing-in-candidate", label: "only-baseline" },
      { kind: "missing-in-baseline", label: "only-candidate" },
    ]);
  });

  test("formats a human-readable summary with statuses and deltas", () => {
    const summary = formatBenchmarkComparisonSummary({
      suite: "cli-startup",
      timestamp: "2026-04-14T00:05:00.000Z",
      thresholds: {
        improveThresholdPct: 5,
        regressThresholdPct: 5,
        memoryThresholdPct: 10,
      },
      baseline: {
        timestamp: "2026-04-14T00:00:00.000Z",
      },
      candidate: {
        timestamp: "2026-04-14T00:05:00.000Z",
      },
      scenarios: [
        {
          label: "version",
          status: "improved",
          baselineMeanMs: 100,
          candidateMeanMs: 90,
          deltaMs: -10,
          deltaPct: -10,
          warnings: [],
          invalidReasons: [],
        },
      ],
      structuralDifferences: [{ kind: "missing-in-candidate", label: "help" }],
      summary: {
        improved: 1,
        regressed: 0,
        unchanged: 0,
        invalidComparison: 0,
      },
    });

    expect(summary).toContain("Benchmark comparison (cli-startup)");
    expect(summary).toContain("version improved");
    expect(summary).toContain("delta=-10ms (-10%)");
    expect(summary).toContain("missing-in-candidate: help");
  });
});
