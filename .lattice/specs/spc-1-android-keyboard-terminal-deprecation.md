---
id: spc-1
slug: android-keyboard-terminal-deprecation
title: Android keyboard fix + Terminal Pane deprecation
kind: feat
status: locked
mode: C
priority: P1
summary: "Fix Android keyboard not appearing in Claude Code composer; deprecate Terminal Pane as default mobile entry"
created: 2026-09-03
updated: 2026-09-03
tickets: []
prs: []
reviews: []
supersedes: []
superseded_by: null
---

# Spec: Android keyboard fix + Terminal Pane deprecation

> **TL;DR:** Restore imperative focus in PasteInput assignInputRef so the Android soft keyboard appears; deprecate the Terminal Pane as the default mobile entry surface in favor of the Agent SDK structured path already used for agent chat.
> **Kind:** feat · **Status:** locked · **Mode:** C · **Priority:** P1
> **Path:** spc-1 → tkt-… → pr-…

## Why

Android users cannot type into the Claude Code agent composer — the soft keyboard never appears. Commit `8dd4da6ee` (#4190, "Keep mobile streaming and panel motion stable under JS stalls") removed the imperative `focus()` call from `assignInputRef` in `packages/app/src/components/ui/text-input/text-input.native.tsx`, replacing it with reliance on the `autoFocus` prop. `PasteInput` (from `@mattermost/react-native-paste-input` v2.0.1) does not honor `autoFocus` reliably on Android: Fabric applies the prop before the view is fully attached, and the IME ignores the focus request. The old code (commit #4044) called `input.focus()` directly in the ref callback — the one moment the view is guaranteed attached.

Separately, the Terminal Pane — a custom RN cell-grid renderer with a hidden 1px TextInput for PTY keystroke capture — is a source of ongoing fragility (CJK IME races, key-swap remount timing, rendering lag under Claude Code's high output volume). Paseo already has a superior path: the Agent SDK structured communication (`@anthropic-ai/claude-agent-sdk` `query()` in `packages/server/src/server/agent/providers/claude/`), which is the same architecture Claude Code's own Remote Control uses. The Terminal Pane should not be the default mobile entry.

## In scope

- Restore imperative `focus()` in `assignInputRef` when a replacement `autoFocus` is pending (Plan A)
- Hide the Terminal Pane entry from default mobile navigation; keep Agent SDK chat as the only default interaction surface (Plan D)
- Preserve Terminal Pane access via an explicit opt-in (settings toggle or advanced menu) for power users

## Out of scope

- Replacing the Terminal Pane's custom RN grid renderer with WebView + xterm.js (future work)
- Agent Stream rendering optimization with FlashList (separate effort)
- Removing the Terminal Pane code entirely (kept as opt-in, not deleted)

## Acceptance

- [ ] **A1** Tapping the Claude Code agent composer on Android opens the soft keyboard within 500ms
- [ ] **A2** After submitting a message (which triggers `replaceText("")` + key-swap remount), tapping the composer again opens the keyboard
- [ ] **A3** The Terminal Pane is not reachable from default mobile navigation (no tab, no auto-open)
- [ ] **A4** An explicit opt-in path exists to access the Terminal Pane (settings toggle or advanced menu)
- [ ] **A5** The Agent SDK chat path remains the only default entry for all supported agents on mobile
- [ ] **A6** Existing e2e test `packages/app/e2e/mobile/composer-keyboard/android.sh` passes on the fix

## Non-goals

- Will not rewrite the Terminal Pane renderer or its input pipeline
- Will not remove the Terminal Pane source code from the repository

## Decisions (principal, user-confirmed)

1. **Restore imperative focus, not switch to stock TextInput.** The `PasteInput` key-swap remount is the correct mechanism for clearing stale IME buffers; the bug is the missing `focus()` call in `assignInputRef`, not the architecture. Fix the one line, don't rewrite the input stack.
2. **Deprecate, don't delete.** The Terminal Pane stays in the codebase behind an opt-in. Some power users need raw terminal access. Hiding the entry, not removing the code, is the right altitude.
3. **Agent SDK is the primary path.** No new terminal-based interaction surface will be added for mobile. All new agent providers use the structured Agent SDK path.

## Agent-assumed (secondary)

- The `autoFocus` prop approach in #4190 was intended to fix a Fabric view-command-ordering race, not to intentionally remove imperative focus. The fix restores `focus()` in `assignInputRef` while keeping the `autoFocus` prop as a belt-and-suspenders fallback.
- The Terminal Pane opt-in can be a simple settings boolean gated behind `if (isNative)` — no complex routing change needed.

## Risks / open questions

- Does the restored `focus()` in `assignInputRef` reintroduce the Fabric race that #4190 was trying to fix? The old code (#4044) didn't have this issue because the ref callback fires after mount, but Fabric's commit ordering may have changed. Needs testing on a real Android device.
- Where exactly should the Terminal Pane opt-in live in the settings UI? Needs a quick UX decision.

## References

- Root cause commit: `8dd4da6ee` (#4190)
- Prior fix: `6c813d1a9` (#4044)
- Terminal input: `packages/app/src/terminal/native-renderer/terminal-input.native.tsx`
- Composer input: `packages/app/src/components/ui/text-input/text-input.native.tsx`
- Claude provider (Agent SDK): `packages/server/src/server/agent/providers/claude/agent.ts`
- ADR: `ADR-001` → `docs/adr/001-deprecate-terminal-pane-as-default-mobile-entry.md`

## Links / bloodline (L0)

- Tickets: (to be created via `create-tickets`)
- PRs: (to be opened)
- Reviews: (to be created via `create-review`)
