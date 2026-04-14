import { writeFile } from "node:fs/promises";

export type BenchmarkSummaryStats = {
  sampleCount: number;
  timingsMs: number[];
  meanMs: number;
  minMs: number;
  maxMs: number;
};

export function summarizeTimings(timingsMs: number[]): BenchmarkSummaryStats {
  const sampleCount = timingsMs.length;
  if (sampleCount === 0) {
    return {
      sampleCount: 0,
      timingsMs: [],
      meanMs: 0,
      minMs: 0,
      maxMs: 0,
    };
  }

  const total = timingsMs.reduce((sum, value) => sum + value, 0);
  return {
    sampleCount,
    timingsMs,
    meanMs: roundMetric(total / sampleCount),
    minMs: roundMetric(Math.min(...timingsMs)),
    maxMs: roundMetric(Math.max(...timingsMs)),
  };
}

export function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function writeBenchmarkJsonOutput<T>(outputPath: string, payload: T): Promise<void> {
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export function parseNumberFlag(args: string[], names: string[], fallback: number): number {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg || !names.includes(arg)) {
      continue;
    }
    const next = args[index + 1];
    if (!next) {
      throw new Error(`${arg} requires a numeric value`);
    }
    const parsed = Number(next);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`${arg} must be a positive number`);
    }
    return parsed;
  }
  return fallback;
}

export function parseStringFlag(args: string[], names: string[]): string | null {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg || !names.includes(arg)) {
      continue;
    }
    const next = args[index + 1];
    if (!next) {
      throw new Error(`${arg} requires a value`);
    }
    return next;
  }
  return null;
}

export function hasFlag(args: string[], names: string[]): boolean {
  return args.some((arg) => names.includes(arg));
}
