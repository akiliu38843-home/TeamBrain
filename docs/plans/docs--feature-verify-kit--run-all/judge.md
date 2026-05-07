# Judge Playbook: Feature Verify Kit — run-all Orchestrator

> Replaces archived script `docs/legacy/judge-scripts/docs/feature-verify-kit/run-all.sh` per rule
> "third-party judge harness forbidden fixed scripts; MUST use md playbook"
> (`docs/HOWTO-PLAN-PR.md` § 3b).

## Origin
- Replaced script: `docs/legacy/judge-scripts/docs/feature-verify-kit/run-all.sh`
- Original purpose: Sequential orchestrator that runs all five feature-verify-kit sub-scripts in order: `verify-claude-stream-json.sh`, `hardmatch-features.sh`, `verify-dashboard-health.sh`, `verify-tmux-interactive.sh`, and `test-hardmatch-regression.sh`.
- Status: **ACTIVE**

## §V1 RUN
Commands MAIN agent dispatches; capture stdout/stderr to `evidence_dir = .judge/<run_id>/`:

- Step 1: Assign a shared `run_id` for this orchestrated run so all sub-playbooks write into the same evidence directory.
  ```
  RUN_ID="feature-verify-kit-$(date +%Y%m%d-%H%M%S)"
  mkdir -p .judge/$RUN_ID
  echo "$RUN_ID" > .judge/<run_id>/run-id.txt
  ```
- Step 2: Dispatch `verify-claude-stream-json` playbook (produces `claude-features.json`).
  ```
  # MAIN agent invokes §V1 of docs/plans/docs--feature-verify-kit--verify-claude-stream-json/judge.md
  # with run_id=$RUN_ID
  # Record exit code to .judge/<run_id>/step1-exit.txt
  ```
- Step 3: Dispatch `hardmatch-features` playbook (requires step 2 output).
  ```
  # MAIN agent invokes §V1 of docs/plans/docs--feature-verify-kit--hardmatch-features/judge.md
  # with run_id=$RUN_ID
  # Record exit code to .judge/<run_id>/step2-exit.txt
  ```
- Step 4: Dispatch `verify-dashboard-health` playbook (independent of steps 2–3).
  ```
  # MAIN agent invokes §V1 of docs/plans/docs--feature-verify-kit--verify-dashboard-health/judge.md
  # with run_id=$RUN_ID
  # Record exit code to .judge/<run_id>/step3-exit.txt
  ```
- Step 5: Dispatch `verify-tmux-interactive` playbook (independent of steps 2–3).
  ```
  # MAIN agent invokes §V1 of docs/plans/docs--feature-verify-kit--verify-tmux-interactive/judge.md
  # with run_id=$RUN_ID
  # Record exit code to .judge/<run_id>/step4-exit.txt
  ```
- Step 6: Dispatch `hardmatch-regression` check (if `test-hardmatch-regression.sh` logic has a corresponding playbook; otherwise run as `claudefast -p` probe checking that the fixture still matches the schema).
  ```
  # MAIN agent invokes the hardmatch-regression playbook or inline probe
  # Record exit code to .judge/<run_id>/step5-exit.txt
  ```
- Step 7: Aggregate all step exit codes into the orchestration summary.
  ```
  cat .judge/<run_id>/step{1,2,3,4,5}-exit.txt > .judge/<run_id>/all-exits.txt
  ```

## §V2 DUMP
Canonical JSON to `.judge/<run_id>/judge.json`:
```json
{
  "exit_code": 0,
  "metrics": {
    "step1_verify_claude_stream_json_exit": 0,
    "step2_hardmatch_features_exit": 0,
    "step3_verify_dashboard_health_exit": 0,
    "step4_verify_tmux_interactive_exit": 0,
    "step5_hardmatch_regression_exit": 0,
    "all_steps_pass": true,
    "run_id": "<run_id>"
  },
  "evidence_dir": ".judge/<run_id>/",
  "stdout_path": ".judge/<run_id>/all-exits.txt",
  "stderr_path": ".judge/<run_id>/all-exits.txt",
  "feature_status": "active"
}
```

## §V3 READ
`claudefast -p` prompt:
> Read `.judge/<run_id>/judge.json` and evidence in `evidence_dir`.
> Emit `PASS` / `FAIL` / `SKIP`.
> PASS criteria: `exit_code` is 0; `metrics.all_steps_pass` is `true`; all five step exit codes are 0.
> FAIL criteria: Any step exit code is non-zero; `metrics.all_steps_pass` is `false`; evidence directory missing or incomplete. Report which specific step(s) failed.
> SKIP if any sub-playbook prerequisite infrastructure is missing (e.g., `tmux` absent, `claudefast` not on PATH, `pnpm teamagent` not built).

## Notes
- Original logic summary: The original `run-all.sh` was a trivial sequential shell script: it called each sub-verifier in order using `bash "$(dirname "$0")/...sh"` and relied on `set -euo pipefail` to abort on the first failure. Order mattered because `hardmatch-features.sh` depends on the output of `verify-claude-stream-json.sh`. The five sub-scripts were: stream-json extraction, hardmatch fixture comparison, dashboard health check, tmux interactive export, and hardmatch regression test. This playbook replaces that linear orchestration with a MAIN-agent-dispatched sequence where each step corresponds to an independent sub-playbook, enabling the MAIN agent to report partial failures with granularity rather than a single pipeline abort.
- Known dependencies / limitations:
  - Execution order is constrained: step 2 (hardmatch) must follow step 1 (stream-json extraction); steps 3, 4, and 5 are independent and may be dispatched in parallel if MAIN agent supports it.
  - `test-hardmatch-regression.sh` does not have an explicit archived script in the nine assigned files; MAIN agent should check `docs/legacy/judge-scripts/docs/feature-verify-kit/test-hardmatch-regression.sh` for a corresponding entry or treat step 5 as a re-run of the hardmatch with a fresh `claudefast -p` extraction to confirm the fixture is stable across two consecutive runs.
  - Running all steps in one `run_id` directory means any file naming collision between sub-playbooks must be resolved by prefixing outputs with the step number.
  - Total wall-clock time is dominated by the tmux interactive step (up to ~4 min); MAIN agent should set a 10-minute timeout for the full orchestration.
