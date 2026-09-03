---
id: tkt-3
spec: spc-1
title: Deprecate Terminal Pane as default mobile entry surface
status: open
priority: P2
covers: [A3, A4, A5]
ship: one-PR
---

# tkt-3: Deprecate Terminal Pane as default mobile entry surface

> Issue: https://github.com/M1n9X/paseo/issues/3
> Spec: spc-1 · Covers: A3, A4, A5

## Why

The Terminal Pane (custom RN cell-grid renderer + hidden 1px TextInput for PTY keystroke capture) is a source of mobile fragility and lag. The Agent SDK structured path already provides equivalent capability. The Terminal Pane should not be the default mobile entry.

## Approach

Touch set: settings/preferences module, mobile navigation/router, `packages/app/src/constants/platform.ts`

1. Add a boolean preference `showTerminalPane` (default: `false`) to the app settings model
2. Gate the Terminal Pane navigation entry behind `if (isNative && showTerminalPane)` — on web, keep Terminal Pane accessible as before
3. Add the toggle to the mobile settings screen under an Advanced section

## Anticipated decisions

- Where in settings UI should the toggle live? → **agent-decides**: under an existing Advanced section
- Should web keep Terminal Pane as default? → **pre-resolved**: yes, deprecation is mobile-only (`isNative` gate)
- Should we show a one-time notice when first enabling? → **agent-decides**: optional; simple toast if added

## References

- Spec: `spc-1`
- ADR: `ADR-001`
- Claude provider (Agent SDK): `packages/server/src/server/agent/providers/claude/agent.ts`
- Platform gates: `packages/app/src/constants/platform.ts`
