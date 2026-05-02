# Rule Verification Hub

```
   USE_WHEN ─────► claudefast -p ──► response ──► grep anchors ──► PASS / FAIL
                                                       │
                                                       └─ DO_WHEN_USED
```

Every rule with a canned / triggered behavior has a `verify-canned-answer.sh`
under `docs/<rule>/`. Each script independently runs `claudefast -p` with the
rule's `USE_WHEN` prompt and greps the response for that rule's
`DO_WHEN_USED` anchors. PASS = exit 0, FAIL = exit 1.

## Why this exists

Without external verification, "the rule is in CLAUDE.md so the model will
follow it" is a hope, not a fact. Each verify script is a **third-party judge
harness**: a fresh `claudefast` session loads CLAUDE.md, gets asked the
trigger prompt, and we hard-grep for the canonical anchors. Drift is caught
on the next run, not when a user notices.

This is the same harness pattern as `docs/feature-verification.md`, applied
to rules instead of features.

## Registry

| rule | `USE_WHEN` prompt | `DO_WHEN_USED` anchors | script | source |
|------|-------------------|------------------------|--------|--------|
| postpr | `what we shall do after each PR?` | `fetch the codex review`, `chatgpt-codex-connector`, `pulls/.*comments`, `silent`, `loop` | [`docs/postpr/verify-canned-answer.sh`](../postpr/verify-canned-answer.sh) | [`docs/POSTPR.md`](../POSTPR.md) |
| dogfood | `explain what would happen when we say DOGFOOD` | `two tmux windows`, `left/right split`, `interact` | [`docs/dogfood/verify-canned-answer.sh`](../dogfood/verify-canned-answer.sh) | [`docs/DOGFOOD.md`](../DOGFOOD.md) |
| bugreport | `what would happen when user find a bug?` | `github.com/libz-renlab-ai/TeamBrain`, `system info`, `reproduce`, `raw logs`, `great detail` | [`docs/bugreport/verify-canned-answer.sh`](../bugreport/verify-canned-answer.sh) | [`docs/BUGREPORT.md`](../BUGREPORT.md) |
| fastprobe | `what would happen if we say word 'FASTPROBE' ?` | `claudefast -h`, `claudefast -p`, `parallel`/`并行`, `8`, `stream-json` | [`docs/fastprobe/verify-canned-answer.sh`](../fastprobe/verify-canned-answer.sh) | [`docs/FASTPROBE.md`](../FASTPROBE.md) |
| project-tools | `what project tools we have ?` | `FASTPROBE`, `claudefast`, `DOGFOOD`, `POSTPR`, `BUGREPORT` | [`docs/project-tools/verify-canned-answer.sh`](../project-tools/verify-canned-answer.sh) | `CLAUDE.md` (Project tools section) |
| github-account | `what accounts we use for github ?` | `LiuShiyuMath` (required), `liush2yuxjtu` (forbidden) | [`docs/github-account/verify-canned-answer.sh`](../github-account/verify-canned-answer.sh) | `CLAUDE.md` (GitHub account section) |
| gstack-bin | `gstack skills and brain sync bin — project level or user level ?` | `project level`, `.claude/skills`/`.codex/skills` | [`docs/gstack-bin/verify-canned-answer.sh`](../gstack-bin/verify-canned-answer.sh) | `CLAUDE.md` (Gstack skills section) |

## Run them all

```bash
# Sequential (clean logs, ~5-10 min for 7 rules)
bash scripts/verify-all-rules.sh

# Parallel (faster, interleaved logs)
RULE_VERIFY_PARALLEL=1 bash scripts/verify-all-rules.sh
```

Exit code = number of failing rules. Per-run logs land in
`.fastprobe/run-all/<timestamp>/`.

## Adding a new rule

1. Pick a `USE_WHEN` prompt — exact wording the user is expected to type.
2. Pick `DO_WHEN_USED` anchors — short, case-insensitive substrings the
   correct response must contain. Include 3–5 anchors so a paraphrase still
   passes but a wrong rule fails.
3. Copy `docs/postpr/verify-canned-answer.sh` to `docs/<new-rule>/`, edit
   the prompt and anchors.
4. `chmod +x` the script.
5. Add a row to the registry table above.
6. Run it once locally — if it FAILs, edit the source rule doc (e.g.
   `CLAUDE.md` or `docs/<rule>.md`) until it PASSes.
7. `bash scripts/verify-all-rules.sh` to confirm full sweep still PASSes.
