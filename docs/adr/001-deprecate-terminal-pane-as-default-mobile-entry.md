# ADR 001: Deprecate Terminal Pane as default mobile entry

- **Status:** Proposed
- **Date:** 2026-09-03
- **Deciders:** maintainers
- **Related:** `spc-1`
- **Related ADRs:** (none)

## Goal

Mobile users interacting with Claude Code (and other terminal-based agents) experience lag from the custom RN cell-grid terminal renderer and input reliability failures from the hidden 1px TextInput PTY-keystroke capture pipeline. The underlying problem: rendering a live terminal emulator on mobile is expensive and fragile, while a superior structured communication path already exists and is unused as the default entry.

## Context

Paseo has two interaction surfaces for agents:

1. **Agent SDK structured path** (`packages/server/src/server/agent/providers/claude/agent.ts`) — spawns Claude Code via `@anthropic-ai/claude-agent-sdk` `query()`, receives structured JSON events (tool calls, text, results, permissions), renders them as chat messages in an inverted FlatList. Input is a `TextInput`-based composer sending WebSocket RPCs. This is the same architecture Claude Code's own Remote Control uses.

2. **Terminal Pane** (`packages/app/src/terminal/native-renderer/`) — spawns Claude Code in a `node-pty` interactive TTY, parses ANSI with headless xterm, renders a custom RN cell-grid (`TerminalGridView`) of Text/View/SVG nodes. Input is a hidden 1px `PasteInput` that captures keystrokes and encodes them as binary WebSocket Input frames.

The Terminal Pane is the source of:
- **Rendering lag** — each output frame repaints rows of RN Text nodes; Claude Code's high output volume overwhelms the JS thread
- **Keyboard input fragility** — the hidden TextInput + key-swap remount race (commit #4190 regression) prevents the keyboard from opening on Android
- **Maintenance burden** — CJK IME composition, ANSI parsing, selection, resize, Fabric view-command ordering, and the PTY input pipeline are all delicate, high-churn code

The Agent SDK path is already the primary chat surface. The Terminal Pane is an additional surface that duplicates interaction capability at higher cost.

## Decision Drivers

- Mobile UX: keyboard must appear reliably; output must render without lag
- Maintenance cost: the Terminal Pane input pipeline is disproportionately fragile
- Architecture alignment: Claude Code's own Remote Control uses structured events, not terminal rendering
- Power-user needs: some users need raw terminal access for debugging

## Considered Options

- **Keep status quo** (Terminal Pane as default entry) — good: raw terminal fidelity; bad: lag, keyboard bugs, high maintenance, diverges from Remote Control architecture
- **Deprecate Terminal Pane as default, keep as opt-in** — good: eliminates lag/keyboard issues for most users, aligns with Remote Control, preserves power-user access; bad: opt-in path needs a settings toggle and routing gate
- **Delete Terminal Pane entirely** — good: simplest; bad: removes raw terminal access for power users who need it

## Decision

We will deprecate the Terminal Pane as the default mobile entry surface. The Agent SDK structured path is the only default interaction surface for all agents on mobile. The Terminal Pane source code remains in the repository, accessible via an explicit opt-in settings toggle gated behind `if (isNative)`.

No new terminal-based interaction surface will be added for mobile. All new agent providers use the Agent SDK structured path.

## Consequences

- **Positive:** Eliminates the primary source of mobile lag and keyboard input failures for most users. Aligns mobile architecture with Claude Code's Remote Control. Reduces maintenance surface area.
- **Negative / trade-offs:** Power users must discover and enable the Terminal Pane toggle. The Terminal Pane code remains in the repo and still needs maintenance when used.
- **Follow-ups:** `spc-1` (Plan A keyboard fix + Plan D default entry deprecation)
- **Verification:** Default mobile navigation does not surface a Terminal Pane entry. Settings toggle exists and is gated by `isNative`. Agent SDK chat remains the only default entry for all supported agents.

## Status history

- 2026-09-03: Proposed (co-created with `spc-1`; preceding review `rev-20260903` carries the comparison analysis)

## Notes

The Terminal Pane's custom RN grid renderer may be replaced with WebView + xterm.js in a future ADR if the opt-in path proves insufficient for power users. That decision is deferred until the opt-in is validated in production.

---

_Not a Lattice bloodline/graph node. Cite from Spec/PR/Review with `ADR-001` or this path._
