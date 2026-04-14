# CLI/VPS Performance Phase 2 Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add daemon runtime trace metrics and repeatable benchmark scripts so CLI/VPS performance regressions can be observed and compared over time.

**Architecture:** Extend existing websocket runtime metrics with outbound, slow-client, and timeline-fetch counters, then add standalone benchmark scripts that exercise CLI startup and timeline fetch scenarios and emit both human-readable summaries and JSON results.

**Tech Stack:** TypeScript, Node.js, ws, existing Paseo daemon/session runtime metrics, tsx scripts, Vitest

---

### Task 1: Document Phase 2 scope

**Files:**
- Create: `docs/CLI_VPS_PERFORMANCE_PHASE2_OBSERVABILITY.md`
- Create: `docs/CLI_VPS_PERFORMANCE_PHASE2_PLAN.md`

- [ ] **Step 1: Write the Phase 2 requirements document**

Capture scope, non-goals, acceptance criteria, and rollout order for daemon metrics and benchmark scripts.

- [ ] **Step 2: Write the implementation plan**

Break the work into TDD-first tasks with exact files and verification commands.

### Task 2: Extend daemon runtime metrics

**Files:**
- Modify: `packages/server/src/server/websocket-server.ts`
- Modify: `packages/server/src/server/session.ts`
- Test: `packages/server/src/server/websocket-server*.test.ts`
- Test: add/update session runtime metric tests

- [ ] **Step 1: Write failing tests for outbound/backpressure/timeline metrics**

Cover:
- outbound send counters and bytes
- slow-client drop counters and max buffered amount
- timeline fetch request and entry counters appearing in runtime metrics

- [ ] **Step 2: Run targeted server tests to verify they fail**

Run: `npx vitest run <targeted-tests>`

Expected: metrics assertions fail because counters are not yet exposed.

- [ ] **Step 3: Add runtime counter fields and aggregation**

Update websocket runtime counters and/or aggregated session runtime metrics to include the new values.

- [ ] **Step 4: Re-run targeted server tests**

Run: `npx vitest run <targeted-tests>`

Expected: metrics tests pass.

### Task 3: Add CLI startup benchmark script

**Files:**
- Create: `packages/server/scripts/benchmark-cli-startup.ts`
- Optionally modify: `packages/server/package.json` if a script alias is warranted
- Test: add a script-output validation test if practical

- [ ] **Step 1: Write a failing validation test or smoke script expectation**

Cover:
- benchmark produces human-readable output
- `--json` or `--json-output` emits parseable JSON

- [ ] **Step 2: Run validation to verify failure**

Run the targeted test or smoke command before implementation.

- [ ] **Step 3: Implement CLI startup benchmark**

Benchmark representative commands, gather timing statistics, and emit structured JSON.

- [ ] **Step 4: Re-run validation**

Expected: output is produced and JSON parses successfully.

### Task 4: Add timeline fetch benchmark script

**Files:**
- Create: `packages/server/scripts/benchmark-timeline-fetch.ts`
- Test: add a script-output validation test if practical

- [ ] **Step 1: Write a failing validation test or smoke expectation**

Cover:
- bounded and unbounded scenarios are represented
- JSON output includes scenario measurements

- [ ] **Step 2: Run validation to verify failure**

- [ ] **Step 3: Implement timeline fetch benchmark**

Use a controllable local scenario or stubbed client path so the script is repeatable without requiring production services.

- [ ] **Step 4: Re-run validation**

Expected: script emits summary and parseable JSON.

### Task 5: Verification

**Files:**
- Modify: any touched files above

- [ ] **Step 1: Run targeted server tests**

Run: `npx vitest run <targeted-tests>`

Expected: PASS

- [ ] **Step 2: Build server**

Run: `npm run build --workspace=@getpaseo/server`

Expected: PASS

- [ ] **Step 3: Run benchmark scripts manually**

Run representative human-readable and JSON modes for both scripts.

Expected: valid summaries and JSON output

- [ ] **Step 4: Run monorepo typecheck**

Run: `npm run typecheck`

Expected: PASS

- [ ] **Step 5: Run formatter**

Run: `npm run format`

Expected: formatting changes applied cleanly

