---
id: tkt-2
spec: spc-1
title: Restore imperative focus in assignInputRef for Android keyboard
status: open
priority: P1
covers: [A1, A2, A6]
ship: one-PR
---

# tkt-2: Restore imperative focus in assignInputRef for Android keyboard

> Issue: https://github.com/M1n9X/paseo/issues/2
> Spec: spc-1 · Covers: A1, A2, A6

## Why

Android users cannot type into the Claude Code agent composer. Commit #4190 removed the imperative `focus()` from `assignInputRef`, replacing it with the `autoFocus` prop. `PasteInput` doesn't honor `autoFocus` reliably on Android.

## Approach

Touch set: `packages/app/src/components/ui/text-input/text-input.native.tsx` (assignInputRef, ~3 lines)

In `assignInputRef`, when the new instance attaches and `replacement.autoFocus` is true:
1. Clear `replacement.autoFocus` (prevent re-trigger)
2. Call `input.focus()` directly — ref callback fires after mount, so the view is attached and the IME will respond

This restores the verified #4044 logic while keeping the #4190 `autoFocus` prop as fallback.

## Anticipated decisions

- Does restored `focus()` reintroduce the Fabric race #4190 was fixing? → **pre-resolved**: ref callback fires after mount (unlike `autoFocus` prop applied during commit), so the view is guaranteed attached.
- Should we also remove the `autoFocus` prop? → **pre-resolved**: keep as fallback; removing has no benefit and risks other platforms.

## References

- Spec: `spc-1`
- Root cause commit: `8dd4da6ee` (#4190)
- Prior fix commit: `6c813d1a9` (#4044)
- Target file: `packages/app/src/components/ui/text-input/text-input.native.tsx:49-52`
