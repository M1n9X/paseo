import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  formatCliStartupBenchmarkSummary,
  runCliStartupBenchmarks,
  writeBenchmarkJsonOutput,
} from "../../scripts/benchmark-cli-startup.ts";
import {
  formatTimelineFetchBenchmarkSummary,
  runTimelineFetchBenchmarks,
} from "../../scripts/benchmark-timeline-fetch.ts";

describe("benchmark scripts", () => {
  test("CLI startup benchmark returns stable JSON-friendly structure", async () => {
    const result = await runCliStartupBenchmarks({
      iterations: 2,
      scenarios: [
        {
          label: "noop",
          command: process.execPath,
          args: ["-e", "process.stdout.write('ok\\n')"],
        },
      ],
      measurePeakRssBytes: async () => null,
    });

    expect(result).toMatchObject({
      suite: "cli-startup",
      scenarios: [
        {
          label: "noop",
          iterations: 2,
          sampleCount: 2,
        },
      ],
    });
    expect(result.scenarios[0]?.meanMs).toBeGreaterThanOrEqual(0);
    expect(result.scenarios[0]?.timingsMs).toHaveLength(2);
    expect(formatCliStartupBenchmarkSummary(result)).toContain("noop");
  });

  test("benchmark JSON writer persists machine-readable output", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "paseo-benchmark-json-"));
    const outputPath = path.join(tempDir, "result.json");

    const result = await runCliStartupBenchmarks({
      iterations: 1,
      scenarios: [
        {
          label: "noop",
          command: process.execPath,
          args: ["-e", ""],
        },
      ],
      measurePeakRssBytes: async () => null,
    });

    await writeBenchmarkJsonOutput(outputPath, result);

    const saved = JSON.parse(await readFile(outputPath, "utf8"));
    expect(saved.suite).toBe("cli-startup");
    expect(saved.scenarios).toHaveLength(1);
    expect(saved.scenarios[0]).toHaveProperty("peakRssBytes");
  });

  test("timeline fetch benchmark reports bounded and unbounded scenarios", async () => {
    const result = await runTimelineFetchBenchmarks({
      iterations: 2,
      totalRows: 200,
      projectedTailLimit: 10,
    });

    expect(result).toMatchObject({
      suite: "timeline-fetch",
    });
    expect(result.scenarios.map((scenario) => scenario.label)).toEqual([
      "projected-full-history",
      "projected-tail-window",
      "canonical-tail-window",
    ]);
    expect(formatTimelineFetchBenchmarkSummary(result)).toContain("projected-tail-window");
  });
});
