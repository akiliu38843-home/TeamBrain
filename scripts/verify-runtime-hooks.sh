#!/usr/bin/env bash
# verify-runtime-hooks.sh — Channel #3: Hook invocation evidence collector
#
# Inputs (env vars, all required):
#   RUN_ID      — unique identifier for this harness run
#   HOMEDIR     — tmp HOME dir (contains .claude/settings.json wired by teamagent init)
#   PROJECT_DIR — fresh tmp project dir (must contain package.json)
#
# Outputs written to .judge/$RUN_ID/evidence/:
#   streamjson.log       — claudefast stdout+stderr (stream-json + debug output)
#   hooks.debug.log      — claudefast hook debug log (--debug-file target)
#   hooks-exit-code.txt  — exit code from the claudefast invocation (single integer)
#
# Exit codes:
#   0 — claudefast was successfully spawned (regardless of its own exit code)
#   1 — claudefast not found on PATH, or required env var missing

set -eu

# ── Validate required env vars ────────────────────────────────────────────────
: "${RUN_ID:?ERROR: RUN_ID is required}"
: "${HOMEDIR:?ERROR: HOMEDIR is required}"
: "${PROJECT_DIR:?ERROR: PROJECT_DIR is required}"

# ── Validate claudefast is on PATH ────────────────────────────────────────────
if ! command -v claudefast >/dev/null 2>&1; then
    echo "ERROR: claudefast not found on PATH — install it before running Channel #3" >&2
    exit 1
fi

# ── Prepare evidence directory ────────────────────────────────────────────────
EVIDENCE_DIR=".judge/${RUN_ID}/evidence"
mkdir -p "${EVIDENCE_DIR}"

DEBUG_FILE="${EVIDENCE_DIR}/hooks.debug.log"
STREAM_LOG="${EVIDENCE_DIR}/streamjson.log"
EXIT_CODE_FILE="${EVIDENCE_DIR}/hooks-exit-code.txt"

# ── Invoke claudefast from PROJECT_DIR with overridden HOME ───────────────────
# Prompt is engineered to trigger a PreToolUse Read event (Channel #3 target).
# SessionStart fires automatically on session open.
# We capture exit code separately so that claudefast's own failure doesn't
# cause this script to exit non-zero (the orchestrator reads logs to judge).
cd "${PROJECT_DIR}"

claudefast_exit=0
HOME="${HOMEDIR}" claudefast -p \
    --output-format stream-json \
    --include-partial-messages \
    --verbose \
    --debug hooks \
    --debug-file "${DEBUG_FILE}" \
    --permission-mode acceptEdits \
    "Read the file package.json in this directory and tell me one fact about it." \
    > "${STREAM_LOG}" 2>&1 \
    || claudefast_exit=$?

# Record claudefast's own exit code for the orchestrator to inspect
printf '%s\n' "${claudefast_exit}" > "${EXIT_CODE_FILE}"

echo "Channel #3 evidence collected — claudefast exit=${claudefast_exit}"
echo "  stream-json : ${STREAM_LOG}"
echo "  hook debug  : ${DEBUG_FILE}"
echo "  exit code   : ${EXIT_CODE_FILE}"

exit 0
