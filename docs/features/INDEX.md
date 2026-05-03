```
   docs/features/INDEX.md
        │
        ├── feature canned answers (one short doc per feature)
        │
        └── linked from CLAUDE.md / AGENTS.md as a single pointer
```

# Features Index

Per-feature canned answers. Each entry follows the 6-section template
(`Goal`, `Status`, `How it works`, `How to verify`, `Known limitations`, `Links`)
and stays ≤ 180 lines. CLAUDE.md / AGENTS.md just point here — they don't
inline the canned answer.

| Feature | One-liner | Doc |
|---------|-----------|-----|
| Calibrator v2 | Self-calibrate every rule's `confidence` and `tier` from observed success/failure events | [calibrator-v2.md](calibrator-v2.md) |
| Team knowledge sharing | Dual-layer store routes `personal/global` today; `team` (git-synced MDC) is Phase 4 — writes still throw | [team-share.md](team-share.md) |

When asked _"how does feature X work?"_ — pick the matching row, open the
doc, summarise from `Status` + `How it works`. Never inline a canned answer
back into CLAUDE.md / AGENTS.md.
