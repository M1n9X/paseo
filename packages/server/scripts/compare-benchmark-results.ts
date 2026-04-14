import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import type {
  CliStartupBenchmarkResult,
  CliStartupBenchmarkScenarioResult,
} from "./benchmark-cli-startup.js";
import type {
  TimelineFetchBenchmarkResult,
  TimelineFetchBenchmarkScenarioResult,
} from "./benchmark-timeline-fetch.js";
import {
  hasFlag,
  parseNumberFlag,
  parseStringFlag,
  roundMetric,
  writeBenchmarkJsonOutput,
} from "./benchmark-shared.js";

type SupportedBenchmarkResult = CliStartupBenchmarkResult | TimelineFetchBenchmarkResult;
type SupportedBenchmarkSuite = SupportedBenchmarkResult["suite"];

export type BenchmarkComparisonThresholds = {
  improveThresholdPct: number;
  regressThresholdPct: number;
  memoryThresholdPct: number;
};

export type StructuralDifference = {
  kind: "missing-in-baseline" | "missing-in-candidate";
  label: string;
};

export type BenchmarkScenarioComparison = {
  label: string;
  status: "improved" | "regressed" | "unchanged" | "invalid-comparison";
  baselineMeanMs: number;
  candidateMeanMs: number;
  deltaMs: number;
  deltaPct: number;
  warnings: string[];
  invalidReasons: string[];
  baselinePeakRssBytes?: number | null;
  candidatePeakRssBytes?: number | null;
  memoryDeltaPct?: number | null;
};

export type BenchmarkComparisonResult = {
  suite: SupportedBenchmarkSuite;
  timestamp: string;
  thresholds: BenchmarkComparisonThresholds;
  baseline: {
    timestamp: string;
    path?: string;
  };
  candidate: {
    timestamp: string;
    path?: string;
  };
  scenarios: BenchmarkScenarioComparison[];
  structuralDifferences: StructuralDifference[];
  summary: {
    improved: number;
    regressed: number;
    unchanged: number;
    invalidComparison: number;
  };
};

const DEFAULT_THRESHOLDS: BenchmarkComparisonThresholds = {
  improveThresholdPct: 5,
  regressThresholdPct: 5,
  memoryThresholdPct: 10,
};

function toScenarioMap<TScenario extends { label: string }>(
  scenarios: readonly TScenario[],
): Map<string, TScenario> {
  return new Map(scenarios.map((scenario) => [scenario.label, scenario]));
}

