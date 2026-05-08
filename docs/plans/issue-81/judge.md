```text
   judge.md — issue #81 evaluation harness playbook
   (MD playbook, NOT a fixed bash script)

   main agent
       │
       ├─► sub-agent 1: structural lint
       │     Read research报告 + subject subdirs, emit JSON
       │
       ├─► sub-agent 2: redact integrity
       │     Run hardmatch redact regex on all *.redacted.jsonl
       │
       ├─► sub-agent 3: evidence reality sample
       │     Random-sample 3 PreToolUse intercepts → grep rule provenance
       │
       ├─► sub-agent 4: interview semantic hold
       │     LLM judge reads 3 interview.md, emits per-subject JSON
       │
       ├─► sub-agent 5: cluster reproducibility
       │     Independent re-cluster, diff vs report
       │
       └─► main agent aggregate
             verdict.json with pass/fail per step + evidence dirs
```

# Judge harness — issue #81

This file is the **MD playbook** the main agent (or maintainer) dispatches when verifying that a follow-up impl PR for #81 has actually executed the plan in `./plan.md`. It is **not** a fixed shell script — concrete commands belong inside each step's "How a sub-agent does it" block, but the orchestration is decided by the main agent at run time (which sub-agent, in what order, with what scope).

## Inputs

- `docs/research/<DATE>-personal-use-3people.md` (research report)
- `docs/research/<DATE>-personal-use-3people/subject-{1,2,3}/` (per-subject evidence subdirs)
- `docs/research/<DATE>-personal-use-3people/recruitment.md`
- `docs/research/<DATE>-personal-use-3people/interview-template.md`
- The current `packages/teamagent/seed/redact.ts` (or equivalent hardmatch redact regex table)

## Outputs

- `docs/plans/issue-81/judge-output/<run-id>/verdict.json`
- `docs/plans/issue-81/judge-output/<run-id>/step-<N>/raw.json`
- `docs/plans/issue-81/judge-output/<run-id>/step-<N>/stdout.log`
- `docs/plans/issue-81/judge-output/<run-id>/step-<N>/evidence/` (sub-agent dumps)

The `verdict.json` schema:

```json
{
  "run_id": "<iso-date-or-uuid>",
  "report_path": "docs/research/<DATE>-personal-use-3people.md",
  "report_sha": "<git-blob-sha>",
  "steps": [
    {"id": 1, "name": "structural-lint", "exit_code": 0, "evidence_dir": "step-1/", "metrics": {...}},
    {"id": 2, "name": "redact-integrity", "exit_code": 0, "evidence_dir": "step-2/", "metrics": {"leak_count": 0}},
    {"id": 3, "name": "evidence-reality-sample", "exit_code": 0, "evidence_dir": "step-3/", "metrics": {"sample_size": 3, "matched": 3}},
    {"id": 4, "name": "interview-semantic-hold", "exit_code": 0, "evidence_dir": "step-4/", "metrics": {"internally_consistent_subjects": 3}},
    {"id": 5, "name": "cluster-reproducibility", "exit_code": 0, "evidence_dir": "step-5/", "metrics": {"diff_ratio": 0.18}}
  ],
  "verdict": "pass",
  "verdict_reason": "all 5 steps green; cluster diff 0.18 < 0.40 threshold"
}
```

The final LLM judge **may only read raw JSON + the listed evidence dirs**. It must not pattern-match on the report's prose to make its call.

## Step 1 — Structural lint

Sub-agent reads:

- `docs/research/<DATE>-personal-use-3people.md`
- All three `subject-*/` subdirs

Emits raw JSON:

```json
{
  "report_present": true,
  "subject_subdirs": ["subject-1","subject-2","subject-3"],
  "per_subject_files_count": [5,6,5],
  "report_sections": ["...","## Inputs to issue #82",...],
  "issue82_inputs_count": 4
}
```

Pass conditions:

- `report_present == true`
- `len(subject_subdirs) >= 3`
- every `per_subject_files_count[i] >= 5`
- `"## Inputs to issue #82"` (or equivalent slug) present
- `issue82_inputs_count >= 3`

Fail otherwise. Sub-agent does NOT judge content quality, only structural presence.

## Step 2 — Redact integrity

Sub-agent runs the hardmatch redact regex table over every `*.redacted.jsonl` file in all three subject subdirs. Emits:

```json
{
  "scanned_files": 18,
  "leak_count": 0,
  "leak_examples": []
}
```

Pass condition: `leak_count == 0`. Any non-empty `leak_examples` triggers immediate fail and a recommended `git rm` + force-push remediation in the verdict_reason. Examples are themselves stored as redacted hashes — never as raw matches.

## Step 3 — Evidence reality sample

Sub-agent randomly picks 3 entries across all three subjects' `hooks.redacted.jsonl` whose `kind == "hook-pre.blocked"` (the actual emitted shape from `packages/adapters/src/hook/claude-agent-sdk/pre-tool-use-sdk.ts:91-94`; events do **not** carry `event_type` / `decision` fields). For each entry's `knowledge_id` (the actual field name; not `rule_id`):

