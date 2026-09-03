---
id: rev-20260903-072418Z
slug: android-keyboard-terminal-pane-deprecation
title: Android keyboard fix + Terminal Pane deprecation review
kind: design
status: concluded
outcome: spawn_tickets
summary: "Restore imperative focus in PasteInput assignInputRef; deprecate Terminal Pane as default mobile entry"
created: 2026-09-03
updated: 2026-09-03
related_specs: [spc-1]
related_tickets: []
related_prs: []
---

# Review: Android keyboard fix + Terminal Pane deprecation

> **TL;DR:** Commit #4190 removed the imperative `focus()` from `assignInputRef`, breaking the Android keyboard; restoring it is a one-line fix. The Terminal Pane should be deprecated as default mobile entry — the Agent SDK structured path already provides equivalent capability without the rendering/input fragility.
> **Kind:** design · **Status:** concluded · **Outcome:** spawn_tickets
> **Next:** spawn_tickets → `create-tickets` from `spc-1`

## Context

Android users interacting with Claude Code agents cannot type — the soft keyboard never appears. Investigation traced the root cause to commit `8dd4da6ee` (#4190, "Keep mobile streaming and panel motion stable under JS stalls"), which refactored the key-swap remount mechanism in `packages/app/src/components/ui/text-input/text-input.native.tsx`. The old code (#4044) called `input.focus()` directly in the `assignInputRef` ref callback (fires after view mount); the new code relies on the `autoFocus` prop, which `PasteInput` (`@mattermost/react-native-paste-input` v2.0.1) does not honor reliably on Android due to Fabric view-command ordering.

Separately, the Terminal Pane — a custom RN cell-grid renderer (`TerminalGridView`) with a hidden 1px `TextInput` for PTY keystroke capture — is a persistent source of mobile fragility and lag. Paseo already has a superior structured path: the Agent SDK (`@anthropic-ai/claude-agent-sdk` `query()`) in `packages/server/src/server/agent/providers/claude/agent.ts`, which is the same architecture Claude Code's own Remote Control uses.

## Problem Audit

| Layer | Notes |
| --- | --- |
| Validity | Problem is real — users cannot input text. Root cause verified via git diff of #4190 vs #4044 in `text-input.native.tsx`. The code's own comment (lines 39-45) admits the fragility. |
| Information | Sufficient. Source files, git history, e2e test, and industry comparison all examined. No must-have gaps. |
| Hidden issues | The key-swap remount also affects the Terminal Pane's `TerminalInput` via `showNativeKeyboard` → `resetNativeInput()` → `replaceText("")`. Fixing `assignInputRef` fixes both surfaces. |
| Existing solution | The Agent SDK structured path already exists as the primary chat surface. It is the existing solution that meets the goal — the Terminal Pane is redundant for most users. |

## Comparison matrix

### Keyboard fix approach

| Option | Cost | Code-delta | Risk | Constraints | Capability |
| --- | --- | --- | --- | --- | --- |
| **Restore imperative focus in assignInputRef** (recommended) | Low | 3 lines | Low — restores verified #4044 logic | Must not reintroduce Fabric race #4190 was avoiding | Full keyboard reliability |
| Keep status quo (autoFocus prop only) | Zero | 0 | High — keyboard broken on Android | PasteInput autoFocus unreliable | Broken — no keyboard |
| Switch to stock RN TextInput | Medium | ~20 lines (separate paste-image handling) | Medium — loses paste-image support | Need alternative paste-image path | Full but loses paste images |
| Remove key-swap remount entirely | High | Major refactor of `replaceText` | High — stale IME buffer returns | Must find alternative buffer-clear mechanism | Unknown |

### Terminal Pane deprecation scope

| Option | Cost | Code-delta | Risk | Constraints | Capability |
| --- | --- | --- | --- | --- | --- |
| **Deprecate as opt-in** (recommended) | Low | ~10 lines (settings toggle + routing gate) | Low | Keep `isNative` gate | Power users keep access |
| Keep as default | Zero | 0 | High — ongoing lag/keyboard bugs | Maintenance burden grows | Full but broken |
| Delete entirely | Medium | Remove ~2000 lines across packages/app/src/terminal/ | Medium — power users lose raw terminal | No rollback path | Loses terminal access |

## Findings

1. **Root cause confirmed** — `git diff 6c813d1a9..8dd4da6ee -- packages/app/src/components/ui/text-input/text-input.native.tsx` shows #4190 removed `input.focus()` from `assignInputRef` and replaced it with `setReplacementFocus(true)`, relying on `autoFocus` prop. Evidence: `text-input.native.tsx:49-52` (new, no focus call) vs old `restoreFocusAfterResetRef` pattern.

2. **PasteInput autoFocus is unreliable on Android** — `PasteInput` is a third-party TextInput replacement (`@mattermost/react-native-paste-input`). Its `autoFocus` prop is applied by Fabric during mount, but the view may not be attached yet when the prop is read. The code's own comment (lines 39-45) states: *"Fabric also runs view commands before mount items, so a focus command sent alongside the swap reaches a view that is not attached yet and the IME ignores it."*

3. **The fix is the old code** — Commit #4044 (`6c813d1a9`) had `assignInputRef` call `input.focus()` directly after mount when `restoreFocusAfterResetRef.current` was true. This is the safe moment: the ref callback fires after React commits the mount, so the view is attached.

4. **Agent SDK path already exists and is primary** — `packages/server/src/server/agent/providers/claude/agent.ts:78` imports `query` from `@anthropic-ai/claude-agent-sdk`. The composer sends `sendAgentMessage` RPC → `sendPromptToAgent` → `startAgentRun` → Agent SDK `query()`. This is structured, not terminal-based. Claude Code's own Remote Control uses the same architecture (no terminal rendering).

5. **Terminal Pane is redundant for most users** — The Agent SDK chat path provides: message input (WebSocket RPC, not PTY keystrokes), structured output (tool calls, text, results as JSON events, not ANSI), permission handling (structured, not terminal prompts). The only capability the Terminal Pane adds that the Agent SDK path doesn't is raw terminal access for debugging.

6. **Terminal Pane lag is architectural** — `TerminalGridView` renders rows of RN `Text`/`View`/`Svg.Path` nodes. Claude Code's output volume (streaming text, ANSI escapes, tool output) means each output chunk triggers a full grid repaint on the JS thread. The coalescer helps but cannot prevent JS thread saturation under high output.

7. **e2e test exists** — `packages/app/e2e/mobile/composer-keyboard/android.sh` validates keyboard behavior on Android via `agent-device` + GBoard IME. It tests the composer path, not the terminal input path. The fix should make this test pass without modification.

## Recommendations

1. **Plan A (keyboard fix):** Restore imperative `focus()` in `assignInputRef` when `replacement.autoFocus` is true. Keep the `autoFocus` prop as a fallback. This is a 3-line change in one file.
2. **Plan D (Terminal Pane deprecation):** Add a settings toggle (`showTerminalPane`) gated behind `isNative`. Default to `false`. Remove Terminal Pane from default mobile navigation. Keep all Terminal Pane source code intact.
3. **Do not rewrite the Terminal Pane renderer** in this Spec. If the opt-in path proves insufficient, a future ADR can evaluate WebView + xterm.js.

## Outcome (required to conclude)

**`spawn_tickets`** — Scope is clear, Spec `spc-1` is locked with 6 acceptance criteria (A1-A6). Proceed to `create-tickets` to slice into delivery issues.

### Follow-ups

- [x] Spec `spc-1` — written
- [x] ADR `ADR-001` — written
- [ ] Tickets — `create-tickets` next
- [ ] Implementation — `start-work` after tickets

## References

- Root cause commit: `8dd4da6ee` (#4190)
- Prior fix commit: `6c813d1a9` (#4044)
- Keyboard fix target: `packages/app/src/components/ui/text-input/text-input.native.tsx:49-52`
- Terminal input: `packages/app/src/terminal/native-renderer/terminal-input.native.tsx:206-238`
- Agent SDK provider: `packages/server/src/server/agent/providers/claude/agent.ts:78`
- Composer submit: `packages/app/src/composer/actions.ts:205`
- Daemon handler: `packages/server/src/server/session.ts:3444`
- e2e test: `packages/app/e2e/mobile/composer-keyboard/android.sh`
- Claude Code Remote Control docs: https://code.claude.com/docs/en/remote-control
- Spec: `spc-1`
- ADR: `ADR-001`

## Links

Bare ids only in front matter lists (`spc-N`, not slugful).
