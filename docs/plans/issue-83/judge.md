```text
   judge.md — issue #83 team-scope session recording + gbrain index harness
   (MD playbook, NOT a fixed bash script)

   main agent
       │
       ├─► sub-agent 1: glossary lint (forbidden terms in prose only)
       ├─► sub-agent 2: PoC ingest (record → ingest → query hit)
       ├─► sub-agent 3: multi-subject e2e (2 users same team_id, cross-query)
       ├─► sub-agent 4: redaction integrity (synthetic token cast)
       ├─► sub-agent 5: attribution link (session_id ↔ rule_id round-trip)
       ├─► sub-agent 6: dependency on #82 (team_id algorithm match)
       └─► main agent aggregate verdict.json
```

# Judge harness — issue #83

This is the **MD playbook** dispatched by the main agent (or maintainer) when verifying that the follow-up impl PR for #83 has shipped a real `teamagent record` + gbrain ingest pipeline that actually re-finds the recording via team-scope query — and doesn't leak secrets in transcripts.

## Inputs

- The impl PR's diff
- `packages/cli/src/commands/record.ts` (new)
- `packages/<m5-shell>/src/recording-ingest.ts` (new)
- `packages/core/src/recording/page-schema.ts` (new)
- `docs/specs/<DATE>-team-scope-session-recording.md` (new)
- `docs/plans/issue-83/poc-evidence/<run-id>/...`
- `docs/plans/issue-83/multi-subject-evidence/<run-id>/...`
- `docs/plans/issue-83/redaction-proof/...`
- Existing gbrain MCP tools (read-only access)
- `packages/core/src/m5/secret-scanner.ts` and `m5-sync.ts` (for team_id alg)

## Outputs

- `docs/plans/issue-83/judge-output/<run-id>/verdict.json`
- `docs/plans/issue-83/judge-output/<run-id>/step-<N>/raw.json` + `evidence/`

`verdict.json` schema:

```json
{
  "run_id": "<iso-or-uuid>",
  "steps": [
    {"id": 1, "name": "glossary-lint",        "exit_code": 0, "metrics": {"hits_in_prose": 0}},
    {"id": 2, "name": "poc-ingest",           "exit_code": 0, "metrics": {"query_top_score": 0.78, "page_id_match": true}},
    {"id": 3, "name": "multi-subject-e2e",    "exit_code": 0, "metrics": {"a_finds_b": true, "b_finds_a": true}},
    {"id": 4, "name": "redaction-integrity",  "exit_code": 0, "metrics": {"token_leak_count": 0, "path_leak_count": 0, "key_leak_count": 0}},
    {"id": 5, "name": "attribution-link",     "exit_code": 0, "metrics": {"event_has_session_id": true, "page_has_rule_id": true, "link_resolves": true}},
    {"id": 6, "name": "dependency-on-#82",    "exit_code": 0, "metrics": {"teamid_algorithms_match": true}}
  ],
  "verdict": "pass",
  "verdict_reason": "all 6 steps green; recording ingestable, retrievable, redacted, attributed, isolated to team_id"
}
```

## Step 1 — Glossary lint

Same logic as `docs/plans/issue-82/judge.md` Step 1 (whitelist: top ASCII art, backtick code, quoted issue title, `## Glossary mapping` section, meta risk rows). Forbidden terms add issue-83 specific bans: `["group video","group video recording","group brain","cross-user","federated"]`.

Pass condition: `hits_in_prose == 0`.

## Step 2 — PoC ingest

Sub-agent runs:

1. `teamagent record --session-id=poc-<rid> --duration=600` against a synthetic CC session that intentionally includes ≥3 prompts that should match team-scope rules.
2. Wait for ingest to complete; record `cast_file_path`, `transcript_md_path`, `gbrain_page_id`, `timeline_entries_count`.
3. Issue `mcp__gbrain__query "<one of the synthetic prompt phrases>"`; record top result.

Emit:

```json
{
  "session_id": "poc-<rid>",
  "cast_file_uploaded": true,
  "page_id": "...",
  "timeline_entries_count": 7,
  "query_top_page_id": "...",
  "query_top_score": 0.78,
  "page_id_match": true
}
```

Pass conditions: `cast_file_uploaded == true`, `timeline_entries_count >= 3`, `page_id_match == true`, `query_top_score > 0.5`.