1. **Rule existence**: resolve via direct SQLite lookup using `DualLayerStore.getById(knowledge_id)` at `packages/adapters/src/storage/sqlite/dual-layer-store.ts:78` (searches project DB then global DB; returns matching `KnowledgeEntry` or `undefined`). **Do NOT** call `teamagent review --scope=personal --id=<id>` — the `review` CLI parser at `packages/cli/src/commands/review.ts` only accepts `--limit` and `--scope`, so an `--id` argument is silently ignored.
2. **Existence check**: `entry !== undefined`. Failure here means the hook fired against a `knowledge_id` no longer in the DB (rule deleted, evaluation tampered).
3. **Provenance trail using ACTUAL fields the SDK emits**. The PreToolUse SDK at `pre-tool-use-sdk.ts:91-94` only writes `{ id, kind, knowledge_id, tool_use_id, tool_name, timestamp, schema_version }` to the event log — not `session_id`, not `cwd`, not `intercepted_at`. The plan's redact-export pipeline (which produces `hooks.redacted.jsonl`) is responsible for **enriching each raw SDK event** with two extra fields drawn from sibling artifacts:
   - `session_id` from the StopHook payload's `session_id` (Claude Code SDK provides it on Stop events; the redact tool joins by tool_use_id sequence or by `started_at/ended_at` window).
   - `cwd` from the subject's `recruitment.md` codebase root (one cwd per subject; constant per evaluation run).

   With those two fields enriched, verify per event:
   - `event.kind == "hook-pre.blocked"`.
   - `event.timestamp` parses as ISO and falls within `stats-start.json.window_start ≤ event.timestamp ≤ stats-end.json.window_end`.
   - `event.session_id` (enriched from Stop hook) is present and well-formed.
   - `event.cwd` (enriched from recruitment.md) matches the subject's recorded codebase root.
   - The resolved rule entry's `created_at ≤ event.timestamp` (rule existed before firing).
   - The resolved rule entry's `source` is one of the **real** `KnowledgeEntrySchema` enum values (`packages/types/src/knowledge-entry.ts:103-110`): `preset` (seed pack) or `accumulated` (live use) or `ingested` (multi-source ingest) or `imported` (from another rule store). **Forbid** `team-shared` for #81 personal-use evaluation — its presence means a team-scope rule leaked into the L1 evaluation, which violates the personal-use scope.

Emits:

```json
{
  "sample_size": 3,
  "matched": 3,
  "samples": [
    {
      "knowledge_id": "...",
      "subject": "subject-2",
      "rule_exists": true,
      "kind_is_blocked": true,
      "timestamp_in_window": true,
      "session_id_present": true,
      "cwd_matches": true,
      "rule_created_before_event": true,
      "source_in_l1_legit": true,
      "all_checks_pass": true
    }
  ]
}
```

Pass condition: `matched == sample_size` and every sample's `all_checks_pass == true`. If a sample fails any sub-check, that sample fails and the report owner must explain (or re-sample).

## Step 4 — Interview semantic hold

A second LLM (NOT the same one that wrote the report) reads each `subject-*/interview.md` raw and emits, per subject:

```json
{
  "subject_id": "subject-1",
  "claim_count": 12,
  "evidence_referenced": 9,
  "internally_consistent": true,
  "consistency_notes": "Subject says 'TeamBrain prevented bug X' and gives concrete bug X repro in q3; consistent."
}
```

Pass condition: every subject has `internally_consistent == true`. Any false subject triggers fail and requires human re-interview before re-judging.

## Step 5 — Cluster reproducibility

The same independent LLM (NOT the report author) reads:

- All three `subject-*/interview.md` (raw)
- The aggregated raw `hooks.redacted.jsonl` across subjects

Asks the LLM to re-cluster the cross-cutting findings independently, **without reading the report's `## Cluster` section**. Then computes Jaccard distance between the LLM-generated clusters and the report's clusters.

Emits:

```json
{
  "report_clusters": ["..."],
  "llm_clusters": ["..."],
  "jaccard_distance": 0.18,
  "diff_ratio": 0.18
}
```

Pass condition: `diff_ratio < 0.40`. If higher, the cluster section is too subjective; report author must augment with citation-per-cluster and re-judge.

## Step 6 — Aggregate verdict

Main agent reads `step-{1..5}/raw.json`, applies the pass conditions, and writes `verdict.json` per the schema above. If any step is fail, `verdict == "fail"` and `verdict_reason` lists the failing step IDs.

The main agent does NOT re-judge — it only aggregates. The LLM judge that produces the human-readable summary likewise reads only `verdict.json` + listed evidence dirs.

## Re-runs

Each invocation creates a new `run_id` subdir. Old runs are kept (audit trail). The latest verdict is the source of truth for whether the impl PR can merge.

## What this judge harness does NOT do

- It does not judge whether TeamBrain "is good" or whether the 3 subjects "should adopt it long-term" — those are product calls.
- It does not run the evaluation experiment again — it only verifies the executed evaluation produced the required artifacts honestly.
- It does not penalize subjects' negative feedback — internal-consistency, not positivity, is what step 4 measures.
