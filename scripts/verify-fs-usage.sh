#!/usr/bin/env bash
# Channel #2: file-read tracing via macOS fs_usage
# Inputs:  RUN_ID (required), DURATION (optional, default 60)
# Outputs: .judge/$RUN_ID/evidence/fs_usage.log  (written by background fs_usage process)
#          stdout: spawned pid (integer only)
set -eu

: "${RUN_ID:?RUN_ID is required}"
DURATION="${DURATION:-60}"

mkdir -p ".judge/${RUN_ID}/evidence"

# Verify macOS tool
if ! command -v fs_usage >/dev/null 2>&1; then
  echo "fs_usage requires macOS; channel mandatory; aborting" >&2
  exit 1
fi

# Verify cached sudo credentials (no password prompt)
if ! sudo -n true 2>/dev/null; then
  echo "fs_usage requires sudo; run 'sudo -v' first" >&2
  exit 2
fi

# Spawn background trace; redirect stdout to log, stderr merged in.
# $! after sudo is the sudo wrapper pid; the real fs_usage is its child.
sudo fs_usage -w -f filesys -t "${DURATION}" node \
  > ".judge/${RUN_ID}/evidence/fs_usage.log" 2>&1 &
SUDO_PID=$!
sleep 0.5
FS_USAGE_PID="$(pgrep -P "${SUDO_PID}" 2>/dev/null | head -1 || true)"
if [ -z "${FS_USAGE_PID}" ]; then
  echo "warning: could not resolve fs_usage child pid; falling back to sudo wrapper pid=${SUDO_PID}" >&2
  echo "${SUDO_PID}"
else
  echo "${FS_USAGE_PID}"
fi
