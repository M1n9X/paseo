# CLI/VPS Performance Phase 3 Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local benchmark comparison script that reads two JSON result files and reports `improved` / `regressed` / `unchanged` outcomes with machine-readable output.

**Architecture:** Introduce a suite-aware comparison layer for existing benchmark JSON formats, using primary metric thresholds for classification and separate structural validation to prevent misleading comparisons.

**Tech Stack:** TypeScript, Node.js, existing benchmark JSON formats, tsx scripts, Vitest

---

### Task 1: Document Phase 3 scope

**Files:**
- Create: `docs/CLI_VPS_PERFORMANCE_PHASE3_COMPARISON.md`
- Create: `docs/CLI_VPS_PERFORMANCE_PHASE3_PLAN.md`

- [ ] **Step 1: Write the requirements document**

Document comparison scope, threshold rules, output model, and invalid-comparison handling.

- [ ] **Step 2: Write the implementation plan**

Break the comparison work into TDD-first tasks and exact verification steps.

### Task 2: Add comparison model and tests

**Files:**
- Create: `packages/server/scripts/compare-benchmark-results.ts`
- Test: create focused comparison tests under `packages/server/src/server/`

- [ ] **Step 1: Write failing tests for suite-aware comparison**

Cover:
- suite mismatch rejection
- `cli-startup` improved/regressed/unchanged classification
- timeline structural mismatch reporting
- timeline `invalid-comparison` when `entriesReturned` or `rowsProcessed` differ

- [ ] **Step 2: Run targeted tests to verify failure**

Run: `npx vitest run <comparison-tests>`

Expected: failures because comparison logic does not yet exist.

- [ ] **Step 3: Implement comparison result model**

Build structured comparison output first, including threshold config and structural differences.

- [ ] **Step 4: Re-run targeted tests**

Expected: comparison model tests pass.

### Task 3: Add terminal and JSON output to the compare script

**Files:**
- Modify: `packages/server/scripts/compare-benchmark-results.ts`
- Optionally modify: `packages/server/package.json` if a script alias is warranted
- Test: extend comparison tests for formatting and JSON output

- [ ] **Step 1: Write failing tests for output behavior**

Cover:
- human-readable summary contains statuses and deltas
- JSON output includes scenario comparison entries and structural differences

- [ ] **Step 2: Run targeted tests to verify failure**

- [ ] **Step 3: Implement terminal summary and JSON output**

Add CLI flags for:
- `--baseline`
- `--candidate`
- `--json`
- `--json-output`
- threshold overrides

- [ ] **Step 4: Re-run targeted tests**

Expected: formatting and JSON-output tests pass.

### Task 4: Verification

**Files:**
- Modify: any touched files above

- [ ] **Step 1: Run targeted comparison tests**

Run: `npx vitest run <comparison-tests>`

Expected: PASS

- [ ] **Step 2: Generate sample benchmark JSON files**

Run the existing benchmark scripts to produce temporary JSON fixtures.

- [ ] **Step 3: Run the compare script manually**

Run the compare script against the generated files in both terminal and JSON modes.

Expected: clear statuses and valid JSON output

- [ ] **Step 4: Build server**

Run: `npm run build --workspace=@getpaseo/server`

Expected: PASS

- [ ] **Step 5: Run monorepo typecheck**

Run: `npm run typecheck`

Expected: PASS

- [ ] **Step 6: Run formatter**

Run: `npm run format`

Expected: formatting changes applied cleanly

