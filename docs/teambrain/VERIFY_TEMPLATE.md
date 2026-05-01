# VERIFY_TEMPLATE.md

```
 ┌──────────┐     ┌──────────┐     ┌──────────┐
 │   RUN    │────▶│   DUMP   │────▶│   READ   │
 │ pinned   │     │ .judge/  │     │ LLM judge│
 │  tools   │     │ + docs/  │     │ raw JSON │
 │set -euo  │     │ archive  │     │ only     │
 └──────────┘     └──────────┘     └──────────┘
   execute          record           conclude
```

---

## Bedrock principle

Code does not grade itself. A fixed third-party harness runs fixed tools, dumps fixed JSON and raw evidence under `.judge/<run_id>/`; a separate LLM judge reads raw JSON only — never reruns the tool. Because `.judge/` is gitignored local raw output, every real verification run that must support a PR also archives an auditable summary/index under `docs/teambrain/evidence/<run_id>/` or another registered docs path.

---

## Required fields per VERIFY recipe

Every TeamBrain verify entry MUST contain all of the following fields:

| Field | Type | Constraint |
|-------|------|-----------|
| `recipe_id` | string | regex `^VERIFY-[A-Z]+-\d{3}$` |
| `prerequisites` | list | concrete deps/fixtures/env vars — no "set up your env" |
| `command` | string | single executable shell line OR a script path; no "run the tests" without specifics |
| `expected_output` | string | regex / exact string / JSON schema / exit_code — at minimum assert output, not exit code alone |
| `failure_modes` | list | enumerated: `timeout`, `exit_code != 0`, `mismatch`, `missing_evidence`, `mock_detected` |
| `evidence_path` | string | local raw evidence dir, normally `.judge/<run_id>/`; gitignored and not sufficient for PR proof |
| `archive_path` | string | committed docs archive dir, normally `docs/teambrain/evidence/<run_id>/`; contains audit summary/index and pointers to raw evidence |
| `judge_input` | string | file path(s) the LLM judge reads — must be a file path, never "the agent's summary" |

---

## Evidence retention contract

- `.judge/<run_id>/` is the canonical local raw judge output: `judge.json`, stdout/stderr, coverage, screenshots, and other bulky evidence.
- `.judge/` is transient and gitignored. A PR cannot rely on `.judge/` alone to self-prove a real task.
- `docs/teambrain/evidence/<run_id>/` is the canonical committed audit archive. It contains `INDEX.md`, `judge-summary.json`, checksums or excerpts, and pointers back to `.judge/<run_id>/`.
- Do not fabricate completion evidence. If a real task was not run, the archive must say it is a template, dry run, or missing run; never imply Real Task #1 or any named task completed without raw judge evidence.

---

## Three-stage harness skeleton

