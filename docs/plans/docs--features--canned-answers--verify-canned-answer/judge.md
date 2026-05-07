# Judge Playbook: Canned Answers — Verify Canned Answer (Static Keyword Gate)

> Replaces archived script `docs/legacy/judge-scripts/docs/features/canned-answers/verify-canned-answer.sh` per rule
> "third-party judge harness forbidden fixed scripts; MUST use md playbook"
> (`docs/HOWTO-PLAN-PR.md` § 3b).

## Origin
- Replaced script: `docs/legacy/judge-scripts/docs/features/canned-answers/verify-canned-answer.sh`
- Original purpose: Either delegate to `scripts/verify-all-rules.sh` or fall back to grepping `CLAUDE.md` for the literal keywords DOGFOOD, POSTPR, BUGREPORT, FASTPROBE, PRESHIP, and DUCKPLAN.
- Status: **DEPRECATED**

## §V1 RUN
Commands MAIN agent dispatches; capture to `evidence_dir = .judge/<run_id>/`:
- Step 1: This playbook is DEPRECATED — the canned-answer keyword checks (DOGFOOD, POSTPR, BUGREPORT, FASTPROBE, PRESHIP, DUCKPLAN) in `CLAUDE.md` were superseded at commit `d341da8`. No commands should be dispatched.
- Step 2: Record the deprecation reason in `evidence_dir` for audit trail only.

## §V2 DUMP
JSON to `.judge/<run_id>/judge.json`:
```json
{ "exit_code": 0, "metrics": { "keywords_checked": 0, "verify_all_rules_invoked": false },
  "evidence_dir": ".judge/<run_id>", "stdout_path": ".judge/<run_id>/stdout.log",
  "feature_status": "deprecated",
  "skip_reason": "Canned-answer keyword gate removed from CLAUDE.md at commit d341da8; use docs/rule-verify/INDEX.md for active rule verification" }
```

## §V3 READ
`claudefast -p` prompt:
> Read judge.json + evidence_dir. Emit PASS / FAIL / SKIP.
> PASS criteria: N/A — feature is deprecated.
> FAIL criteria: N/A — feature is deprecated.
> SKIP if feature deleted at d341da8: **always SKIP** — emit `SKIP: canned answer removed from CLAUDE.md at commit d341da8`.

## Notes
- Original logic summary: The script first attempted to call `scripts/verify-all-rules.sh` (tailing the last 30 lines of output). If that script did not exist or was not executable, it fell back to a simpler grep loop over `CLAUDE.md` checking for the literal presence of the six keyword strings: DOGFOOD, POSTPR, BUGREPORT, FASTPROBE, PRESHIP, DUCKPLAN. A missing keyword caused immediate exit 1. On full success it printed `VERIFIED: stable canned-answer rules PASS`.
- Dependencies / limitations:
  - Relied on `scripts/verify-all-rules.sh` as primary path; grep of `CLAUDE.md` was only a fallback
  - This was a structural presence check (keyword in file), not a semantic probe — it could not detect a keyword-present-but-wrong-content failure
  - The six keywords are no longer maintained as canned-answer triggers in `CLAUDE.md` after d341da8
  - Active rule verification is now handled via `docs/rule-verify/INDEX.md` and `bash scripts/verify-all-rules.sh`
  - This playbook must always emit SKIP; do not run grep checks against `CLAUDE.md`
