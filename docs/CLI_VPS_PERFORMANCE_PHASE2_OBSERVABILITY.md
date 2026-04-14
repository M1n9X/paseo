# CLI/VPS Performance Phase 2 Observability and Benchmarks

## Background

Phase 1 reduced three concrete performance issues:

1. CLI cold-start cost from heavy runtime imports.
2. Timeline over-fetch in tail-oriented CLI workflows.
3. Daemon hot-path overhead and slow-client backlog growth for high-frequency outbound traffic.

The next gap is not raw optimization but proof. We need stable observability for runtime behavior and repeatable local benchmarks so future changes can be compared against a baseline instead of relying on anecdotal timing.

This phase adds daemon trace metrics and benchmark scripts only. It does not add a new CLI diagnostics surface.

## Goals

- Make outbound/backpressure behavior visible in existing daemon trace logs.
- Make timeline fetch volume visible in daemon trace logs.
- Add repeatable local benchmark scripts for CLI startup and timeline fetch behavior.
- Produce both terminal-readable summaries and machine-readable JSON results.
- Keep compatibility with current daemon and client protocols.

## Non-Goals

- No new CLI command for viewing metrics.
- No protocol or schema changes exposed to mobile/desktop clients.
- No remote telemetry service or metrics backend.
- No CI gating in this phase, though outputs should be suitable for future CI use.
- No new optimization work beyond lightweight instrumentation needed to expose metrics.

## Scope

Phase 2 contains two workstreams.

### Workstream A: Daemon trace metrics

Extend existing `ws_runtime_metrics` logging so each metrics window exposes:

- outbound message counts
- outbound byte counts
- high-frequency stream drop counts
- slow-client/backpressure watermarks
- timeline fetch request/response volume

The metrics must remain cheap enough to keep in trace/info logging and must not reintroduce the hot-path cost removed in Phase 1.

### Workstream B: Benchmark scripts

Add local scripts that can be run repeatedly and emit:

- terminal summary for humans
- structured JSON for tooling

The scripts will cover:

- CLI startup benchmark
- timeline fetch benchmark

## Constraints

- No breaking message schema changes.
- No daemon restart as part of implementation logic.
- Benchmark scripts must work from the repo without requiring new external services.
- Benchmark scripts must tolerate local environment variance and report measurements rather than asserting brittle absolute thresholds.
- New instrumentation must not require production-only dependencies.

## Requirements

### Functional Requirements

#### R1. Outbound and backpressure metrics

Existing `ws_runtime_metrics` logs must be extended with metrics for:

- total outbound messages sent
- total outbound bytes sent
- outbound `agent_stream` messages sent
- outbound `agent_stream` messages dropped
- number of slow-client drop events
- maximum `bufferedAmount` observed during the metrics window
- number of sockets observed above the slow-client threshold during the metrics window

#### R2. Timeline fetch metrics

`ws_runtime_metrics` logs must include:

- count of `fetch_agent_timeline_request` requests
- total timeline entries returned
- total projected entries returned
- request distribution for bounded vs unbounded timeline fetches

These metrics should make it easy to verify that tail-oriented CLI flows are no longer defaulting to full-history fetches.

#### R3. Benchmark scripts

Benchmark scripts must:

- run from the repository with documented commands
- emit terminal-readable summaries
- optionally emit JSON results to stdout or file
- avoid requiring manual parsing of daemon logs to determine the result

### Output Requirements

#### CLI startup benchmark output

For each measured command:

- command label
- sample count
- individual timings or summary statistics
- mean / min / max wall time
- memory data when available

#### Timeline fetch benchmark output

For each measured fetch mode:

- scenario label
- request mode
- entry count returned
- elapsed time
- optionally repeated-sample statistics

#### JSON output

JSON output must be stable enough for later CI or regression comparison. At minimum it must include:

- suite name
- timestamp
- environment metadata
- scenario list
- numeric measurements per scenario

## Proposed Approach

### A. Daemon metrics

Extend `websocket-server.ts` runtime counters and runtime metrics flush payloads with:

- outbound counters updated in the existing send path
- backpressure counters updated in slow-client drop handling
- timeline fetch counters updated in `session.ts` request handling and/or emitted session runtime metrics

Use the existing `ws_runtime_metrics` windowed log event rather than creating a separate telemetry channel.

### B. Session/runtime metric plumbing

For timeline fetch visibility, feed request/entry counters into the metrics pipeline without requiring message schema changes. A suitable approach is:

- track per-session counters inside `Session`
- include them in `SessionRuntimeMetrics`
- aggregate them in websocket runtime metrics

### C. Benchmark scripts

Add scripts under `packages/server/scripts/` for:

- CLI startup benchmark using repeated child-process invocation
- timeline fetch benchmark using controllable client stubs or local in-memory scenarios

Each script should support:

- human-readable default output
- `--json` or `--json-output <path>` mode
- configurable iteration count where useful

## Acceptance Criteria

- `ws_runtime_metrics` logs include outbound, slow-client, and timeline fetch metrics.
- Added metrics are exercised by tests.
- CLI startup benchmark script runs locally and emits JSON.
- Timeline fetch benchmark script runs locally and emits JSON.
- Benchmark outputs are stable in structure even if absolute timings vary by machine.

## Risks

### Risk 1: Instrumentation reintroduces hot-path overhead

Mitigation:

- Use counters and simple numeric aggregation only.
- Avoid new per-message expensive serialization.
- Keep windowed logging and aggregate emission only.

### Risk 2: Benchmarks become too environment-sensitive

Mitigation:

- Report measurements rather than enforcing fixed pass/fail thresholds.
- Include sample arrays and summary statistics.
- Allow configurable iteration counts.

### Risk 3: Timeline metrics are split across layers and hard to aggregate

Mitigation:

- Use existing `SessionRuntimeMetrics` plumbing instead of inventing a parallel aggregation path.
- Keep per-session counters small and reset them at the existing runtime metrics flush boundary.

## Rollout Order

1. Add daemon metrics plumbing and tests.
2. Add benchmark scripts and JSON output.
3. Document usage in docs if script invocation needs operator guidance.

## Verification Plan

- Targeted server tests for outbound/backpressure/timeline metrics.
- Script-level verification that benchmark JSON output is produced and parseable.
- `npm run build --workspace=@getpaseo/server`
- `npm run build --workspace=@getpaseo/cli` when scripts invoke built CLI paths
- `npm run typecheck`
- `npm run format`

