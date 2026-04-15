import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  captureBenchmarkBaselines,
  compareBenchmarksAgainstBaselines,
  formatBenchmarkRegressionSummary,
} from "../../scripts/benchmark-regression.ts";

describe("benchmark regression workflow", () => {
  test("repo root exposes capture and compare aliases", async () => {
    const packageJsonPath = new URL("../../../../package.json", import.meta.url);
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["benchmark:regression:capture"]).toBe(
      "npm run benchmark:regression --workspace=@getpaseo/server -- capture",
    );
    expect(packageJson.scripts?.["benchmark:regression:compare"]).toBe(
      "npm run benchmark:regression --workspace=@getpaseo/server -- compare",
    );
  });

  test("captureBenchmarkBaselines writes selected suite outputs", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "paseo-benchmark-capture-"));

    const result = await captureBenchmarkBaselines({
      suite: "all",
      outputDir,
      cliStartup: async () => ({
        suite: "cli-startup",
        timestamp: "2026-04-14T00:00:00.000Z",
        environment: {
          platform: "darwin",
          nodeVersion: "v20.19.5",
          cwd: "/tmp/repo",
        },
        scenarios: [],
      }),
      timelineFetch: async () => ({
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
      }),
    });

    expect(result.generated.map((entry) => entry.suite)).toEqual(["cli-startup", "timeline-fetch"]);
    expect(JSON.parse(await readFile(path.join(outputDir, "cli-startup.json"), "utf8")).suite).toBe(
      "cli-startup",
    );
    expect(
      JSON.parse(await readFile(path.join(outputDir, "timeline-fetch.json"), "utf8")).suite,
    ).toBe("timeline-fetch");
  });

  test("compareBenchmarksAgainstBaselines generates candidates and compares them", async () => {
    const baselineDir = await mkdtemp(path.join(tmpdir(), "paseo-benchmark-baseline-"));
    const candidateDir = await mkdtemp(path.join(tmpdir(), "paseo-benchmark-candidate-"));

    await Promise.all([
      readFile(
        await (async () => {
          const cliPath = path.join(baselineDir, "cli-startup.json");
          const payload = {
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
                args: [],
                iterations: 1,
                sampleCount: 1,
                timingsMs: [100],
                meanMs: 100,
                minMs: 100,
                maxMs: 100,
                peakRssBytes: 1000,
              },
            ],
          };
          await import("node:fs/promises").then(({ writeFile }) =>
            writeFile(cliPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8"),
          );
          return cliPath;
        })(),
      ),
      readFile(
        await (async () => {
          const timelinePath = path.join(baselineDir, "timeline-fetch.json");
          const payload = {
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
                iterations: 1,
                sampleCount: 1,
                timingsMs: [10],
                meanMs: 10,
                minMs: 10,
                maxMs: 10,
                rowsProcessed: 10,
                entriesReturned: 7,
              },
            ],
          };
          await import("node:fs/promises").then(({ writeFile }) =>
            writeFile(timelinePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8"),
          );
          return timelinePath;
        })(),
      ),
    ]);

    const result = await compareBenchmarksAgainstBaselines({
      suite: "all",
      baselineDir,
      candidateDir,
      cliStartup: async () => ({
        suite: "cli-startup",
        timestamp: "2026-04-14T00:10:00.000Z",
        environment: {
          platform: "darwin",
          nodeVersion: "v20.19.5",
          cwd: "/tmp/repo",
        },
        scenarios: [
          {
            label: "version",
            command: "node",
            args: [],
            iterations: 1,
            sampleCount: 1,
            timingsMs: [90],
            meanMs: 90,
            minMs: 90,
            maxMs: 90,
            peakRssBytes: 1000,
          },
        ],
      }),
      timelineFetch: async () => ({
        suite: "timeline-fetch",
        timestamp: "2026-04-14T00:10:00.000Z",
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
            iterations: 1,
            sampleCount: 1,
            timingsMs: [11],
            meanMs: 11,
            minMs: 11,
            maxMs: 11,
            rowsProcessed: 10,
            entriesReturned: 7,
          },
        ],
      }),
    });

    expect(result.comparisons.map((entry) => [entry.suite, entry.comparison.summary])).toEqual([
      [
        "cli-startup",
        {
          improved: 1,
          regressed: 0,
          unchanged: 0,
          invalidComparison: 0,
        },
      ],
      [
        "timeline-fetch",
        {
          improved: 0,
          regressed: 1,
          unchanged: 0,
          invalidComparison: 0,
        },
      ],
    ]);

    expect(
      JSON.parse(await readFile(path.join(candidateDir, "cli-startup.json"), "utf8")).suite,
    ).toBe("cli-startup");
    expect(
      JSON.parse(await readFile(path.join(candidateDir, "timeline-fetch.json"), "utf8")).suite,
    ).toBe("timeline-fetch");
  });

  test("compareBenchmarksAgainstBaselines requires a baseline directory", async () => {
    await expect(
      compareBenchmarksAgainstBaselines({
        suite: "timeline-fetch",
        baselineDir: "",
        timelineFetch: async () => ({
          suite: "timeline-fetch",
          timestamp: "2026-04-14T00:10:00.000Z",
          environment: {
            platform: "darwin",
            nodeVersion: "v20.19.5",
          },
          config: {
            totalRows: 500,
            projectedTailLimit: 10,
          },
          scenarios: [],
        }),
      }),
    ).rejects.toThrow(/baselineDir is required/);
  });

  test("formats a workflow summary spanning multiple suites", () => {
    const summary = formatBenchmarkRegressionSummary({
      mode: "compare",
      timestamp: "2026-04-14T00:20:00.000Z",
      outputDir: "/tmp/candidates",
      generated: [
        { suite: "cli-startup", path: "/tmp/candidates/cli-startup.json" },
        { suite: "timeline-fetch", path: "/tmp/candidates/timeline-fetch.json" },
      ],
      comparisons: [
        {
          suite: "cli-startup",
          baselinePath: "/tmp/baselines/cli-startup.json",
          candidatePath: "/tmp/candidates/cli-startup.json",
          comparison: {
            suite: "cli-startup",
            timestamp: "2026-04-14T00:20:00.000Z",
            thresholds: {
              improveThresholdPct: 5,
              regressThresholdPct: 5,
              memoryThresholdPct: 10,
            },
            baseline: { timestamp: "2026-04-14T00:00:00.000Z" },
            candidate: { timestamp: "2026-04-14T00:20:00.000Z" },
            scenarios: [],
            structuralDifferences: [],
            summary: {
              improved: 1,
              regressed: 0,
              unchanged: 2,
              invalidComparison: 0,
            },
          },
        },
      ],
    });

    expect(summary).toContain("Benchmark regression workflow (compare)");
    expect(summary).toContain("cli-startup");
    expect(summary).toContain("improved=1");
    expect(summary).toContain("/tmp/candidates/cli-startup.json");
  });
});