## Step 3 — Multi-subject e2e

Sub-agent simulates two distinct git authors (different `git config user.email`) recording in the same git project (same team_id). Each records ≥3 minutes of synthetic CC session with a distinguishable phrase set. Sub-agent then queries gbrain for each subject's distinguishable phrase, expecting to find the *other* subject's recording.

Emit:

```json
{
  "subject_a_email": "a@example.test",
  "subject_b_email": "b@example.test",
  "a_record_page_id": "...",
  "b_record_page_id": "...",
  "a_query_finds_b": true,
  "b_query_finds_a": true
}
```

Pass condition: both directions return the other subject's page in their query top-3.

## Step 4 — Redaction integrity

Sub-agent uses a fixed synthetic cast file `docs/plans/issue-83/redaction-proof/token-test.cast` containing:

- A fake API token like `sk-FAKE${random_hex_40}` (40+ char shape)
- A fake AWS access key line `aws_access_key_id=AKIAFAKE${...}`
- A fake home path `/Users/fakeuser/secret/`
- A fake email `secret@example.test`

Sub-agent runs the impl PR's ingest pipeline against this cast, then reads:

- The transcript markdown (`transcript_md_path` from step 2's flow)
- The page content (`mcp__gbrain__get_page` on the resulting page slug)
- The uploaded cast file content (`mcp__gbrain__file_url` → fetch contents)

Sub-agent greps each for fake-token-shape patterns:

```json
{
  "transcript_token_leak": 0,
  "transcript_path_leak": 0,
  "transcript_key_leak": 0,
  "transcript_email_leak": 0,
  "page_token_leak": 0,
  "page_path_leak": 0,
  "page_key_leak": 0,
  "page_email_leak": 0,
  "uploaded_cast_token_leak_warning": "frame-level redaction OUT OF SCOPE for v1; cast file is uploaded as-is and requires manual review by author",
  "uploaded_cast_token_leak_count": 4
}
```

Pass conditions: `transcript_*_leak == 0` AND `page_*_leak == 0`. The uploaded cast file IS expected to contain raw tokens (frame-level redaction is OUT OF SCOPE for v1); this is documented and surfaced as a warning, not a fail. Authors must manually scrub cast files containing real secrets before publishing. UI banner in record CLI must remind users.

## Step 5 — Attribution link

Sub-agent inspects step 2's PoC session evidence:

- AttributionBus event log: at least 1 event during the session must contain `recording_session_id == poc-<rid>`.
- Resulting gbrain page frontmatter: must contain `attribution_link_to_rule_id` non-empty if any team-scope rule was triggered during the session.
- Round-trip: `mcp__gbrain__query` for the rule_id-related text must return the page with the recording_session_id; the link from rule trigger → recording → timestamp clip must resolve (URL fetchable).

Emit:

```json
{
  "event_has_session_id": true,
  "page_has_rule_id": true,
  "link_resolves": true,
  "round_trip_seconds": 1.4
}
```

Pass condition: all three true.

## Step 6 — Dependency on #82

Sub-agent reads:

- `packages/core/src/m5/m5-sync.ts` — extract the team_id computation algorithm
- `packages/<m5-shell>/src/recording-ingest.ts` — extract the team_id computation algorithm

Both must compute team_id as `SHA256(normalize(git remote))[:16]` (or call into the same shared helper).

Emit:

```json
{
  "m5_sync_uses_helper": true,
  "recording_ingest_uses_helper": true,
  "shared_helper_path": "packages/core/src/m5/team-id.ts",
  "teamid_algorithms_match": true
}
```

Pass condition: `teamid_algorithms_match == true`. Failure means the impl PR is silently forking the team_id concept; reviewer asks for refactor before merge.

## Step 7 — Aggregate verdict

Main agent reads `step-{1..6}/raw.json`, applies pass conditions, writes `verdict.json` per the schema above. Failure on any step is a hard block.

## What this judge harness does NOT do

- It does not judge whether asciinema is the "right" recording technology — that's a v1 decision in the plan.
- It does not enforce frame-level redaction — explicitly OUT OF SCOPE for v1.
- It does not test cross-project (different `team_id`) playback — that's a non-goal.
- It does not measure end-user UX for "watching another teammate's clip" — UX is iterated in v2.
- It does not retrain or re-rank gbrain's hybrid search; trusts gbrain's existing query behavior.
