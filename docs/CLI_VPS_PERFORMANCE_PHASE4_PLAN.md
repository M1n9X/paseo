# CLI/VPS Performance Phase 4 Regression Workflow Plan

## Goal

Provide a local wrapper that automates baseline capture and baseline-vs-candidate comparison using the benchmark generation and comparison tooling from earlier phases.

## Deliverables

- `packages/server/scripts/benchmark-regression.ts`
- package script alias for the workflow
- tests covering capture, compare, and summary formatting
- docs describing how to run the workflow locally

## Verification

- targeted tests for workflow orchestration
- manual `capture` run
- manual `compare` run
- JSON output smoke test
- `npm run build --workspace=@getpaseo/server`
- `npm run typecheck`
- `npm run format`

