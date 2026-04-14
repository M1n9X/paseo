import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  parseNumberFlag,
  parseStringFlag,
  hasFlag,
  roundMetric,
  summarizeTimings,
  writeBenchmarkJsonOutput,
} from "./benchmark-shared.js";

export type CliStartupBenchmarkScenario = {
  label: string;
  command: string;
  args: string[];
  cwd?: string;
};

export type CliStartupBenchmarkScenarioResult = CliStartupBenchmarkScenario & {
  iterations: number;
  sampleCount: number;
  timingsMs: number[];
  meanMs: number;
  minMs: number;
  maxMs: number;
  peakRssBytes: number | null;
};

export type CliStartupBenchmarkResult = {
  suite: "cli-startup";
  timestamp: string;
  environment: {
    platform: NodeJS.Platform;
    nodeVersion: string;
    cwd: string;
  };
  scenarios: CliStartupBenchmarkScenarioResult[];
};

function resolveRepoRoot(): string {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(scriptDir, "../../..");
}

function defaultCliStartupScenarios(): CliStartupBenchmarkScenario[] {
  const repoRoot = resolveRepoRoot();
  const cliEntrypoint = path.join(repoRoot, "packages/cli/bin/paseo");
  return [
    {
      label: "version",
      command: process.execPath,
      args: [cliEntrypoint, "--version"],
      cwd: repoRoot,
    },
    {
      label: "help",
      command: process.execPath,
      args: [cliEntrypoint, "--help"],
      cwd: repoRoot,
    },
    {
      label: "ls-help",
      command: process.execPath,
      args: [cliEntrypoint, "ls", "--help"],
      cwd: repoRoot,
    },
  ];
}

async function measurePeakRssBytesBestEffort(
  scenario: CliStartupBenchmarkScenario,
): Promise<number | null> {
  if (process.platform === "win32") {
    return null;
  }

  const result = spawnSync("/usr/bin/time", ["-lp", scenario.command, ...scenario.args], {
    cwd: scenario.cwd,
    encoding: "utf8",
  });
  const stderr = result.stderr ?? "";
  const match = stderr.match(/^\s*(\d+)\s+maximum resident set size$/m);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function runScenarioIteration(scenario: CliStartupBenchmarkScenario): number {
  const start = performance.now();
  const result = spawnSync(scenario.command, scenario.args, {
    cwd: scenario.cwd,
    encoding: "utf8",
  });
  const elapsed = performance.now() - start;
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `Scenario '${scenario.label}' failed with exit code ${result.status}: ${
        result.stderr || result.stdout || "unknown error"
      }`,
    );
  }
  return roundMetric(elapsed);
}

export async function runCliStartupBenchmarks(options?: {
  iterations?: number;
  scenarios?: CliStartupBenchmarkScenario[];
  measurePeakRssBytes?: (scenario: CliStartupBenchmarkScenario) => Promise<number | null>;
}): Promise<CliStartupBenchmarkResult> {
  const iterations = options?.iterations ?? 5;
  const scenarios = options?.scenarios ?? defaultCliStartupScenarios();
  const measurePeakRssBytes = options?.measurePeakRssBytes ?? measurePeakRssBytesBestEffort;

  const results: CliStartupBenchmarkScenarioResult[] = [];
  for (const scenario of scenarios) {
    const timingsMs = Array.from({ length: iterations }, () => runScenarioIteration(scenario));
    const summary = summarizeTimings(timingsMs);
    results.push({
      ...scenario,
      iterations,
      ...summary,
      peakRssBytes: await measurePeakRssBytes(scenario),
    });
  }

  return {
    suite: "cli-startup",
    timestamp: new Date().toISOString(),
    environment: {
      platform: process.platform,
      nodeVersion: process.version,
      cwd: resolveRepoRoot(),
    },
    scenarios: results,
  };
}

export function formatCliStartupBenchmarkSummary(result: CliStartupBenchmarkResult): string {
  const lines = [
    `CLI startup benchmark (${result.environment.platform}, Node ${result.environment.nodeVersion})`,
  ];
  for (const scenario of result.scenarios) {
    lines.push(
      [
        `- ${scenario.label}`,
        `mean=${scenario.meanMs}ms`,
        `min=${scenario.minMs}ms`,
        `max=${scenario.maxMs}ms`,
        `samples=${scenario.sampleCount}`,
        scenario.peakRssBytes === null ? null : `peakRssBytes=${scenario.peakRssBytes}`,
      ]
        .filter(Boolean)
        .join(" "),
    );
  }
  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const iterations = parseNumberFlag(args, ["--iterations"], 5);
  const json = hasFlag(args, ["--json"]);
  const jsonOutput = parseStringFlag(args, ["--json-output"]);
  const result = await runCliStartupBenchmarks({ iterations });

  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(formatCliStartupBenchmarkSummary(result));
  }

  if (jsonOutput) {
    await writeBenchmarkJsonOutput(jsonOutput, result);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

export { writeBenchmarkJsonOutput };