function formatPct(value: number): string {
  const rounded = roundMetric(value);
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded}%`;
}

function createStructuralDifferences(
  baselineLabels: readonly string[],
  candidateLabels: readonly string[],
): StructuralDifference[] {
  const baselineSet = new Set(baselineLabels);
  const candidateSet = new Set(candidateLabels);
  const differences: StructuralDifference[] = [];

  for (const label of [...baselineSet].sort()) {
    if (!candidateSet.has(label)) {
      differences.push({ kind: "missing-in-candidate", label });
    }
  }

  for (const label of [...candidateSet].sort()) {
    if (!baselineSet.has(label)) {
      differences.push({ kind: "missing-in-baseline", label });
    }
  }

  return differences;
}

function classifyDelta(
  deltaPct: number,
  thresholds: BenchmarkComparisonThresholds,
): "improved" | "regressed" | "unchanged" {
  if (deltaPct <= -thresholds.improveThresholdPct) {
    return "improved";
  }
  if (deltaPct >= thresholds.regressThresholdPct) {
    return "regressed";
  }
  return "unchanged";
}

function compareCliStartupScenario(
  baseline: CliStartupBenchmarkScenarioResult,
  candidate: CliStartupBenchmarkScenarioResult,
  thresholds: BenchmarkComparisonThresholds,
): BenchmarkScenarioComparison {
  const deltaMs = roundMetric(candidate.meanMs - baseline.meanMs);
  const deltaPct = baseline.meanMs === 0 ? 0 : roundMetric((deltaMs / baseline.meanMs) * 100);
  const warnings: string[] = [];

  let memoryDeltaPct: number | null = null;
  if (
    typeof baseline.peakRssBytes === "number" &&
    baseline.peakRssBytes > 0 &&
    typeof candidate.peakRssBytes === "number"
  ) {
    memoryDeltaPct = roundMetric(
      ((candidate.peakRssBytes - baseline.peakRssBytes) / baseline.peakRssBytes) * 100,
    );
    if (memoryDeltaPct >= thresholds.memoryThresholdPct) {
      warnings.push(`peakRssBytes regressed by ${formatPct(memoryDeltaPct)}`);
    }
  }

  return {
    label: baseline.label,
    status: classifyDelta(deltaPct, thresholds),
    baselineMeanMs: baseline.meanMs,
    candidateMeanMs: candidate.meanMs,
    deltaMs,
    deltaPct,
    warnings,
    invalidReasons: [],
    baselinePeakRssBytes: baseline.peakRssBytes,
    candidatePeakRssBytes: candidate.peakRssBytes,
    memoryDeltaPct,
  };
}

function compareTimelineScenario(
  baseline: TimelineFetchBenchmarkScenarioResult,
  candidate: TimelineFetchBenchmarkScenarioResult,
  thresholds: BenchmarkComparisonThresholds,
): BenchmarkScenarioComparison {
  const invalidReasons: string[] = [];
  if (baseline.entriesReturned !== candidate.entriesReturned) {
    invalidReasons.push(
      `entriesReturned changed from ${baseline.entriesReturned} to ${candidate.entriesReturned}`,
    );
  }
  if (baseline.rowsProcessed !== candidate.rowsProcessed) {
    invalidReasons.push(
      `rowsProcessed changed from ${baseline.rowsProcessed} to ${candidate.rowsProcessed}`,
    );
  }

  const deltaMs = roundMetric(candidate.meanMs - baseline.meanMs);
  const deltaPct = baseline.meanMs === 0 ? 0 : roundMetric((deltaMs / baseline.meanMs) * 100);

  return {
    label: baseline.label,
    status: invalidReasons.length > 0 ? "invalid-comparison" : classifyDelta(deltaPct, thresholds),
    baselineMeanMs: baseline.meanMs,
    candidateMeanMs: candidate.meanMs,
    deltaMs,
    deltaPct,
    warnings: [],
    invalidReasons,
  };
}

function compareMatchedScenarios(
  suite: SupportedBenchmarkSuite,
  baseline: SupportedBenchmarkResult,
  candidate: SupportedBenchmarkResult,
  thresholds: BenchmarkComparisonThresholds,
): BenchmarkScenarioComparison[] {
  const baselineMap = toScenarioMap(baseline.scenarios);
  const candidateMap = toScenarioMap(candidate.scenarios);
  const matchedLabels = [...baselineMap.keys()]
    .filter((label) => candidateMap.has(label))
    .sort((left, right) => left.localeCompare(right));

  return matchedLabels.map((label) => {
    const baselineScenario = baselineMap.get(label);
    const candidateScenario = candidateMap.get(label);
    if (!baselineScenario || !candidateScenario) {
      throw new Error(`Missing scenario during comparison: ${label}`);
    }

    if (suite === "cli-startup") {
      return compareCliStartupScenario(
        baselineScenario as CliStartupBenchmarkScenarioResult,
        candidateScenario as CliStartupBenchmarkScenarioResult,
        thresholds,
      );
    }

    return compareTimelineScenario(
      baselineScenario as TimelineFetchBenchmarkScenarioResult,
      candidateScenario as TimelineFetchBenchmarkScenarioResult,
      thresholds,
    );
  });
}

export function compareBenchmarkResults(input: {
  baseline: SupportedBenchmarkResult;
  candidate: SupportedBenchmarkResult;
  thresholds?: Partial<BenchmarkComparisonThresholds>;
  baselinePath?: string;
  candidatePath?: string;
}): BenchmarkComparisonResult {
  const thresholds: BenchmarkComparisonThresholds = {
    ...DEFAULT_THRESHOLDS,
    ...(input.thresholds ?? {}),
  };

  if (input.baseline.suite !== input.candidate.suite) {
    throw new Error(
      `Cannot compare different benchmark suites: ${input.baseline.suite} vs ${input.candidate.suite}`,
    );
  }

  const suite = input.baseline.suite;
  const structuralDifferences = createStructuralDifferences(
    input.baseline.scenarios.map((scenario) => scenario.label),
    input.candidate.scenarios.map((scenario) => scenario.label),
  );
  const scenarios = compareMatchedScenarios(suite, input.baseline, input.candidate, thresholds);

  return {
    suite,
    timestamp: new Date().toISOString(),
    thresholds,
    baseline: {
      timestamp: input.baseline.timestamp,
      ...(input.baselinePath ? { path: input.baselinePath } : {}),
    },
    candidate: {
      timestamp: input.candidate.timestamp,
      ...(input.candidatePath ? { path: input.candidatePath } : {}),
    },
    scenarios,
    structuralDifferences,
    summary: {
      improved: scenarios.filter((scenario) => scenario.status === "improved").length,
      regressed: scenarios.filter((scenario) => scenario.status === "regressed").length,
      unchanged: scenarios.filter((scenario) => scenario.status === "unchanged").length,
      invalidComparison: scenarios.filter((scenario) => scenario.status === "invalid-comparison")
        .length,
    },
  };
}

export function formatBenchmarkComparisonSummary(result: BenchmarkComparisonResult): string {
  const lines = [
    `Benchmark comparison (${result.suite})`,
    `thresholds improve<=-${result.thresholds.improveThresholdPct}% regress>=${result.thresholds.regressThresholdPct}% memory>=${result.thresholds.memoryThresholdPct}%`,
  ];

  for (const scenario of result.scenarios) {
    lines.push(
      `- ${scenario.label} ${scenario.status} baseline=${scenario.baselineMeanMs}ms candidate=${scenario.candidateMeanMs}ms delta=${scenario.deltaMs}ms (${formatPct(scenario.deltaPct)})`,
    );
    for (const warning of scenario.warnings) {
      lines.push(`  warning: ${warning}`);
    }
    for (const reason of scenario.invalidReasons) {
      lines.push(`  invalid: ${reason}`);
    }
  }

  if (result.structuralDifferences.length > 0) {
    lines.push("structural-differences:");
    for (const difference of result.structuralDifferences) {
      lines.push(`- ${difference.kind}: ${difference.label}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export async function loadBenchmarkResult(filePath: string): Promise<SupportedBenchmarkResult> {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as SupportedBenchmarkResult;
  if (!parsed || typeof parsed !== "object" || typeof parsed.suite !== "string") {
    throw new Error(`Invalid benchmark JSON: ${filePath}`);
  }
  if (parsed.suite !== "cli-startup" && parsed.suite !== "timeline-fetch") {
    throw new Error(`Unsupported benchmark suite '${parsed.suite}' in ${filePath}`);
  }
  if (!Array.isArray(parsed.scenarios)) {
    throw new Error(`Benchmark JSON missing scenarios array: ${filePath}`);
  }
  return parsed;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const baselinePath = parseStringFlag(args, ["--baseline"]);
  const candidatePath = parseStringFlag(args, ["--candidate"]);
  if (!baselinePath || !candidatePath) {
    throw new Error("--baseline and --candidate are required");
  }

  const result = compareBenchmarkResults({
    baseline: await loadBenchmarkResult(baselinePath),
    candidate: await loadBenchmarkResult(candidatePath),
    thresholds: {
      improveThresholdPct: parseNumberFlag(
        args,
        ["--improve-threshold-pct"],
        DEFAULT_THRESHOLDS.improveThresholdPct,
      ),
      regressThresholdPct: parseNumberFlag(
        args,
        ["--regress-threshold-pct"],
        DEFAULT_THRESHOLDS.regressThresholdPct,
      ),
      memoryThresholdPct: parseNumberFlag(
        args,
        ["--memory-threshold-pct"],
        DEFAULT_THRESHOLDS.memoryThresholdPct,
      ),
    },
    baselinePath,
    candidatePath,
  });

  if (hasFlag(args, ["--json"])) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(formatBenchmarkComparisonSummary(result));
  }

  const jsonOutput = parseStringFlag(args, ["--json-output"]);
  if (jsonOutput) {
    await writeBenchmarkJsonOutput(jsonOutput, result);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
