# CLI/VPS Performance Phase 4 Regression Workflow

## Purpose

Phases 2 and 3 added benchmark generation and JSON comparison. Phase 4 packages them into a local workflow so engineers can:

1. capture benchmark baselines into a directory
2. generate fresh candidate benchmark results
3. compare the fresh results against the stored baseline

This phase is intentionally local-first. It does not introduce repository-managed baselines or CI integration.

## Scope

Phase 4 adds a regression workflow script that orchestrates the existing benchmark scripts and comparison logic.

Supported suites:

- `cli-startup`
- `timeline-fetch`
- `all`

Supported modes:

- `capture`
- `compare`

## Commands

Capture baseline files:

```bash
npm run benchmark:regression:capture -- \
  --suite all \
  --output-dir /tmp/paseo-baseline
```

Compare current results against an existing baseline directory:

```bash
npm run benchmark:regression:compare -- \
  --suite all \
  --baseline-dir /tmp/paseo-baseline
```

Write machine-readable output:

```bash
npm run benchmark:regression:compare -- \
  --suite timeline-fetch \
  --baseline-dir /tmp/paseo-baseline \
  --json-output /tmp/paseo-regression.json
```

## Notes

- The workflow compares fresh candidate runs against stored JSON baselines.
- Running baseline and candidate back-to-back on the same machine may still show noise from warm caches or process startup variance.
- Use multiple iterations when you want stronger signal.
- For `timeline-fetch`, structural workload mismatches produce `invalid-comparison` rather than a performance verdict.
- The short operational version of this workflow also lives in [DEVELOPMENT.md](./DEVELOPMENT.md) under `Performance regression workflow`.
