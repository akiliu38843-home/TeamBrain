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
> - PASS if: `managed_block_present == true` AND `teambrain_visible_in_response == true`. This combination is only achievable if the managed block was explicitly regenerated with `--legacy-claude-md`.
> - FAIL if: `managed_block_present == true` but `teambrain_visible_in_response == false`.
> - SKIP if: `managed_block_present == false` (default state since commit d341da8 removed the managed block as the default output of `pnpm teamagent compile`). The managed block no longer appears in CLAUDE.md by default; SKIP is the expected verdict. Feature deleted at commit d341da8.

## Notes

- Original logic summary: The script ran `codex exec` with a binary-answer prompt — if the Codex model could see the managed block in the project's context, it answered `TEAMBRAIN_VISIBLE`; otherwise `TEAMBRAIN_MISSING`. The check `grep -q "TEAMBRAIN_VISIBLE"` determined pass/fail. The model name `gpt-5.4-mini` in the original script may be a placeholder; substitute the current default Codex model.
- Known limitations / dependencies:
  - Requires `codex` CLI on PATH.
  - The managed block (`TEAMAGENT:START` ... `TEAMAGENT:END`) is no longer written to CLAUDE.md by default; `pnpm teamagent compile --legacy-claude-md` would restore it.
  - PASS is unreachable in current default state; SKIP is the correct verdict per current project configuration.
  - Model name `gpt-5.4-mini` used in original may not exist; use `gpt-4o-mini` or current Codex default.