```bash
#!/usr/bin/env bash
# VERIFY harness skeleton — RUN → DUMP → READ
set -euo pipefail

RECIPE_ID="${1:?recipe_id required}"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)_${RECIPE_ID}"
EVIDENCE_DIR=".judge/${RUN_ID}"
ARCHIVE_DIR="docs/teambrain/evidence/${RUN_ID}"
mkdir -p "${EVIDENCE_DIR}" "${ARCHIVE_DIR}"

# ── RUN ──────────────────────────────────────────────────────────────────────
# Pinned tool invocation; never use || true here
EXIT_CODE=0
pnpm typecheck \
  > "${EVIDENCE_DIR}/stdout.txt" \
  2> "${EVIDENCE_DIR}/stderr.txt" \
  || EXIT_CODE=$?

# Capture metrics (example: count error lines)
ERROR_COUNT=$(grep -c "error TS" "${EVIDENCE_DIR}/stdout.txt" || true)

# ── DUMP ─────────────────────────────────────────────────────────────────────
cat > "${EVIDENCE_DIR}/judge.json" <<EOF
{
  "recipe_id": "${RECIPE_ID}",
  "run_id": "${RUN_ID}",
  "exit_code": ${EXIT_CODE},
  "metrics": {
    "ts_error_count": ${ERROR_COUNT}
  },
  "evidence_dir": "${EVIDENCE_DIR}",
  "archive_dir": "${ARCHIVE_DIR}",
  "stdout_path": "${EVIDENCE_DIR}/stdout.txt",
  "stderr_path": "${EVIDENCE_DIR}/stderr.txt"
}
EOF

cat > "${ARCHIVE_DIR}/judge-summary.json" <<EOF
{
  "recipe_id": "${RECIPE_ID}",
  "run_id": "${RUN_ID}",
  "exit_code": ${EXIT_CODE},
  "metrics": {
    "ts_error_count": ${ERROR_COUNT}
  },
  "raw_evidence_dir": "${EVIDENCE_DIR}",
  "raw_judge_path": "${EVIDENCE_DIR}/judge.json"
}
EOF

cat > "${ARCHIVE_DIR}/INDEX.md" <<EOF
# Evidence ${RUN_ID}

- recipe_id: ${RECIPE_ID}
- raw_evidence_dir: \`${EVIDENCE_DIR}\` (local, gitignored)
- summary: \`${ARCHIVE_DIR}/judge-summary.json\`
- stdout: \`${EVIDENCE_DIR}/stdout.txt\`
- stderr: \`${EVIDENCE_DIR}/stderr.txt\`
EOF

# ── READ ─────────────────────────────────────────────────────────────────────
# Separate LLM judge reads raw JSON only — does NOT rerun the tool
claudefast -p "
You are a third-party judge. Read ONLY the raw JSON and evidence files below.
Do NOT rerun any commands. Output a JSON verdict: {pass: bool, reason: string}.

judge.json: $(cat "${EVIDENCE_DIR}/judge.json")
stdout (first 100 lines): $(head -n 100 "${EVIDENCE_DIR}/stdout.txt")
"
```

---

## Filled-in example

```yaml
recipe_id: VERIFY-PNPM-001
prerequisites:
  - node >= 18
  - pnpm installed (pnpm --version must exit 0)
  - repo root package.json present with typecheck script
  - no uncommitted generated files that would break tsc
command: "scripts/verify/VERIFY-PNPM-001.sh"
expected_output:
  exit_code: 0
  regex_on_stdout: "^(?!.*error TS)"  # zero lines matching "error TS"
failure_modes:
  - timeout: command runs > 120s
  - exit_code != 0: tsc found type errors
  - mismatch: exit_code=0 but stdout contains "error TS" lines
  - missing_evidence: .judge/{RUN_ID}/judge.json or docs/teambrain/evidence/{RUN_ID}/INDEX.md not written
  - mock_detected: tsconfig paths redirected to stubs
evidence_path: ".judge/{RUN_ID}/"
archive_path: "docs/teambrain/evidence/{RUN_ID}/"
judge_input: ".judge/{RUN_ID}/judge.json"
```

---

## Banned patterns

1. **Verbal sign-off** — "I reviewed the output and it looks fine." Not evidence. Rejected.
2. **Agent self-grading** — the same agent that wrote the code also declares it passing. Structural conflict of interest.
3. **Hidden `|| true`** — silences exit codes; the harness MUST propagate failures, never suppress them.
4. **Exit-code-only check** — `exit 0` alone is insufficient; `expected_output` must also assert on stdout/stderr content.
5. **Single-LLM judge that also wrote the test** — the judge must be a separate invocation with no write access to the code under test.
6. **Pseudo-code commands** — `command` field must be a real executable shell line, not "run the typecheck step".
7. **`verify_command` omitted** — no loopholes; every VERIFY entry requires a concrete `command`.
8. **PR proof only in `.judge/`** — `.judge/` is local raw output and gitignored; archive a summary/index under docs before claiming a PR is evidenced.
9. **Fabricated real-task evidence** — never create docs that imply a named real task completed unless the referenced raw judge run exists.

---

## Cross-reference

- **TASK_TEMPLATE.md** — the `Success criteria` field MUST reference a `recipe_id` matching `^VERIFY-[A-Z]+-\d{3}$`. A task with a success criterion that does not point to a VERIFY recipe is incomplete.
- **TRAP_FORMAT.md** — the `verify_command` field must point to a VERIFY recipe by `recipe_id` or provide the full shell command that feeds into a VERIFY harness. "Run the tests" is not acceptable.
