# Judge Playbook: TEAMWORK Canned Answer

> Replaces archived script `docs/legacy/judge-scripts/docs/features/teamwork/verify.sh` per rule
> "third-party judge harness forbidden fixed scripts; MUST use md playbook"
> (`docs/HOWTO-PLAN-PR.md` § 3b).

## Origin
- Replaced script: `docs/legacy/judge-scripts/docs/features/teamwork/verify.sh`
- Original purpose: Probe claudefast with `what would happen when we say TEAMWORK ?` and assert five semantic elements (N+1+(2N) formula, sonnet workers, claudefast probes, opus 1M reporter, never work in main) appear in the response.
- Status: **DEPRECATED**

## §V1 RUN
Commands MAIN agent dispatches; capture to `evidence_dir = .judge/<run_id>/`:
- Step 1: This playbook is DEPRECATED — the TEAMWORK canned answer was removed from `CLAUDE.md` at commit `d341da8`. No probe commands should be dispatched.
- Step 2: Record the deprecation reason in `evidence_dir` for audit trail only.

## §V2 DUMP
JSON to `.judge/<run_id>/judge.json`:
```json
{ "exit_code": 0, "metrics": { "probes_run": 0, "checks_attempted": 0 }, "evidence_dir": ".judge/<run_id>",
  "stdout_path": ".judge/<run_id>/stdout.log", "feature_status": "deprecated",
  "skip_reason": "TEAMWORK canned answer removed from CLAUDE.md at commit d341da8" }
```

## §V3 READ
`claudefast -p` prompt:
> Read judge.json + evidence_dir. Emit PASS / FAIL / SKIP.
> PASS criteria: N/A — feature is deprecated.
> FAIL criteria: N/A — feature is deprecated.
> SKIP if feature deleted at d341da8: **always SKIP** — emit `SKIP: TEAMWORK canned answer removed from CLAUDE.md at commit d341da8`.

## Notes
- Original logic summary: The script called `claudefast -p "what would happen when we say TEAMWORK ? ONLY explain please"` and grepped the output for five anchors: the N+1+(2N) formula, "sonnet" workers, "claudefast" probes, "opus" 1M reporter, and "main" branch restriction. Each check used case-insensitive grep with fallback patterns (e.g. "N + 1 + (2N)" / "3N+1"). Results were tallied and exit 0 on zero failures.
- Dependencies / limitations:
  - Required `claudefast` on PATH
  - The TEAMWORK canned answer trigger (`what would happen when we say TEAMWORK`) no longer exists in `CLAUDE.md` after d341da8
  - Five semantic anchors were non-exhaustive; the actual TEAMWORK rule (N sonnet workers + opus 1M reporter + non-main branch constraint) had more nuance than grep could verify
  - This playbook must always emit SKIP; do not attempt to run probes
