# CLI/VPS Performance Phase 1

## Background

Paseo will be used from headless VPS environments where the CLI is often invoked as a short-lived process and real-time agent output is consumed over higher-latency links than a local desktop setup. The current implementation shows three concrete problems:

1. CLI cold start is dominated by local module initialization rather than daemon round-trips.
2. `logs`, `attach`, and `wait` eagerly fetch full projected timelines even when only a small tail window is needed.
3. The daemon's real-time outbound path performs avoidable repeated JSON serialization and does not bound slow-client queue growth.

This document defines the Phase 1 scope for reducing CLI response time and lowering perceived real-time latency without introducing protocol-breaking changes.

## Goals

- Reduce CLI startup overhead for common short-lived commands.
- Reduce timeline payload size for tail-oriented CLI workflows.
- Reduce daemon CPU overhead on high-frequency outbound messages.
- Reduce latency amplification caused by slow WebSocket clients or relay hops.
- Preserve compatibility with older mobile app clients and existing daemon deployments.

## Non-Goals

- No breaking WebSocket or message schema changes.
- No relay protocol redesign.
- No `fetch_agents` / workspace git-placement optimization in this phase.
- No daemon restart model changes or new background services.
- No new persistent caching layer beyond lightweight in-process memoization if needed.

## Current Problems

### 1. CLI cold start is too heavy

The CLI entrypoint constructs the full command tree before parsing invocation intent. The command tree statically imports many subcommands, and CLI utilities import `@getpaseo/server` through the package root export, which in turn re-exports daemon, speech, provider, and structured-generation modules that are not needed for most CLI calls.

Impact:

- `paseo --version`, `paseo ls`, and other short commands pay a large startup cost before any useful work begins.
- Headless VPS automation suffers because many calls are one-shot processes rather than long-lived interactive sessions.

### 2. Timeline-oriented commands over-fetch history

CLI helpers currently fetch projected timelines with `limit: 0`, which requests the full available timeline window. Commands that only need a tail preview still download and process the full history first.

Impact:

- `logs --tail N` scales with full timeline size instead of requested tail size.
- `logs -f` and `attach` pay a large initial catch-up cost before showing live output.
- `wait` fetches full history for a short activity preview.

### 3. Real-time outbound path has avoidable hot-path overhead

The daemon serializes outbound session messages for trace logging and then serializes them again for WebSocket send. The send path does not apply bounded buffering or shedding for slow clients.

Impact:

- High-frequency `agent_stream` traffic does extra CPU work.
- Slow or high-latency clients can accumulate buffered WebSocket writes, making output arrive increasingly late.
- Relay or VPS scenarios are more likely to hit this behavior than local loopback usage.

## Scope

Phase 1 contains exactly three workstreams.

### Workstream A: CLI startup slimming

- Defer heavy command module loading until the selected command actually runs.
- Stop importing `DaemonClient` and CLI runtime helpers through the `@getpaseo/server` root export path when a lighter client-only entrypoint is sufficient.
- Preserve existing CLI surface area and command names.
- Preserve current invocation classification behavior, including `open-project` resolution.

### Workstream B: Timeline fetch reduction

- Add explicit tail-window fetching helpers for CLI commands that only need recent history.
- Update `logs`, `logs --follow`, `attach`, and `wait` to request bounded projected windows.
- Keep full-history retrieval available for commands that genuinely need it.
- Maintain existing user-visible output semantics as closely as possible.

### Workstream C: Daemon outbound-path optimization

- Remove unconditional duplicate serialization from the hot path.
- Introduce bounded handling for slow-client outbound pressure on high-frequency stream messages.
- Prefer dropping or coalescing stale stream updates over letting queue latency grow unbounded.
- Keep correctness for request/response messages and low-frequency state updates.

## Constraints

- Backward compatibility is mandatory:
  - No required new fields in existing messages.
  - No removed fields.
  - No narrowing of existing types.
- The main daemon on port 6767 must never be restarted as part of this work.
- Formatting must continue to use `npm run format`.
- Typecheck must pass after each implementation slice.
- Tests must cover behavior changes before implementation changes are added.

## Requirements

### Functional Requirements

#### R1. CLI startup

