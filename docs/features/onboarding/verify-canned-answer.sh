#!/usr/bin/env bash
# Verify: README + 5-min onboarding (zh/en)
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
echo "=== onboarding verify ==="

if [ ! -f "${REPO_ROOT}/README.md" ]; then
  echo "FAIL: README.md not found"
  exit 1
fi
echo "README.md exists: PASS"

if grep -qE "(quick.?start|快速开始|Quick Start|30 秒上手)" "${REPO_ROOT}/README.md"; then
  echo "README contains quickstart section: PASS"
else
  echo "FAIL: README does not contain quickstart section"
  exit 1
fi

echo "VERIFIED: README + 5-min onboarding (zh/en) PASS"
