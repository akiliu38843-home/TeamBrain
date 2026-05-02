#!/usr/bin/env bash
# Verify the "GitHub account" canned answer by running claudefast -p and
# grepping for canonical anchors. PASS = exit 0, FAIL = exit 1.
#
# USE_WHEN: user asks "what accounts we use for github ?"
# DO_WHEN_USED: response must name LiuShiyuMath as the canonical account
#   for this project. The CLAUDE.md rule itself contrasts LiuShiyuMath
#   against the wrong-token alias liush2yuxjtu ("don't use liush2yuxjtu"),
#   so a correct response is ALLOWED to mention both — what matters is
#   which account is presented as the answer.
#
# PASS conditions (both):
#   1. LiuShiyuMath present (case-insensitive)
#   2. The FIRST account-name reference (LiuShiyuMath | liush2yuxjtu) in
#      the response is LiuShiyuMath — i.e. the canonical answer leads,
#      and the wrong-token alias only appears later as a contrast.
#
# Why disambiguation #2 matters: a regression like "use liush2yuxjtu, not
# LiuShiyuMath" still mentions both names, so a presence-only check would
# falsely PASS. Requiring the first reference be LiuShiyuMath catches
# this — the canonical CLAUDE.md doc structure ("使用 LiuShiyuMath，不要
# 使用 liush2yuxjtu") puts the right name first by construction.
# (Codex review on PR #56.)
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

# Required anchor — LiuShiyuMath must appear at all
if ! grep -i -F -- "LiuShiyuMath" "$OUT" > /dev/null 2>&1; then
    misses=$((misses + 1))
    missing_list+=("LiuShiyuMath (required)")
fi

# Disambiguation — the first account-name reference must be LiuShiyuMath,
# not liush2yuxjtu. Catches "use liush2yuxjtu, not LiuShiyuMath" style
# regressions where both names appear but the wrong one is the answer.
first_account=$(grep -oi -E -- "(LiuShiyuMath|liush2yuxjtu)" "$OUT" | head -1 | tr 'A-Z' 'a-z')
if [ -n "$first_account" ] && [ "$first_account" != "liushiyumath" ]; then
    misses=$((misses + 1))
    missing_list+=("first account-name reference is '$first_account' — wrong account presented as the answer")
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
