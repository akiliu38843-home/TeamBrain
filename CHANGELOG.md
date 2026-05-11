# TeamBrain CHANGELOG

```
   plan ──► implement ──► review ──► ship
                          │
                          ▼
                    CHANGELOG entry
```

User-visible behaviour changes go here. Internal refactors that don't change
observable behaviour (CLI flags, file layouts, hook side-effects, on-disk
artifacts the user sees) do NOT need an entry.

## Unreleased

### Added

- **Newsboard SessionStart banner** (#233, #235). Every Claude Code SessionStart
  now renders a 4-section ASCII duck MOTD via `.claude/hooks/newsboard-session-start.sh`,
  with all Chinese copy maintained in `docs/newsboard.md` (the hook only does
  `{{TOKEN}}` substitution). Strict-format CI guard
  (`scripts/verify-newsboard-format.sh`) blocks malformed templates before merge.
- **Hourly Max-quota + dashboard progress bar** (#283, #285). The dashboard now
  surfaces the user's Max-plan quota as a percentage with a progress bar, and
  the digital-twin sidecar uploads the day's incremental log on the hour instead
  of waiting for session end — so a long-running session shows up in the team
  view before it closes.
- **`/grill-via-web` skill** (#286). Pops clickable ChatGPT and Claude.ai URLs
  that prefill a `/grill-me` prompt referencing a public GitHub issue, so a
  human can finish the grill in a browser tab without local Claude / API. The
  skill is installed at project level (`.claude/skills/grill-via-web/`,
  `.codex/skills/grill-via-web/`).
- **`teamagent init` mirrors 4 static user-level skills + doctor propagation
  report** (#288). `teamagent init` now mirrors `.claude/skills/<name>/`
  (currently 4 canonical skills) into `~/.claude/skills/<name>/` so user-level
  Claude Code sessions in any cwd see the project's skill bundle. `teamagent
  doctor` gains a propagation report section showing which project-level
  configs have actually landed in `~/.claude/`, `~/.codex/`, and `~/.teamagent/`,
  matching the contract in `docs/INIT-PROPAGATION.md`.

### Changed

- **Business features now ship with a 4-layer evidence matrix**
  (`docs/BUSINESS-FEATURES.md`). Each of the three business features
  carries proof for four independent audiences: CEO narrative, Coder
  file paths, Machine-readable JSON+SQL, and LLM-readable raw
  artifacts. Same RUN→DUMP→READ shape as the project testing rule —
  four-layer pass means the feature is real, one-layer pass means it's
  a pitch slide. README gains a top-level "三大业务特性" section linking
  to the matrix.
- **FIXEDFLOW driver review loop is now policy-canonical** (#279). The driver's
  `/review` fix-loop never ends until `/review` returns PASS — no max-iter,
  no token-budget exit, no auto-`needs-human`. If multiple drivers race on the
  same `.codex/worktrees/issue-<N>/`, the first wins by `.lock` sentinel and
  later drivers retreat cleanly. If squash-merge fails after rebase, the driver
  keeps retrying (fetch / rebase / push --force-with-lease / retry merge) until
  the PR is closed upstream or `maintainer` kills the process. See
  `docs/FIXEDFLOW.md` for the full policy.
- **Inner-loop test execution moved to CI on `wip/**` branches** (#270,
  ADR-0013). Local `pnpm test` is no longer recommended for full test runs
  because ≥4 parallel sessions saturate the macOS scheduler queue (measured
  loadavg 274 on `toohot` with normal thermals — a scheduler overload, not a
  thermal wall). Push to `wip/<name>` to trigger
  `.github/workflows/inner-loop.yml`. Local `pnpm vitest run <file>` for
  targeted single-file runs is still allowed.

### Removed

- **`.codex/worktrees/` placement policy and cascade deprecation** (#281).
  Drop the long-standing convention that user-facing worktrees had to live
  under `.codex/worktrees/`. The new canonical layouts: Codex →
  `.codex/worktrees/issue-<N>/`, Claude Code → `.claude/worktrees/<name>/`
  (via `claude -w`). See `docs/ISOLATED-WORKTREE.md` for the full provider
  contract.

## 0.11.0 — 2026-05-09

Closes the three follow-ups captured in PR #232 § 8 ("Follow-up captured for next major version") via one bundled cleanup PR. See `docs/plans/2026-05-09-install-hook-cleanup-v0.11/plan.md` for the full scope decision. Bumps from 0.10.x with one user-visible deprecation and one performance fix specific to working inside the TeamBrain repo itself.

### Deprecated

- **`teamagent install-user-hook` is now a soft-retire shim**. The
  command body is reduced to a thin wrapper around the shared
  `applyUserLevelChannelOps` helper added in this PR; the deprecation
  banner now points users at `teamagent init` and avoids leaking
  internal helper names. The standalone command remains functional
  through the v1.0 deprecation window because
  `packages/teamagent/postinstall.mjs:365` still calls it directly
  during every `npm install -g teamagent` — hard-deletion is the v1.0
  cut.

### Fixed

- **In-TeamBrain double-tap on Stop hook eliminated**. Pre-v0.11 the
  TeamBrain repo's committed `.claude/settings.json` registered both a
  `digital-twin-tap.sh` bash wrapper AND `bin-digital-twin-tap.cjs`
  (user-level via `teamagent init`), so every Stop event spawned the
  digital-twin tap twice. `tapSession()`'s `(cwd, session_id)` idempotency
  dedup'd the database write, but the wasted process spawns and file
  reads (~50ms per Stop) added up. v0.11.0 drops the `.sh` wrapper and
  collapses to the `.cjs` user-level path alone — net 1 spawn per Stop
  in TeamBrain (previously 2) and unchanged in other projects (still 1).

## [0.10.5] — 2026-05-09

### Added

- **Issue #225**: Soft-force upgrade prompt — when a new version is available,
  every SessionStart now surfaces a three-choice banner (`teamagent update --now`
  立刻升级, `--snooze` 下次再说, `--never` 永远别问). Snooze backs off 24h →
  48h → 7d so a user who keeps deferring isn't pestered every shell.
  CHANGELOG-driven "what's new" bullets ride along on the prompt, the post-init
  tail, and a new `teamagent whatsnew` command — all three surfaces share one
  pure parser so they stay in sync. `TEAMAGENT_NEVER_PROMPT=1` env var is the
  CI / dogfood-probe escape hatch; `teamagent update --enable` resets snooze +
  never_prompt back to defaults. Auto-update polling itself is unchanged —
  only the user-facing banner is upgraded.

### Removed

- **PR #231 / Issue #229**: Removed `scripts/fixed-flow-watcher.sh` (the local
  poller that watched GitHub for `grill-ready` issues and forked `mainpi` to
  run the FIXEDFLOW driver) and its companion `.github/workflows/fixed-flow-heartbeat.yml`
  (which posted a "queued for local pipeline" comment when the label was added).
  FIXEDFLOW step 3-5 no longer supports any watcher / background poll / cron /
  auto-dispatch path: maintainers must invoke the `/fixed-flow-driver` skill
  manually inside a Claude Code session. The original auto-dispatch chain
  shipped in PR #200 was always gated behind `FIXEDFLOW_DRIVER_ENABLED=0`
  and never ran in production, so removing it changes no observable runtime
  behaviour — but it removes a wired-but-unused mechanism that the docs
  treated as canonical. `docs/FIXEDFLOW.md` v4 explicitly bans watchers /
  background polling / auto-dispatch. The env vars `FIXEDFLOW_DRIVER_ENABLED`
  and `FIXEDFLOW_POLL_INTERVAL` are no longer read by any script. (#229, #231)

### Fixed

- **Issue #158**: `npm i -g github:libz-renlab-ai/TeamBrain#release` no longer
  fails on Windows + destroys the user's prior teamagent install. The 3
  tree-sitter native deps (`web-tree-sitter`, `tree-sitter-typescript`,
  `tree-sitter-python`) have been removed from `packages/teamagent/package.json`
  entirely — their install scripts spawn `cmd.exe` during npm reify and abort
  with `ENOENT`, which left users with no teamagent at all because npm reify
  removes the prior package before downstream install scripts run.
  `packages/core/src/matcher/legacy/ast-context.ts:initAstMatcher` already had
  a try/catch fallback returning false → "conservative mode" (matcher does NOT
  filter comment/string false-positives), so removing the deps degrades match
  precision but does not break functionality. `postinstall.log` gains a new
  positive `stage=ast-matcher status=skipped reason=tree-sitter-deps-absent`
  line — symmetric to #160 `vector-deps-absent` — so doctor and bug-report
  tooling can distinguish "skipped on purpose" from "ast-matcher never
  reached." Users wanting AST-precise filtering can opt back in:
  `npm install -g teamagent web-tree-sitter@^0.26 tree-sitter-typescript@^0.23 tree-sitter-python@^0.23`.
  Defense-in-depth install-time backup + rollback in `release/install.sh`
  guards against future analogous failures (any cause). The rollback path
  (both shell + `packages/cli/src/lib/install-backup.ts`) validates the
  backup tarball with `tar -tzf` BEFORE `rm -rf $INSTALL_DIR`; a corrupt
  or truncated backup would otherwise wipe the install dir and then fail
  to extract — recreating the very partial-install corruption #158 was
  filed for. The backup canary uses `dist/bin.js` existence (not just
  "directory non-empty") so spurious .nfs* / .smbXXXX cruft on hostile
  filesystems isn't archived as garbage. `treeSitterDepsInstalled`
  `knownRoots` includes Windows %LOCALAPPDATA%/pnpm and %APPDATA%/npm so
  Windows users who explicitly install the tree-sitter packages aren't
  permanently flagged as "AST 过滤: 未安装". (#158)
- **Issue #160**: `teamagent warmup` now exits 0 with a friendly skip message
  when the optional vector deps (`@xenova/transformers` + `onnxruntime-node`)
  are not installed, instead of exit 1 with a misleading "warmup failed"
  error. The state file (`~/.teamagent/.warmup-state.json`) records
  `status="skipped"` rather than `status="failed"`, and the postinstall log
  (`~/.teamagent/postinstall.log`) gains a positive
  `stage=warmup status=skipped reason=optional-not-installed` line so doctor
  and bug-report tooling can distinguish "skipped on purpose" from "warmup
  never reached." `teamagent doctor` reports `vector_model: skip` (not
  `fail`) for the same state.
- **Issue #161**: hooks fired from a sub-directory now correctly resolve to
  the project root's `.teamagent/knowledge.db` via walk-up. Previously
  `findTeamagentRoot` was missing entirely and every hook entry hard-coded
  `path.join(cwd, ".teamagent", "knowledge.db")`, so the project DB was
  invisible from any child cwd. (#181)

### Changed

- `teamagent init` now writes hooks to user-level `~/.claude/settings.json`
  by default, so Claude Code launched from any cwd triggers TeamAgent. Use
  `--no-user-level-hook` to opt out and keep the previous project-level-only
  behaviour. (#181)
- `teamagent init` from a sub-directory of an already-initialized project
  refuses by default to avoid creating duplicate `.teamagent/` state. The
  init step `nested-init-guard` reports the detected ancestor and the user
  is told to `cd` to the project root or pass `--force-nested-init` to
  override. (#181)
- Hook bundles are now staged to `~/.teamagent/hooks/` before being
  referenced from `~/.claude/settings.json`, so worktree cleanup, npm
  reinstalls, nvm version switches, and last-init-from-a-different-project
  no longer break user-level hooks across every project on the machine. The
  `~/.claude/settings.json` PreToolUse / PostToolUse / UserPromptSubmit /
  Stop commands point at `~/.teamagent/hooks/bin-*.cjs` instead of at a
  transient `node_modules/.../dist/` path. (#181)
