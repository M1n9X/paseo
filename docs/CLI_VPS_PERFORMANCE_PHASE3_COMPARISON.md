# CLI/VPS Performance Phase 3 Benchmark Comparison

## Background

Phase 2 added two important foundations:

1. daemon-side runtime trace metrics for outbound, slow-client, and timeline fetch behavior
2. repeatable benchmark scripts that emit both terminal summaries and machine-readable JSON

The next missing piece is comparison. Engineers need a lightweight way to compare two benchmark result files and quickly answer whether a change improved, regressed, or did not materially change performance.

This phase adds a temporary benchmark comparison workflow based on two JSON result files. It does not add repository-managed baselines.

## Goals

- Compare two benchmark JSON result files produced by existing scripts.
- Emit clear `improved` / `regressed` / `unchanged` judgments per scenario.
- Preserve machine-readable output for future CI or tooling use.
- Catch structurally invalid comparisons early instead of producing misleading performance conclusions.

## Non-Goals

- No repository-committed baseline file.
- No automatic CI integration.
- No daemon or CLI protocol changes.
- No new benchmark generation logic beyond what already exists in Phase 2.
- No scoring system or weighted composite ranking across unrelated metrics.

## Scope

Phase 3 adds one new comparison script plus associated docs and tests.

The script compares:

- `cli-startup` benchmark JSON results
- `timeline-fetch` benchmark JSON results

The script accepts a baseline file and a candidate file and reports scenario-by-scenario comparison results.

## Constraints

- Comparison must work entirely from local JSON files.
- Script output must support both human-readable terminal summaries and JSON output.
- Comparison rules must be deterministic and documented.
- Structural mismatches must be explicit rather than silently ignored.

## Requirements

### Functional Requirements

#### R1. Input handling

The comparison script must accept:

- `--baseline <file>`
- `--candidate <file>`

Optional flags may tune thresholds and JSON output.

The script must reject:

- missing files
- invalid JSON
- unsupported benchmark suites
- comparisons between different benchmark suites

#### R2. Scenario matching

Scenarios must be matched by `label`.

The script must detect and report:

- scenarios present only in baseline
- scenarios present only in candidate

These are structural differences, not performance outcomes.

#### R3. Result classification

Each matched scenario must receive one of:

- `improved`
- `regressed`
- `unchanged`
- `invalid-comparison`

Default interpretation:

- for primary metric delta `<= -5%`: `improved`
- for primary metric delta `>= +5%`: `regressed`
- otherwise: `unchanged`

`invalid-comparison` is used when the scenarios are not semantically comparable despite sharing a label.

### Primary Metric Rules

#### CLI startup

Primary metric:

- `meanMs`

Secondary metric:

- `peakRssBytes`

Rules:

- classification is driven by `meanMs`
- `peakRssBytes` may attach a warning if memory regresses beyond threshold
- memory warning does not override the primary time-based status

#### Timeline fetch

Primary metric:

- `meanMs`

Consistency metrics:

- `entriesReturned`
- `rowsProcessed`

Rules:

- classification is driven by `meanMs`
- if `entriesReturned` differs, result is `invalid-comparison`
- if `rowsProcessed` differs, result is `invalid-comparison`

This avoids comparing scenarios that no longer represent the same workload.

## Output Requirements

### Terminal output

Human-readable output must include:

- suite name
- baseline and candidate file paths
- applied thresholds
- one line per matched scenario showing status and key deltas
- a section for structural differences

### JSON output

Machine-readable output must include:

- suite
- timestamp
- baseline metadata
- candidate metadata
- threshold config
- scenario comparison entries
- structural differences

Each scenario comparison entry must include at least:

- `label`
- `status`
- `baselineMeanMs`
- `candidateMeanMs`
- `deltaMs`
- `deltaPct`
- any warnings or invalidity reasons

## Proposed Approach

### A. One compare script, suite-aware logic

Add a single comparison script that:

- loads both benchmark files
- validates suite compatibility
- dispatches to suite-specific comparison logic

This keeps the UX simple while allowing suite-specific correctness rules.

### B. Primary metric plus consistency checks

Use one primary metric per suite for judgment and separate consistency checks for structural validity.

This avoids over-complicated scoring while still preventing misleading comparisons.

### C. JSON-first comparison model

Build the comparison result as structured data first, then format:

- terminal summary from the structured result
- JSON output from the same structured result

This keeps human and machine output consistent.

## Acceptance Criteria

- Comparing two valid `cli-startup` JSON files produces scenario judgments.
- Comparing two valid `timeline-fetch` JSON files produces scenario judgments.
- Structural mismatches are surfaced explicitly.
- Inconsistent timeline workload shape results in `invalid-comparison`.
- Script supports terminal output and JSON output.
- Default thresholds are documented and overridable.

## Risks

### Risk 1: Over-simplified comparison produces misleading conclusions

Mitigation:

- use suite-specific comparison rules
- mark incompatible timeline scenario shape as `invalid-comparison`
- keep thresholds explicit in output

### Risk 2: Too many metrics make output noisy

Mitigation:

- use one primary classification metric per suite
- keep secondary metrics as warnings, not competing verdicts

### Risk 3: Future benchmark schema drift breaks comparison

Mitigation:

- validate required fields up front
- fail clearly on unsupported schema shape
- keep comparison result format explicit and versionable if needed later

## Rollout Order

1. Add comparison result model and tests.
2. Implement compare script and terminal formatting.
3. Add JSON output and threshold flags.
4. Document usage if needed.

## Verification Plan

- Targeted tests for:
  - suite mismatch rejection
  - scenario classification
  - structural difference reporting
  - `invalid-comparison` rules for timeline benchmarks
- Manual script runs against generated benchmark JSON files
- `npm run build --workspace=@getpaseo/server`
- `npm run typecheck`
- `npm run format`
