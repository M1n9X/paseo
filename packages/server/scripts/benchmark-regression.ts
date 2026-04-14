import { mkdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import {
  runCliStartupBenchmarks,
  type CliStartupBenchmarkResult,
} from "./benchmark-cli-startup.js";
import {
  runTimelineFetchBenchmarks,
  type TimelineFetchBenchmarkResult,
} from "./benchmark-timeline-fetch.js";
import {
  compareBenchmarkResults,
  formatBenchmarkComparisonSummary,
  loadBenchmarkResult,
  type BenchmarkComparisonResult,
  type BenchmarkComparisonThresholds,
} from "./compare-benchmark-results.js";
import {
  hasFlag,
  parseNumberFlag,
  parseStringFlag,
  writeBenchmarkJsonOutput,
} from "./benchmark-shared.js";

type BenchmarkSuite = "cli-startup" | "timeline-fetch";
type BenchmarkSuiteSelection = BenchmarkSuite | "all";
type GeneratedBenchmarkResult = CliStartupBenchmarkResult | TimelineFetchBenchmarkResult;

type BenchmarkRunnerOptions = {
  iterations?: number;
  rows?: number;
  tailLimit?: number;
};

type BenchmarkRunners = {
  cliStartup?: (options: { iterations?: number }) => Promise<CliStartupBenchmarkResult>;
  timelineFetch?: (options: {
    iterations?: number;
    totalRows?: number;
    projectedTailLimit?: number;
  }) => Promise<TimelineFetchBenchmarkResult>;
};

export type GeneratedBenchmarkArtifact = {
  suite: BenchmarkSuite;
  path: string;
};

export type RegressionComparisonEntry = {
  suite: BenchmarkSuite;
  baselinePath: string;
  candidatePath: string;
  comparison: BenchmarkComparisonResult;
};

export type BenchmarkRegressionCaptureResult = {
  mode: "capture";
  timestamp: string;
  outputDir: string;
  generated: GeneratedBenchmarkArtifact[];
};

export type BenchmarkRegressionCompareResult = {
  mode: "compare";
  timestamp: string;
  outputDir: string;
  generated: GeneratedBenchmarkArtifact[];
  comparisons: RegressionComparisonEntry[];
};

export type BenchmarkRegressionResult =
  | BenchmarkRegressionCaptureResult
  | BenchmarkRegressionCompareResult;

function resolveSelectedSuites(selection: BenchmarkSuiteSelection): BenchmarkSuite[] {
  return selection === "all" ? ["cli-startup", "timeline-fetch"] : [selection];
}

async function ensureDirectory(dir: string): Promise<string> {
  await mkdir(dir, { recursive: true });
  return dir;
}

async function createTemporaryOutputDir(prefix: string): Promise<string> {
  return await mkdtemp(path.join(tmpdir(), prefix));
}

async function generateSuiteResult(
  suite: BenchmarkSuite,
  runners: BenchmarkRunners,
  options: BenchmarkRunnerOptions,
): Promise<GeneratedBenchmarkResult> {
  if (suite === "cli-startup") {
    const run = runners.cliStartup ?? runCliStartupBenchmarks;
    return await run({ iterations: options.iterations });
  }

  const run = runners.timelineFetch ?? runTimelineFetchBenchmarks;
  return await run({
    iterations: options.iterations,
    totalRows: options.rows,
    projectedTailLimit: options.tailLimit,
  });
}

async function writeSuiteResult(
  outputDir: string,
  suite: BenchmarkSuite,
  result: GeneratedBenchmarkResult,
): Promise<GeneratedBenchmarkArtifact> {
  const outputPath = path.join(outputDir, `${suite}.json`);
  await writeBenchmarkJsonOutput(outputPath, result);
  return {
    suite,
    path: outputPath,
  };
}

export async function captureBenchmarkBaselines(
  options: {
    suite?: BenchmarkSuiteSelection;
    outputDir?: string;
    iterations?: number;
    rows?: number;
    tailLimit?: number;
  } & BenchmarkRunners,
): Promise<BenchmarkRegressionCaptureResult> {
  const suite = options.suite ?? "all";
  const outputDir =
    options.outputDir ?? (await createTemporaryOutputDir("paseo-benchmark-capture-"));
  await ensureDirectory(outputDir);

  const generated: GeneratedBenchmarkArtifact[] = [];
  for (const selectedSuite of resolveSelectedSuites(suite)) {
    const result = await generateSuiteResult(selectedSuite, options, {
      iterations: options.iterations,
      rows: options.rows,
      tailLimit: options.tailLimit,
    });
    generated.push(await writeSuiteResult(outputDir, selectedSuite, result));
  }

  return {
    mode: "capture",
    timestamp: new Date().toISOString(),
    outputDir,
    generated,
  };
}

export async function compareBenchmarksAgainstBaselines(
  options: {
    suite?: BenchmarkSuiteSelection;
    baselineDir: string;
    candidateDir?: string;
    iterations?: number;
    rows?: number;
    tailLimit?: number;
    thresholds?: Partial<BenchmarkComparisonThresholds>;
  } & BenchmarkRunners,
): Promise<BenchmarkRegressionCompareResult> {
  const suite = options.suite ?? "all";
  if (!options.baselineDir || options.baselineDir.trim().length === 0) {
    throw new Error("baselineDir is required");
  }
  const candidateDir =
    options.candidateDir ?? (await createTemporaryOutputDir("paseo-benchmark-candidate-"));
  await ensureDirectory(candidateDir);

  const generated: GeneratedBenchmarkArtifact[] = [];
  const comparisons: RegressionComparisonEntry[] = [];

  for (const selectedSuite of resolveSelectedSuites(suite)) {
    const candidateResult = await generateSuiteResult(selectedSuite, options, {
      iterations: options.iterations,
      rows: options.rows,
      tailLimit: options.tailLimit,
    });
    const candidateArtifact = await writeSuiteResult(candidateDir, selectedSuite, candidateResult);
    generated.push(candidateArtifact);

    const baselinePath = path.join(options.baselineDir, `${selectedSuite}.json`);
    const baselineResult = await loadBenchmarkResult(baselinePath);
    const comparison = compareBenchmarkResults({
      baseline: baselineResult,
      candidate: candidateResult,
      thresholds: options.thresholds,
      baselinePath,
      candidatePath: candidateArtifact.path,
    });

    comparisons.push({
      suite: selectedSuite,
      baselinePath,
      candidatePath: candidateArtifact.path,
      comparison,
    });
  }

  return {
    mode: "compare",
    timestamp: new Date().toISOString(),
    outputDir: candidateDir,
    generated,
    comparisons,
  };
}

export function formatBenchmarkRegressionSummary(result: BenchmarkRegressionResult): string {
  const lines = [`Benchmark regression workflow (${result.mode})`, `outputDir=${result.outputDir}`];

  for (const artifact of result.generated) {
    lines.push(`- generated ${artifact.suite}: ${artifact.path}`);
  }

  if (result.mode === "compare") {
    for (const entry of result.comparisons) {
      lines.push(
        `suite=${entry.suite} baseline=${entry.baselinePath} candidate=${entry.candidatePath}`,
      );
      lines.push(
        `  summary improved=${entry.comparison.summary.improved} regressed=${entry.comparison.summary.regressed} unchanged=${entry.comparison.summary.unchanged} invalid=${entry.comparison.summary.invalidComparison}`,
      );
      for (const line of formatBenchmarkComparisonSummary(entry.comparison).trim().split("\n")) {
        lines.push(`  ${line}`);
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

function parseSuiteFlag(args: string[]): BenchmarkSuiteSelection {
  const suite = parseStringFlag(args, ["--suite"]);
  if (!suite) {
    return "all";
  }
  if (suite !== "all" && suite !== "cli-startup" && suite !== "timeline-fetch") {
    throw new Error(`Unsupported suite '${suite}'`);
  }
  return suite;
}

async function main(): Promise<void> {
  const [mode] = process.argv.slice(2);
  if (mode !== "capture" && mode !== "compare") {
    throw new Error("First argument must be 'capture' or 'compare'");
  }

  const args = process.argv.slice(3);
  const suite = parseSuiteFlag(args);
  const iterations = parseNumberFlag(args, ["--iterations"], 3);
  const rows = parseNumberFlag(args, ["--rows"], 5000);
  const tailLimit = parseNumberFlag(args, ["--tail-limit"], 20);
  const json = hasFlag(args, ["--json"]);
  const jsonOutput = parseStringFlag(args, ["--json-output"]);

  const result =
    mode === "capture"
      ? await captureBenchmarkBaselines({
          suite,
          outputDir: parseStringFlag(args, ["--output-dir"]) ?? undefined,
          iterations,
          rows,
          tailLimit,
        })
      : await compareBenchmarksAgainstBaselines({
          suite,
          baselineDir: parseStringFlag(args, ["--baseline-dir"]) ?? "",
          candidateDir: parseStringFlag(args, ["--candidate-dir"]) ?? undefined,
          iterations,
          rows,
          tailLimit,
          thresholds: {
            improveThresholdPct: parseNumberFlag(args, ["--improve-threshold-pct"], 5),
            regressThresholdPct: parseNumberFlag(args, ["--regress-threshold-pct"], 5),
            memoryThresholdPct: parseNumberFlag(args, ["--memory-threshold-pct"], 10),
          },
        });

  if (mode === "compare" && !(result as BenchmarkRegressionCompareResult).comparisons) {
    throw new Error("Comparison result missing comparisons");
  }

  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(formatBenchmarkRegressionSummary(result));
  }

  if (jsonOutput) {
    await writeBenchmarkJsonOutput(jsonOutput, result);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
