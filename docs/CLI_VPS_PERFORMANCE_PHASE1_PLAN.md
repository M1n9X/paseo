# CLI/VPS Performance Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce headless-VPS CLI latency by slimming CLI startup, reducing timeline over-fetching, and lowering daemon real-time outbound overhead without breaking protocol compatibility.

**Architecture:** Split Phase 1 into three isolated workstreams. First make CLI command/runtime loading lighter, then constrain timeline warm-up windows for tail-oriented commands, then optimize daemon outbound message handling with bounded slow-client behavior for high-frequency stream traffic.

**Tech Stack:** TypeScript, Commander, Node.js, ws, existing Paseo daemon WebSocket protocol, Vitest/npm test tooling

---

### Task 1: Document the phase scope in the repository

**Files:**
- Create: `docs/CLI_VPS_PERFORMANCE_PHASE1.md`
- Create: `docs/CLI_VPS_PERFORMANCE_PHASE1_PLAN.md`

- [ ] **Step 1: Write the requirements document**

Capture background, scope, constraints, acceptance criteria, and rollout order for the three approved optimizations.

- [ ] **Step 2: Write the implementation plan**

Break the work into TDD-first tasks with exact files and verification steps.

- [ ] **Step 3: Confirm the plan stays within Phase 1 scope**

Check that the plan excludes `fetch_agents` / placement optimization and any protocol-breaking changes.

### Task 2: Slim CLI startup with lazy loading and lighter imports

**Files:**
- Modify: `packages/cli/src/index.ts`
- Modify: `packages/cli/src/cli.ts`
- Modify: `packages/cli/src/utils/client.ts`
- Modify: `packages/server/package.json`
- Modify: `packages/server/src/server/exports.ts` or add lighter client export files
- Test: `packages/cli/src/classify.test.ts`
- Test: add focused CLI-loading test file under `packages/cli/src/`

- [ ] **Step 1: Write a failing test for lightweight CLI bootstrap behavior**

Add a test that proves representative short-lived CLI entrypoints can be initialized without eagerly importing unrelated heavy modules.

- [ ] **Step 2: Run the targeted CLI test to verify it fails**

Run: `npm test --workspace=@getpaseo/cli`

Expected: a failure showing current eager loading behavior.

- [ ] **Step 3: Introduce a lighter server client import path**

Expose `DaemonClient` and small client-side helpers from a client-only package export or direct lighter module path so CLI no longer imports the heavy root export graph.

- [ ] **Step 4: Refactor CLI command loading to be lazy**

Keep command names/options registered, but defer heavier implementation imports until command execution.

- [ ] **Step 5: Re-run CLI tests**

Run: `npm test --workspace=@getpaseo/cli`

Expected: targeted bootstrap tests pass.

- [ ] **Step 6: Spot-check CLI timing locally**

Run: `node packages/cli/bin/paseo --version`

Expected: clear wall-time improvement from the previous baseline.

### Task 3: Reduce timeline over-fetch in CLI tail-oriented commands

**Files:**
- Modify: `packages/cli/src/utils/timeline.ts`
- Modify: `packages/cli/src/commands/agent/logs.ts`
- Modify: `packages/cli/src/commands/agent/attach.ts`
- Modify: `packages/cli/src/commands/agent/wait.ts`
- Test: add/update CLI unit tests covering timeline fetch request parameters

- [ ] **Step 1: Write failing tests for bounded timeline requests**

Cover:
- `logs --tail N` requests a bounded projected tail
- `logs --follow` requests only a bounded warm-up tail
- `attach` requests only a bounded warm-up tail
- `wait` requests only the preview window size

- [ ] **Step 2: Run the targeted CLI tests to verify they fail**

Run: `npm test --workspace=@getpaseo/cli`

Expected: failures showing the current `limit: 0` behavior.

- [ ] **Step 3: Add bounded timeline helper APIs**

Update CLI timeline utilities so callers can request projected tails with explicit limits.

- [ ] **Step 4: Update the commands to use bounded fetches**

Use command-specific limits without changing user-visible transcript formatting.

- [ ] **Step 5: Re-run the targeted CLI tests**

Run: `npm test --workspace=@getpaseo/cli`

Expected: new bounded-fetch tests pass.

### Task 4: Optimize daemon outbound hot path and slow-client handling

**Files:**
- Modify: `packages/server/src/server/session.ts`
- Modify: `packages/server/src/server/websocket-server.ts`
- Test: add/update tests under `packages/server/src/server/`

- [ ] **Step 1: Write failing tests for outbound serialization and slow-client protection**

Cover:
- hot-path outbound logging no longer requires duplicate full serialization
- high-frequency `agent_stream` traffic is bounded when the socket is slow
- correlated RPC responses are still delivered

- [ ] **Step 2: Run the targeted server tests to verify they fail**

Run: `npm test --workspace=@getpaseo/server`

Expected: failures demonstrating current repeated serialization or unbounded stream send behavior.

- [ ] **Step 3: Remove duplicate hot-path serialization**

Replace expensive trace payload-size computation with cheaper metadata or gated logic.

- [ ] **Step 4: Add bounded send behavior for slow sockets**

Apply protection only to droppable high-frequency stream traffic and preserve critical message classes.

- [ ] **Step 5: Re-run targeted server tests**

Run: `npm test --workspace=@getpaseo/server`

Expected: outbound-path tests pass.

### Task 5: Full verification

**Files:**
- Modify: any touched files above

- [ ] **Step 1: Run CLI tests**

Run: `npm test --workspace=@getpaseo/cli`

Expected: PASS

- [ ] **Step 2: Run server tests**

Run: `npm test --workspace=@getpaseo/server`

Expected: PASS

- [ ] **Step 3: Run monorepo typecheck**

Run: `npm run typecheck`

Expected: PASS

- [ ] **Step 4: Run formatter**

Run: `npm run format`

Expected: formatting changes applied cleanly

- [ ] **Step 5: Re-run a representative CLI timing spot-check**

Run: `node packages/cli/bin/paseo --version`

Expected: improved wall time relative to the original baseline

