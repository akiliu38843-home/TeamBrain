# Judge Playbook: Canned Answers (DOGFOOD / DUCKPLAN / POSTPR) — Run Judge

> Replaces archived script `docs/legacy/judge-scripts/docs/features/canned-answers/run-judge.sh` per rule
> "third-party judge harness forbidden fixed scripts; MUST use md playbook"
> (`docs/HOWTO-PLAN-PR.md` § 3b).

## Origin
- Replaced script: `docs/legacy/judge-scripts/docs/features/canned-answers/run-judge.sh`
- Original purpose: Fire three `claudefast -p` probes for DOGFOOD, DUCKPLAN, and POSTPR canned answers; mechanically grep each output for named anchors; aggregate into `.judge/canned-answers/<run_id>/judge.json`.
- Status: **DEPRECATED**

## §V1 RUN
Commands MAIN agent dispatches; capture to `evidence_dir = .judge/<run_id>/`:
- Step 1: This playbook is DEPRECATED — the DOGFOOD, DUCKPLAN, and POSTPR canned answers checked by this harness were removed from `CLAUDE.md` at commit `d341da8`. No probe commands should be dispatched.
- Step 2: Record the deprecation reason in `evidence_dir` for audit trail only.

## §V2 DUMP
JSON to `.judge/<run_id>/judge.json`:
```json
{ "exit_code": 0, "metrics": { "probes_run": 0, "dogfood_checks": 0, "duckplan_checks": 0, "postpr_checks": 0 },
  "evidence_dir": ".judge/<run_id>", "stdout_path": ".judge/<run_id>/stdout.log",
  "feature_status": "deprecated",
  "skip_reason": "DOGFOOD / DUCKPLAN / POSTPR canned answers removed from CLAUDE.md at commit d341da8" }
```

## §V3 READ
`claudefast -p` prompt:
> Read judge.json + evidence_dir. Emit PASS / FAIL / SKIP.
> PASS criteria: N/A — feature is deprecated.
> FAIL criteria: N/A — feature is deprecated.
> SKIP if feature deleted at d341da8: **always SKIP** — emit `SKIP: DOGFOOD / DUCKPLAN / POSTPR canned answers removed from CLAUDE.md at commit d341da8`.

## Notes
- Original logic summary: The harness ran three sequential `claudefast -p` probes (DOGFOOD: "what would happen when we say DOGFOOD?"; DUCKPLAN: "what would happen if we say 'DUCKPLAN'"; POSTPR: "what we shall do after each PR?"). Each probe output was saved to a separate file in the evidence dir. Mechanical grep checks were applied: DOGFOOD required `two tmux windows`, `left/?right split`, and `interact`; DUCKPLAN required `task description|任务描述`, `expected outputs|预期产出`, `judge harness|JSON|LLM`, and `duck|鸭|呷呷`; POSTPR required `fetch the codex review|fetch.*codex`, `chatgpt-codex-connector`, `pulls/.*comments`, and `silent|loop`. All 11 anchors had to pass for OVERALL_PASS. A 180-second timeout per probe was applied when `timeout` or `gtimeout` was available.
- Dependencies / limitations:
  - Required `claudefast` on PATH and `timeout`/`gtimeout` for bounded execution
  - The three canned answer triggers no longer exist in `CLAUDE.md` after d341da8
  - Greps were regex (`-Eq`) with alternation; no LLM re-judge stage existed
  - Re-evaluation block was duplicated (first grepped into shell vars, then re-evaluated inline) — a known verbosity issue in the original script
  - This playbook must always emit SKIP; do not attempt to run probes
