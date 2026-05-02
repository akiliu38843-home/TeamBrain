# TeamBrain Evidence Archive

This directory stores evidence for owner-assigned real tasks. It is not a place to invent completion records.

## Day 1 H12-24 rule

Until an owner assigns Real Task #1, Day 1 H12-24 remains:

```yaml
status: "WAITING_FOR_OWNER_TASK"
completion_allowed: false
```

Do not mark Day 1 or Real Task #1 as `COMPLETED` from a placeholder alone.

## Registered runs

| run_id | Task | Verdict | Archive |
|--------|------|---------|---------|
| `20260502T000000Z-real-task-1` | Align run_id stability + task_title field across docs/teambrain/ | PASS (separate LLM judge) | `docs/teambrain/evidence/20260502T000000Z-real-task-1/` |

## Per-run layout

Create one directory per task run:

```text
docs/teambrain/evidence/<run_id>/
  INDEX.md
  transcript.md
  stdout.txt
  stderr.txt
  failures.md
  judge-summary.json
```

The matching raw harness file `.judge/<run_id>/judge.json` is also required. Missing or empty raw judge JSON, or any missing/empty file in the committed layout above, is `missing_evidence` and must fail the VERIFY harness/reviewer check.

Use a stable `run_id`, preferably `YYYYMMDDTHHMMSSZ-<task-slug>`. Never append or replace it with a commit SHA; after commit, mention the short SHA only in `INDEX.md`.

## Required files

| File | Required content |
|---|---|
| `INDEX.md` | Task title, run_id, reviewer, raw `.judge/<run_id>/` pointer, commit SHA if known. |
| `transcript.md` | Task assignment, key agent actions, reviewer hand-off. |
| `stdout.txt` | Command stdout excerpt or checksum plus pointer to raw stdout. |
| `stderr.txt` | Command stderr excerpt or checksum plus pointer to raw stderr. |
| `failures.md` | Every observed failure and disposition; if none, say so with evidence path. |
| `judge-summary.json` | Structured summary derived only from raw `.judge/<run_id>/judge.json`. |

## Minimal `judge-summary.json`

```json
{
  "run_id": "<run_id>",
  "task_title": "<owner task title>",
  "exit_code": 0,
  "metrics": {},
  "raw_evidence_dir": ".judge/<run_id>",
  "archive_dir": "docs/teambrain/evidence/<run_id>",
  "raw_judge_path": ".judge/<run_id>/judge.json",
  "failure_list_path": "docs/teambrain/evidence/<run_id>/failures.md"
}
```

Reviewer verdicts must read the raw judge JSON and linked archive evidence. They must not rely on the executing agent's verbal summary.
