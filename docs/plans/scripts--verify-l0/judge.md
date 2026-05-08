# Judge Playbook: L0 Mechanical Verification (verify-l0)

> Replaces archived script `scripts/verify-l0.sh` per project rule
> "third-party judge harness forbidden fixed scripts; MUST use md playbook"
> (`docs/HOWTO-PLAN-PR.md` § 3b).

## Origin

- Replaced script: `docs/legacy/judge-scripts/scripts/verify-l0.sh`
- Original purpose: Run five mechanical checks (tests, typecheck, hook bundle existence, end-to-end hook invocation, stats) without requiring a Claude Code session; designed to complete in ~10 seconds.
- Status: ACTIVE — all five checks address real infrastructure that still exists in the project.

## §V1 RUN

Commands the MAIN agent dispatches (via subagent or `claudefast -p` probe).
Capture stdout/stderr to `evidence_dir = .judge/<run_id>/`.

- Step 1: `pnpm test > .judge/<run_id>/tests.txt 2>&1; echo $? > .judge/<run_id>/tests.exit`
- Step 2: `pnpm typecheck > .judge/<run_id>/typecheck.txt 2>&1; echo $? > .judge/<run_id>/typecheck.exit`
- Step 3: `ls -la packages/cli/dist/bin-pre-tool-use.cjs > .judge/<run_id>/bundle.txt 2>&1; echo $? > .judge/<run_id>/bundle.exit`
- Step 4: Construct PreToolUse JSON payload for a `wget` Bash command and pipe it through `node packages/cli/dist/bin-pre-tool-use.cjs`; capture output to `.judge/<run_id>/hook-invocation.txt` and exit code to `.judge/<run_id>/hook-invocation.exit`.
- Step 5: `pnpm teamagent stats > .judge/<run_id>/stats.txt 2>&1; echo $? > .judge/<run_id>/stats.exit`

## §V2 DUMP

Canonical JSON written to `.judge/<run_id>/judge.json`:

```json
{
  "exit_code": 0,
  "metrics": {
    "tests_pass": true,
    "typecheck_pass": true,
    "hook_bundle_present": true,
    "hook_invocation_pass": true,
    "hook_response_contains_expected_keyword": true,
    "stats_exit_code": 0
  },
  "evidence_dir": ".judge/<run_id>",
  "stdout_path": ".judge/<run_id>/hook-invocation.txt",
  "stderr_path": ".judge/<run_id>/typecheck.txt",
  "feature_status": "active"
}
```

## §V3 READ

LLM judge prompt (run via `claudefast -p`):

> Read `.judge/<run_id>/judge.json` and supporting evidence in
> `evidence_dir`. Emit verdict `PASS` / `FAIL` / `SKIP`. Criteria:
>
> - PASS if: `tests_pass == true` AND `typecheck_pass == true` AND `hook_bundle_present == true` AND `hook_invocation_pass == true` AND `hook_response_contains_expected_keyword == true` (expected keyword is "先检查下载目录" per original script).
> - FAIL if: any of the above metrics is false, or any exit code file contains non-zero.
> - SKIP if: feature has been deleted from the project (e.g.
>   canned answer no longer in CLAUDE.md), or required infrastructure
>   is unavailable in this environment.

## Notes

- Original logic summary: The script ran five sequential checks: (1) `pnpm test` tail; (2) `pnpm typecheck` tail; (3) existence check for `packages/cli/dist/bin-pre-tool-use.cjs`; (4) constructed a PreToolUse JSON payload via `node -e` for a `wget` command and piped through the hook binary, asserting the response contained the Chinese phrase "先检查下载目录"; (5) `teamagent stats`. Exit 0 if all pass.
- Known limitations / dependencies:
  - Step 4 requires the hook bundle to have been built via `pnpm --filter @teamagent/cli build:hook`.
  - The hook keyword assertion ("先检查下载目录") is language-specific; if the rule text changes, the assertion must be updated in the playbook.
  - `teamagent stats` must be on PATH or available via `pnpm teamagent`.
