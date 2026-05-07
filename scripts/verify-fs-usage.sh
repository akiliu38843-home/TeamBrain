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

# Spawn background trace; redirect stdout to log, stderr merged in
sudo fs_usage -w -f filesys -t "${DURATION}" node \
  >.judge/"${RUN_ID}"/evidence/fs_usage.log 2>&1 &

echo $!