- Short-lived commands must avoid loading unrelated runtime modules before command selection.
- `paseo --version` and `paseo --help` must still work exactly as before.
- Commands that need daemon access must continue to connect through the existing `DaemonClient` protocol.

#### R2. Timeline fetch behavior

- `logs --tail N` must request only the recent projected window needed to render the last `N` items.
- `logs --follow` must request only a bounded warm-up tail before switching to live events.
- `attach` must request only a bounded initial projected window before live streaming.
- `wait` must request only the small preview window it renders in the result message.

#### R3. Real-time outbound path

- The daemon must not pay duplicate JSON serialization cost for every outbound session message merely to compute log metadata.
- The daemon must detect slow WebSocket clients and bound backlog growth for high-frequency stream traffic.
- High-priority RPC responses and control/status messages must not be dropped.

### Performance Requirements

These are target improvements, not hard release blockers, but each change must move in the intended direction and be measurable in local verification.

- P1. CLI cold start for `node packages/cli/bin/paseo --version` should materially improve from the current multi-second baseline.
- P2. Tail-oriented commands should transfer and process substantially fewer timeline entries for large histories.
- P3. Slow-client handling should prevent unbounded `bufferedAmount` growth for high-frequency `agent_stream` traffic.

### Observability Requirements

- Add or preserve enough logging to confirm when slow-client protection activates.
- Keep logs concise and avoid turning the hot path into a new logging bottleneck.

## Proposed Approach

### A. CLI startup slimming

- Introduce a lighter client-facing export path in `@getpaseo/server` for `DaemonClient` and small config helpers, or import client modules directly from a lighter package export.
- Refactor CLI command registration so subcommand implementations are loaded lazily rather than via one large static import graph.
- Keep top-level CLI metadata resolution lightweight.

### B. Timeline fetch reduction

- Extend CLI timeline utilities to support bounded projected fetches.
- Use requested tail counts directly where available.
- Use small default warm-up windows for `follow` and `attach`.
- Keep full-history mode opt-in rather than default.

### C. Daemon outbound optimization

- Replace unconditional `JSON.stringify(msg).length` trace logging with cheaper metadata or gated serialization.
- Add a per-socket slow-client strategy for `agent_stream` traffic:
  - monitor `bufferedAmount` when available,
  - avoid sending stale stream updates once the socket is already backed up,
  - preserve non-stream responses and critical updates.

## Acceptance Criteria

### CLI startup

- `paseo --version` still prints the current version.
- `paseo ls` still works against the daemon with no behavior regression.
- Startup profiling shows a clear reduction in wall time and/or peak memory versus the current baseline.

### Timeline fetch reduction

- `logs --tail 10` does not issue a full-history timeline request.
- `logs --follow` only warms up with a bounded tail window before live mode.
- `attach` only warms up with a bounded tail window before live mode.
- `wait` only fetches the small preview window it renders.

### Daemon outbound optimization

- Outbound session messages are not serialized twice in the normal hot path.
- Slow-client protection can be exercised in tests.
- RPC responses still arrive correctly under the new send policy.

## Risks

### Risk 1: CLI lazy loading changes help text or command registration semantics

Mitigation:

- Add tests around command classification and representative commands.
- Keep command names and options defined at registration time even if implementations load lazily.

### Risk 2: Smaller timeline warm-up windows hide context users expect

Mitigation:

- Use explicit, documented warm-up defaults.
- Keep output formatting unchanged once entries are fetched.
- Ensure requested `--tail` values are honored.

### Risk 3: Slow-client protection accidentally drops important messages

Mitigation:

- Restrict shedding/coalescing to high-frequency stream traffic only.
- Never drop correlated RPC responses or server info/status messages.
- Add tests that distinguish droppable and non-droppable message classes.

## Rollout Order

1. CLI startup slimming
2. Timeline fetch reduction
3. Daemon outbound optimization

This order gives early wins to headless CLI usage while keeping later daemon changes focused and measurable.

## Verification Plan

- Unit tests for command loading behavior and timeline fetch helper behavior.
- Unit/integration tests for daemon outbound send policy.
- Local command timing spot-checks before and after changes:
  - `node packages/cli/bin/paseo --version`
  - representative short-lived CLI commands
- Typecheck and formatter verification across the monorepo.

