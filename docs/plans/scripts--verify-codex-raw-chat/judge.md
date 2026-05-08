# Judge Playbook: Codex Raw Chat TEAMBRAIN Visibility (verify-codex-raw-chat)

> Replaces archived script `scripts/verify-codex-raw-chat.sh` per project rule
> "third-party judge harness forbidden fixed scripts; MUST use md playbook"
> (`docs/HOWTO-PLAN-PR.md` § 3b).

## Origin

- Replaced script: `docs/legacy/judge-scripts/scripts/verify-codex-raw-chat.sh`
- Original purpose: Verify that `codex exec` can read the project's AGENTS.md/CLAUDE.md and sees the TeamBrain managed block, using `gpt-5.4-mini` to answer `TEAMBRAIN_VISIBLE` vs `TEAMBRAIN_MISSING`.
- Status: DEPRECATED — the TeamBrain managed block (`TEAMAGENT:START` / `TEAMAGENT:END`) is no longer written to CLAUDE.md by default since M4 (compile flag `--legacy-claude-md` required to opt back in, commit `7e044b5`). The literal string `TEAMBRAIN_VISIBLE` cannot be reliably produced when there is no managed block to detect.

## §V1 RUN

Commands the MAIN agent dispatches (via subagent or `claudefast -p` probe).
Capture stdout/stderr to `evidence_dir = .judge/<run_id>/`.

- Step 1: Check whether a managed block currently exists: `grep -c 'TEAMAGENT:START' CLAUDE.md > .judge/<run_id>/managed-block-check.txt 2>&1; echo $? > .judge/<run_id>/managed-block.exit`
- Step 2: Run `codex exec -C . -m gpt-4o-mini --json -o .judge/<run_id>/last-message.txt "Read the project instructions. If you can see a TeamAgent or TeamBrain managed block, answer exactly TEAMBRAIN_VISIBLE. Otherwise answer TEAMBRAIN_MISSING." > .judge/<run_id>/codex-stream.jsonl 2>&1; echo $? > .judge/<run_id>/codex.exit`
- Step 3: `grep -c TEAMBRAIN_VISIBLE .judge/<run_id>/last-message.txt > .judge/<run_id>/visible-check.txt 2>&1; echo $? > .judge/<run_id>/visible.exit`

## §V2 DUMP

Canonical JSON written to `.judge/<run_id>/judge.json`:

```json
{
  "exit_code": 1,
  "metrics": {
    "managed_block_present": false,
    "codex_exec_exit_code": 0,
    "teambrain_visible_in_response": false,
    "model_used": "gpt-4o-mini"
  },
  "evidence_dir": ".judge/<run_id>",
  "stdout_path": ".judge/<run_id>/codex-stream.jsonl",
  "stderr_path": ".judge/<run_id>/last-message.txt",
  "feature_status": "deprecated"
}
```

## §V3 READ

LLM judge prompt (run via `claudefast -p`):

> Read `.judge/<run_id>/judge.json` and supporting evidence in
> `evidence_dir`. Emit verdict `PASS` / `FAIL` / `SKIP`. Criteria:
>
> This playbook is DEPRECATED (feature deleted at commit d341da8). The correct verdicts are:
>
> - **SKIP** (expected / good) if the canned-answer trigger phrase `TEAMAGENT:START` is **absent**
>   from `CLAUDE.md`. This confirms the deletion is intact; the deprecated feature has not
>   regressed. `managed_block_present` is irrelevant — do NOT use it as the SKIP gate.
>   Check: `grep -qc 'TEAMAGENT:START' CLAUDE.md` returns 0.
>
> - **FAIL** (regression detected) if `TEAMAGENT:START` has regressed back into `CLAUDE.md`
>   (e.g. someone ran `pnpm teamagent compile --legacy-claude-md` accidentally). When the
>   trigger phrase is present, the deprecated raw-chat behavior may become observable again.
>   Check: `grep -qc 'TEAMAGENT:START' CLAUDE.md` returns > 0.
>
> Do NOT use `managed_block_present` as a criterion — that field always reflects the actual
> block content and is normally `false` since M4 regardless of whether a regression occurred.
> The canned-answer trigger phrase (`TEAMAGENT:START`) is the correct regression signal.

## Notes

- Original logic summary: The script ran `codex exec` with a binary-answer prompt — if the Codex model could see the managed block in the project's context, it answered `TEAMBRAIN_VISIBLE`; otherwise `TEAMBRAIN_MISSING`. The check `grep -q "TEAMBRAIN_VISIBLE"` determined pass/fail. The model name `gpt-5.4-mini` in the original script may be a placeholder; substitute the current default Codex model.
- Known limitations / dependencies:
  - Requires `codex` CLI on PATH.
  - The managed block (`TEAMAGENT:START` ... `TEAMAGENT:END`) is no longer written to CLAUDE.md by default; `pnpm teamagent compile --legacy-claude-md` would restore it.
  - PASS is unreachable in current default state; SKIP is the correct verdict per current project configuration.
  - Model name `gpt-5.4-mini` used in original may not exist; use `gpt-4o-mini` or current Codex default.

## Phase 2 fix log
Resolved 2026-05-08: #9 (P3) rewrote §V3 SKIP/FAIL logic: removed `managed_block_present` gate; SKIP now triggers when `TEAMAGENT:START` is absent from CLAUDE.md (deletion confirmed, expected path); FAIL triggers when trigger phrase regresses back. Commit fee007b.
