# Judge Playbook: Duck Mode (TEAMAGENT_EXPLAIN_LIKE_CEO_DUCK) Verification (duck-mode-verify)

> Replaces archived script `scripts/duck-mode-verify.sh` per project rule
> "third-party judge harness forbidden fixed scripts; MUST use md playbook"
> (`docs/HOWTO-PLAN-PR.md` § 3b).

## Origin

- Replaced script: `docs/legacy/judge-scripts/scripts/duck-mode-verify.sh`
- Original purpose: Run `teamagent stats` with and without `TEAMAGENT_EXPLAIN_LIKE_CEO_DUCK=1`, capture jargon term counts and duck-mode output lines, and optionally probe canned answer anchors (FASTPROBE, POSTPR, TEAMWORK) via `claudefast`.
- Status: ACTIVE — the duck mode feature (`packages/core/src/duck-mode/`) still exists in the codebase; however, the V5 anchor probe (FASTPROBE/POSTPR/TEAMWORK) graded canned answers that were removed at commit d341da8, so the V5 sub-check should be SKIP.

## §V1 RUN

Commands the MAIN agent dispatches (via subagent or `claudefast -p` probe).
Capture stdout/stderr to `evidence_dir = .judge/<run_id>/`.

- Step 1: `TEAMAGENT_EXPLAIN_LIKE_CEO_DUCK=0 pnpm --silent teamagent stats > .judge/<run_id>/engineer.txt 2> .judge/<run_id>/engineer.err`
- Step 2: `TEAMAGENT_EXPLAIN_LIKE_CEO_DUCK=1 pnpm --silent teamagent stats > .judge/<run_id>/duck.txt 2> .judge/<run_id>/duck.err`
- Step 3 (postinstall — if file exists): `TEAMAGENT_DRY_RUN=1 TEAMAGENT_EXPLAIN_LIKE_CEO_DUCK=1 node packages/teamagent/postinstall.mjs > .judge/<run_id>/postinstall-duck.txt 2>&1`; then same with `TEAMAGENT_EXPLAIN_LIKE_CEO_DUCK=0` to `.judge/<run_id>/postinstall-eng.txt`.
- Step 4 (jargon count): Count unique jargon terms matching `skills?|hooks?|PreToolUse|Stop hook|RAG|embedding|quantization|canonical|token (budget|预算)|matcher|vector|reload|MCP|tier|confidence|demerit` across duck output files; write count to `.judge/<run_id>/jargon-count.txt`.
- Step 5 (duck lines count): Count lines containing `呷呷|鸭鸭|>ω<` in duck output files; write to `.judge/<run_id>/duck-lines.txt`.
- Step 6 (baseline diff): If `docs/baselines/stats-engineer-baseline.txt` exists, compare line count to current engineer view; write ratio to `.judge/<run_id>/baseline-diff.txt`.

## §V2 DUMP

Canonical JSON written to `.judge/<run_id>/judge.json`:

```json
{
  "exit_code": 0,
  "metrics": {
    "jargon_terms_found": 3,
    "duck_lines_emitted": 5,
    "engineer_view_lines": 20,
    "duck_view_lines": 18,
    "baseline_engineer_lines": 19,
    "engineer_view_diff": 0.05,
    "v5_probe": "not_attempted",
    "v5_has_fastprobe": false,
    "v5_has_postpr": false,
    "v5_has_teamwork": false
  },
  "evidence_dir": ".judge/<run_id>",
  "stdout_path": ".judge/<run_id>/duck.txt",
  "stderr_path": ".judge/<run_id>/duck.err",
  "feature_status": "active"
}
```

## §V3 READ

LLM judge prompt (run via `claudefast -p`):

> Read `.judge/<run_id>/judge.json` and supporting evidence in
> `evidence_dir`. Emit verdict `PASS` / `FAIL` / `SKIP`. Criteria:
>
> - PASS if: `jargon_terms_found >= 1` (duck mode output contains reduced jargon compared to engineer view) AND `duck_lines_emitted >= 1` (at least one duck-style line with 呷呷/鸭鸭/>ω<) AND `engineer_view_diff <= 0.05` (engineer view has not regressed more than 5% vs baseline).
> - FAIL if: `duck_lines_emitted == 0` (duck mode produced no duck-style output) OR engineer view regressed more than 5%.
> - SKIP if: feature has been deleted from the project (e.g.
>   canned answer no longer in CLAUDE.md), or required infrastructure
>   is unavailable in this environment.
>
> NOTE: V5 anchor sub-check (FASTPROBE/POSTPR/TEAMWORK in canned answer) should be treated as SKIP regardless of `v5_probe` value, because the canned answers that define those anchors were removed from CLAUDE.md at commit d341da8.

## Notes

- Original logic summary: The script captured `teamagent stats` output under both env flag values, mechanically counted jargon terms and duck-style lines, compared engineer view against a baseline file, and optionally probed the `what project tools we have?` canned answer for FASTPROBE/POSTPR/TEAMWORK anchors via `claudefast`. Output was written to `.judge/duck-mode-<run_id>/judge.json` in a single heredoc with computed metrics.
- Known limitations / dependencies:
  - Duck mode feature (`TEAMAGENT_EXPLAIN_LIKE_CEO_DUCK`) still exists in `packages/core/src/duck-mode/`.
  - V5 anchor check (FASTPROBE/POSTPR/TEAMWORK) graded a canned answer removed at d341da8; that sub-check is SKIP.
  - Jargon term regex is hardcoded; update if the set of forbidden technical terms changes.
  - Baseline file `docs/baselines/stats-engineer-baseline.txt` may be absent; diff is then 0.
