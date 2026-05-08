```text
   judge.md — issue #89 stack packs harness playbook
   (MD playbook, NOT a fixed bash script)

   main agent
       │
       ├─► sub-agent 1: schema lint (parse each jsonl line)
       ├─► sub-agent 2: file-type scope (5 stacks have it, universal doesn't)
       ├─► sub-agent 3: substring-friendly (no regex metachars)
       ├─► sub-agent 4: cross-language false-trigger (synthetic fixtures)
       ├─► sub-agent 5: real-codebase sample (≥3 OSS repos)
       └─► main agent aggregate verdict.json
```

# Judge harness — issue #89

This is the **MD playbook** dispatched by `docs/features/stack-packs/run-judge.sh` (a thin shim) when verifying that the follow-up impl PR for #89 has shipped 5 well-formed stack packs.

## Inputs

- `packages/teamagent/seed/packs/{universal,frontend-js,python-data,ops-safety,golang,rust}.jsonl`
- `packages/teamagent/seed/packs/README.md`
- `docs/plans/issue-89/judge-fixtures/synthetic-{frontend-js,python-data,ops-safety,golang,rust}.txt` (one synthetic snippet per language for step 4)

## Outputs

- `docs/plans/issue-89/judge-output/<run-id>/verdict.json`
- `docs/plans/issue-89/judge-output/<run-id>/step-<N>/raw.json` + `evidence/`

The `verdict.json` schema:

```json
{
  "run_id": "<iso-or-uuid>",
  "packs": ["universal","frontend-js","python-data","ops-safety","golang","rust"],
  "steps": [
    {"id": 1, "name": "schema-lint",         "exit_code": 0, "metrics": {"valid_lines_total": 50, "invalid_lines_total": 0}},
    {"id": 2, "name": "file-type-scope",     "exit_code": 0, "metrics": {"stack_packs_with_file_types": 5, "universal_has_file_types": false}},
    {"id": 3, "name": "substring-friendly",  "exit_code": 0, "metrics": {"substring_friendly_count": 50, "regex_like_count": 0}},
    {"id": 4, "name": "cross-lang-false",    "exit_code": 0, "metrics": {"rules_only_firing_in_expected_lang": 50, "rules_misfiring_count": 0}},
    {"id": 5, "name": "real-codebase",       "exit_code": 0, "metrics": {"dead_rules": [], "noisy_rules": []}}
  ],
  "verdict": "pass",
  "verdict_reason": "all 5 steps green; no dead/noisy outliers"
}
```

## Step 1 — Schema lint

Sub-agent reads each jsonl file line-by-line. Per line:

- Must `JSON.parse` cleanly.
- Required fields: `id`, `scope.level`, `category`, `tags`, `type`, `nature`, `trigger`, `wrong_pattern`, `correct_pattern`, `reasoning`, `confidence`, `enforcement`, `status`, `source`, `current_tier`, `tier_entered_at`.
- `scope.level == "global"` (per pack convention).
- `source == "preset"`.
- `current_tier == "canonical"`.
- `id` matches `^seed-pack-(universal|frontend-js|python-data|ops-safety|golang|rust)-[a-z0-9-]+$`.

Emit `{file, valid_lines, invalid_lines, invalid_examples}`. Pass condition: `invalid_lines_total == 0`.

## Step 2 — File-type scope

Sub-agent checks:

- For each of the 5 stack packs, every line has a non-empty `scope.file_types` array.
- For `universal.jsonl`, every line has either no `scope.file_types` field or an empty array (universal = cross-language).

Emit `{file, lines_with_file_types, lines_without}`. Pass condition: stack packs all have it, universal doesn't.

## Step 3 — Substring-friendly

Sub-agent inspects each rule's `wrong_pattern`. Pass condition: it contains **no regex metacharacters** from the set `^$.*+?(){}[]|\\`. Anchored on the legacy substring matcher requirement (ADR-0001 / ADR-0002 lineage).

If a rule legitimately needs regex (rare), it must be `nature: "subjective"` AND `enforcement: "warn"` AND have a non-empty `wrong_pattern_regex_safe` field marking the author's intent. The default should be plain substring.

Emit `{file, substring_friendly_count, regex_like_count, regex_examples[]}`.

## Step 4 — Cross-language false-trigger

Sub-agent runs each rule's `wrong_pattern` against all 5 synthetic fixtures (`judge-fixtures/synthetic-<lang>.txt`). For each rule:

- `expected_langs = scope.file_types` (mapped to language, e.g. `js/jsx/ts/tsx → frontend-js`).
- `fired_langs = languages whose synthetic fixture contained the substring`.
- The rule passes iff `fired_langs ⊆ expected_langs`.

Emit per-rule:

```json
{"rule_id": "seed-pack-frontend-js-var-decl", "expected_langs": ["frontend-js"], "fired_langs": ["frontend-js"], "ok": true}
```

Pass condition: every rule's `ok == true`.

## Step 5 — Real-codebase sample

Sub-agent picks ≥3 real OSS repos (suggested set, configurable):

- frontend-js: `freeCodeCamp/freeCodeCamp` snapshot
- python-data: `pandas-dev/pandas` snapshot
- ops-safety: `kubernetes/kubernetes` snapshot
- golang: `spf13/cobra` snapshot
- rust: `tokio-rs/tokio` snapshot

For each pack, sub-agent runs each rule's `wrong_pattern` (with the rule's `scope.file_types` as a path filter) and counts hits.

Emit per-rule:

```json
{"rule_id": "...", "repo": "...", "hits": 12}
```

Aggregate `dead_rules = rules with 0 hits across all sampled repos`. Aggregate `noisy_rules = rules with > 200 hits in a single repo`.

Pass condition: `len(dead_rules) <= 1` per pack (occasional miss tolerated) AND `len(noisy_rules) == 0`. Failures don't necessarily fail the PR but require the author to either drop / tighten the rule, or label it `nature: "subjective"` + `enforcement: "warn"` and document why it's still in.

## Step 6 — Aggregate verdict

Main agent reads `step-{1..5}/raw.json`, applies pass conditions, writes `verdict.json` per the schema above. Failure on steps 1–4 is a hard block; failure on step 5 is a soft block (requires author note in PR before merge).

## What this judge harness does NOT do

- It does not run TeamBrain's full PreToolUse / UserPromptSubmit / Stop pipeline against the new packs (that's calibration territory — ADR-0004).
- It does not judge whether a given rule is "wise" — only whether it's structurally correct, file-type-scoped, substring-friendly, language-isolated, and grounded in real-codebase prevalence.
- It does not enforce confidence values — a rule shipped at `confidence: 0.6` is fine; calibration will adjust it post-merge.
