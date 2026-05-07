# Judge Playbook: auto-capture / verify-canned-answer

> Replaces archived script `docs/legacy/judge-scripts/docs/features/auto-capture/verify-canned-answer.sh` per rule
> "third-party judge harness forbidden fixed scripts; MUST use md playbook"
> (`docs/HOWTO-PLAN-PR.md` § 3b).

## Origin
- Replaced script: `docs/legacy/judge-scripts/docs/features/auto-capture/verify-canned-answer.sh`
- Original purpose: Gate script that runs `extraction-judge.sh` + `real-judge.sh` if both are present, or falls back to vitest if the judge harnesses are absent; exit 0 = VERIFIED.
- Status: **ACTIVE**

## §V1 RUN

Concrete commands extracted from source:

- Step 0: Resolve repo root (handles git worktrees).
  ```
  GIT_COMMON_DIR="$(git -C "$SCRIPT_DIR" rev-parse --git-common-dir 2>/dev/null || true)"
  REPO_ROOT="$(cd "$GIT_COMMON_DIR/.." && pwd)"
  ```

- Step 1: Check whether both judge harnesses are present (primary path).
  ```
  [[ -f "docs/features/auto-capture/extraction-judge.sh" \
     && -f "docs/features/auto-capture/real-judge.sh" ]]
  ```

- Step 2a (primary): Run both judges sequentially.
  ```
  bash docs/features/auto-capture/extraction-judge.sh
  bash docs/features/auto-capture/real-judge.sh
  ```
  Evidence written to `.judge/capture/<run_id>/` and `.judge/capture-real/<run_id>/` respectively.

- Step 2b (fallback): If either judge script is absent, run vitest instead.
  ```
  (cd "$REPO_ROOT" && pnpm vitest run packages/core/src/correction-detector \
    --reporter=basic 2>&1 | tail -20)
  ```

- Step 3: Emit final VERIFIED line.
  ```
  echo "VERIFIED: auto-capture extraction + real-session detection PASS"
  ```

Capture to `evidence_dir` as delegated to the sub-judges (`.judge/capture/` and `.judge/capture-real/`).

## §V2 DUMP

```json
{
  "exit_code": 0,
  "metrics": {
    "extraction_judge_passed": true,
    "real_judge_passed": true,
    "fallback_mode": false,
    "extraction_judge": {
      "prod_recall": ">= 0.85",
      "prod_precision": ">= 0.90",
      "thresholds_pass": true
    },
    "real_judge": {
      "recall_real": ">= 0.85",
      "precision_real": ">= 0.90",
      "pass": true
    }
  },
  "evidence_dir": ".judge/capture/<run_id>/ and .judge/capture-real/<run_id>/",
  "stdout_path": "delegated to sub-judges",
  "stderr_path": "delegated to sub-judges",
  "feature_status": "active"
}
```

When running in fallback (vitest) mode: `fallback_mode: true`; vitest exit code determines pass/fail; sub-judge metrics are not available.

## §V3 READ

`claudefast -p` prompt:
> Read judge.json + evidence_dir. PASS / FAIL / SKIP.
> PASS if:
>   (a) primary mode: extraction_judge_passed == true AND real_judge_passed == true
>       (which requires prod recall >= 0.85, prod precision >= 0.90 for extraction-judge,
>        and recall_real >= 0.85, precision_real >= 0.90 for real-judge), OR
>   (b) fallback mode: vitest suite passed (exit 0).
> FAIL if any sub-judge exits non-zero or vitest fails.
> SKIP if tsx toolchain unavailable and vitest also fails to run.

## Notes

- Original logic summary: This is an orchestrator / gate script. If both `extraction-judge.sh` and `real-judge.sh` exist in `docs/features/auto-capture/`, it runs them sequentially. If either is absent (e.g., after archival), it falls back to `pnpm vitest run packages/core/src/correction-detector --reporter=basic` to at least run the unit test suite for the correction detector. The script exits 0 only if all executed steps succeed. The VERIFIED output line is a human-readable confirmation. Evidence is scattered across the individual sub-judge evidence dirs; this playbook is primarily a dispatch harness.
- Dependencies: `docs/features/auto-capture/extraction-judge.sh` and `real-judge.sh` for primary path (now archived — dispatch these playbooks instead); or `pnpm vitest` for fallback; git worktree support for `--git-common-dir` resolution.
- Limitations: In the md-playbook world, dispatch this playbook by invoking the `extraction-judge` and `real-judge` playbooks as sub-tasks rather than running the archived shell script. The vitest fallback covers only unit-level regression, not full recall/precision measurement.
