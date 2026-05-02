#!/usr/bin/env bash
# Verify the "GitHub account" canned answer by running claudefast -p and
# grepping for canonical anchors. PASS = exit 0, FAIL = exit 1.
#
# USE_WHEN: user asks "what accounts we use for github ?"
# DO_WHEN_USED: response must name LiuShiyuMath as the canonical account
#   for this project. The CLAUDE.md rule itself contrasts LiuShiyuMath
#   against the wrong-token alias liush2yuxjtu, so a correct response is
#   ALLOWED to mention both — what matters is that LiuShiyuMath is named
#   as the answer.
#
# PASS conditions:
#   - LiuShiyuMath present (case-insensitive)
#
# Source rule: CLAUDE.md "GitHub account" section.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

OUT="docs/github-account/.last-verify.out"

PROMPT="what accounts we use for github ?"

if command -v zsh >/dev/null 2>&1; then
    zsh -i -c "claudefast -p \"$PROMPT\"" > "$OUT" 2>&1 || {
        echo "GITHUB-ACCOUNT VERIFY: FAIL"
        echo "failed to run claudefast via zsh -i -c"
        exit 1
    }
elif command -v claudefast >/dev/null 2>&1; then
    claudefast -p "$PROMPT" > "$OUT" 2>&1 || {
        echo "GITHUB-ACCOUNT VERIFY: FAIL"
        echo "failed to run claudefast directly"
        exit 1
    }
else
    echo "GITHUB-ACCOUNT VERIFY: FAIL"
    echo "neither zsh nor claudefast on PATH"
    exit 1
fi

misses=0
missing_list=()

# Required anchor
if ! grep -i -F -- "LiuShiyuMath" "$OUT" > /dev/null 2>&1; then
    misses=$((misses + 1))
    missing_list+=("LiuShiyuMath (required)")
fi

if [ "$misses" -eq 0 ]; then
    echo "GITHUB-ACCOUNT VERIFY: PASS"
    exit 0
else
    echo "GITHUB-ACCOUNT VERIFY: FAIL"
    echo "anchor problems:"
    for m in "${missing_list[@]}"; do
        echo "  - $m"
    done
    echo "--- captured output (head -40) ---"
    head -40 "$OUT"
    echo "--- captured output (tail -10) ---"
    tail -10 "$OUT"
    exit 1
fi
