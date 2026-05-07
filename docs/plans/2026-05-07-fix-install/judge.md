```
   ┌──────────── judge harness — fix-install · ≤30s ────────────┐
   │  invoked by:  MAIN agent (do NOT auto-run from a hook)     │
   │  dispatches:  subagents + claudefast -p stream-json probes │
   │  scripts/*.sh below are evidence collectors, not the judge │
   └────────────────────────────────────────────────────────────┘
```

# judge harness — fix-install · postinstall + npm install ≤30s

> Per project rule "Judge harness = MD playbook, not fixed bash" the canonical
> entry is this `judge.md`; bash scripts under `scripts/` are reproducible
> **evidence collectors** that the playbook references, not the judge itself.
> The PASS/FAIL decision MUST be made by an LLM judge reading raw JSON +
> evidence, dispatched from the MAIN agent.

## Scope

Verify that:

1. The default `npm install -g <teamagent-tarball>` wall-clock is **≤ 30 seconds** on a fresh `--cache` (first-time-user simulation).
2. `postinstall.mjs` Stage 2 does NOT block on a 120 MB model download anymore.
3. When `@xenova/transformers` + `onnxruntime-node` are absent (default), no warmup state file is written and the banner shows the `vector-deps-absent` opt-in hint.
4. When `TEAMAGENT_INCLUDE_OPTIONAL=1` is set in `release/install.sh`, the explicit multi-package install pulls vector deps and Stage 2 spawns a detached warmup child writing `~/.teamagent/.warmup-state.json` with `status="downloading"` and a non-zero pid.

## Evidence collectors (referenced, not invoked as judge)

| script | role |
|---|---|
| `scripts/verify-postinstall-detached.sh` | Hermetic test of postinstall.mjs alone (stub `dist/bin.js`); no network. Probes detached / foreground / skip / vector-deps-absent paths. |
| `scripts/verify-real-install-30s.sh` | End-to-end `npm install -g <tarball>` against `--prefix=$tmp --cache=$tmp` (fresh-user simulation). Wall-clock + `~/.teamagent/.warmup-state.json` + `<prefix>/lib/node_modules/@xenova` presence. |

Both write into `.judge/<run_id>/{*.json,evidence/}`. They never decide PASS/FAIL.

## Playbook for the MAIN agent

### Step 1 — collect raw evidence

Run both collectors, fresh `RUN_ID`:

```bash
bash scripts/verify-postinstall-detached.sh
RUN_ID=real-$(date +%s) bash scripts/verify-real-install-30s.sh
```

The first finishes in ~2 seconds; the second in ~10–60 seconds depending on whether the optional path is enabled. Both are idempotent.

### Step 2 — dispatch LLM judges

Issue independent `claudefast -p` probes; do not let any of them see this playbook (they each get the raw JSON + evidence file paths only). Run them in parallel where possible (max 8, per FASTPROBE rules).

#### Probe A — Default-path wall-clock

```bash
claudefast -p \
  --output-format stream-json \
  --include-partial-messages \
  --verbose \
  --permission-mode acceptEdits \
  "You are an install-fix judge. Read .judge/$RUN_ID/01-skip.json and .judge/$RUN_ID/02-detached.json plus their evidence files.
   PASS criteria: wallclock_s for both is a number AND ≤30. FAIL otherwise.
   Output JSON: {pass: bool, wallclock_s_skip: number, wallclock_s_detached: number, reasons: string[]}."
```

#### Probe B — Vector-deps-absent banner & state

```bash
claudefast -p \
  --output-format stream-json \
  --include-partial-messages \
  --verbose \
  "You are an install-fix judge. Read .judge/$RUN_ID/02-detached.out (postinstall stdout) and confirm:
   1. The line '语义匹配: 未安装' or 'vector deps 未安装' appears.
   2. No '.warmup-state.json' was written under \$HOME/.teamagent for this run (warmup_state_status field == '<absent>').
   3. The banner suggests TEAMAGENT_INCLUDE_OPTIONAL=1 as the opt-in path.
   Output JSON: {pass: bool, banner_anchor_found: bool, state_absent: bool, optin_hint_present: bool, reasons: string[]}."
```

#### Probe C — Opt-in vector path (only when run with `TEAMAGENT_INCLUDE_OPTIONAL=1`)

```bash
SKIP_FOREGROUND=0 RUN_ID=real-optin-$(date +%s) bash scripts/verify-real-install-30s.sh
claudefast -p \
  --output-format stream-json \
  --include-partial-messages \
  --verbose \
  "You are an install-fix judge. With the optional vector deps installed alongside teamagent, confirm:
   1. <prefix>/lib/node_modules/@xenova/transformers/package.json exists.
   2. ~/.teamagent/.warmup-state.json exists with status='downloading'.
   3. wallclock_s for 02-detached path is reasonable (>30s expected — vector deps add ~30s download; this is the documented opt-in cost).
   Output JSON: {pass: bool, xenova_installed: bool, state_downloading: bool, wallclock_s: number, reasons: string[]}."
```

### Step 3 — synthesize

The MAIN agent reads probe outputs (each is JSON), aggregates:

- Default install: PASS only if both Probe A wall-clocks ≤30s AND Probe B all three sub-conditions true.
- Opt-in install: PASS only if Probe C reports xenova present + state downloading + wallclock noted (no upper bound).
- Final: AND of all probes.

Write the synthesis to `docs/plans/2026-05-07-fix-install/report.md` under `## Judge result <run_id>`. Never let one probe approve another's domain — independence is the point.

## Dispatch via subagents (alternative)

For more thorough review, spawn three parallel `Agent` calls with `subagent_type: "general-purpose"`, each handed one Probe scope (no playbook). Each subagent reads the JSON + evidence and returns its verdict. The MAIN agent merges. Same independence guarantee.

## Stop conditions

- Probe A wall-clock > 30s for default path → re-investigate (likely a regressed dependency added back to teamagent's `package.json`).
- `~/.teamagent/.warmup-state.json` present in default path → `vectorOptionalsInstalled()` regressed (false positive); check `path.join(pkgDir, "..", "@xenova", ...)` resolution or a leftover hoisted xenova in `--prefix`.
- Probe C wallclock NaN or install exit_code != 0 → opt-in path broken; `release/install.sh` likely lost the `@xenova/transformers@^2.17.0 onnxruntime-node@1.14.0` arg list.
