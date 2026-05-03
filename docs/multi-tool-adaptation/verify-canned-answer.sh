#!/usr/bin/env bash
# Verify the multi-tool-adaptation canned answer through claudefast.
# PASS = all 6 grep anchors hit + at least one packages/ file path mentioned.
# Exit 0 on PASS, 1 on FAIL.

set -u

PROMPT="what is TeamBrain's multi-tool adaptation feature? include 4 channels (PreToolUse / UserPromptSubmit / Stop analyze / AttributionBus), MCP Server status, supported tools (Claude Code/Cursor/Codex), what's IMPLEMENTED vs NOT YET, cite file paths"
LOG="/tmp/multitool-verify-$(date +%s).out"

echo "[verify] running claudefast..." >&2
timeout 180 claudefast -p "$PROMPT" 2>&1 | tee "$LOG" > /dev/null
echo "[verify] log -> $LOG" >&2

PASS=1
check() {
  local name="$1" pattern="$2"
  if grep -Eq "$pattern" "$LOG"; then
    echo "[PASS] $name"
  else
    echo "[FAIL] $name (pattern: $pattern)"
    PASS=0
  fi
}

check "PreToolUse channel"        "PreToolUse"
check "UserPromptSubmit channel"  "UserPromptSubmit"
check "Stop analyze channel"      "Stop( analyze| hook| 钩子)?"
check "AttributionBus channel"    "[Aa]ttribution([- ]?[Bb]us)?"
check "MCP NOT YET"               "MCP.*(NOT YET|未实现|not implemented|尚未|Phase 2)"
check "Cursor NOT YET"            "[Cc]ursor.*(NOT YET|未实现|importer only|no compiler|尚未|不支持)"
check "packages/ file path"       "packages/(cli|adapters|ports|core)/"

if [ "$PASS" -eq 1 ]; then
  echo "[verify] PASS"
  exit 0
else
  echo "[verify] FAIL — see $LOG"
  exit 1
fi
