# Deprecated Judge Harness Scripts

These shell scripts are archived here as a frozen reference. **They are
no longer called by any workflow** in this project.

## Why deprecated

The project's third-party judge harness rule (see
`docs/HOWTO-PLAN-PR.md` § 3b and `docs/PR-PLAN.md` § ③) requires:

- **Third-party judge harness forbidden fixed scripts.**
- **MUST use md playbook.**

Judge harnesses must live at `docs/plans/<issue>/judge.md` as markdown
playbooks dispatched by the MAIN agent through subagents (TEAMWORK
`N+1+(2N)`) or `claudefast -p` probes (FASTPROBE max 8 parallel).
Fixed bash scripts encode judgement logic into code that itself needs
a judge — recursive "who tests the test?" — and reviewers can't grep
judgement logic out of `[[ ]]` exit codes.

## What's archived

Categories preserved under their original relative paths:

- Per-rule canned-answer verifiers (`docs/<rule>/verify-canned-answer.sh`)
- Per-feature judge harnesses
  (`docs/features/<feature>/{run,prod,real,extraction,transfer}-judge.sh`,
  `docs/features/<feature>/verify-canned-answer.sh` for the subset that
  grep canned-answer probe outputs)
- canary-verify, feature-verify-kit harnesses
- Project-wide orchestrators: `scripts/verify-all-rules.sh`,
  `scripts/verify-l*.sh`, `scripts/judge-*.sh`, `scripts/duck-mode-verify.sh`,
  `scripts/hook-prompt-verify.sh`, `scripts/verify-vendored-skills.sh`,
  `scripts/verify-issue85-pr1.sh`, `scripts/verify-hyperframes-fixes.sh`,
  `scripts/verify-codex-raw-chat.sh`, `scripts/verify/tbrain-verify.sh`,
  `scripts/user-collect/run-v4-judge.sh`

UTILITY scripts (CLI smoke tests, vitest wrappers, mirror checkers, dogfood
launchers, info collectors, installers, demos, hook scripts, test fixtures)
are NOT archived — they remain in their original locations.

## Migration path

For each archived script, the verification logic should move into a
`docs/plans/<feature>/judge.md` md playbook with three sections:

- **§V1 RUN** — fixed tools to invoke
- **§V2 DUMP** — canonical JSON schema written to `.judge/<run_id>/judge.json`
- **§V3 READ** — separate LLM judge reads ONLY raw JSON + evidence

The MAIN agent dispatches the playbook through subagents or claudefast probes;
no fixed bash gates the verdict.

This archive exists for git history and reference. Deleting the archive
entirely in a future commit is acceptable; `git log` preserves original
content.
