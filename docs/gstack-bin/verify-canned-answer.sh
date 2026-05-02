#!/usr/bin/env bash
# Verify the "gstack skills / brain sync bin path" canned answer by running
# claudefast -p and grepping for canonical anchors. PASS = exit 0, FAIL = 1.
#
# USE_WHEN: user asks
#   "gstack skills and brain sync bin — project level or user level ?"
# DO_WHEN_USED: response must say the resolution is "project level" for both
#   gstack skills and the brain sync bin in this repo.
#
# PASS conditions (all):
#   1. "project level" appears (case-insensitive)
#   2. The FIRST occurrence of either "project level" or "user level" in
#      the response is "project level" — i.e. the canonical answer leads,
#      and "user level" only appears later as a contrast or rejection.
#   3. At least one of: .claude/skills, .codex/skills, .claude/, .codex/
#      (referencing where project-level skills/configs live; we accept
#      the short form because the response sometimes elides /skills).
#
# Why disambiguation #2 matters: a regression like "use user level, not
# project level" still mentions both phrases, so a presence-only check
# would falsely PASS. Requiring the first reference be "project level"
# catches this — the canonical CLAUDE.md doc structure ("答 project
# level"; project paths) puts the right phrase first by construction.
# (Codex review on PR #56, follow-up after similar fix on github-account.)
#
# Source rule: CLAUDE.md "Gstack skills 与 brain sync bin 路径" section.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

OUT="docs/gstack-bin/.last-verify.out"

PROMPT="gstack skills and brain sync bin — project level or user level ?"

if command -v zsh >/dev/null 2>&1; then
    zsh -i -c "claudefast -p \"$PROMPT\"" > "$OUT" 2>&1 || {
        echo "GSTACK-BIN VERIFY: FAIL"
        echo "failed to run claudefast via zsh -i -c"
        exit 1
    }
elif command -v claudefast >/dev/null 2>&1; then
    claudefast -p "$PROMPT" > "$OUT" 2>&1 || {
        echo "GSTACK-BIN VERIFY: FAIL"
        echo "failed to run claudefast directly"
        exit 1
    }
else
    echo "GSTACK-BIN VERIFY: FAIL"
    echo "neither zsh nor claudefast on PATH"
    exit 1
fi

misses=0
missing_list=()

# Required anchor — the answer phrase must appear
if ! grep -i -F -- "project level" "$OUT" > /dev/null 2>&1; then
    misses=$((misses + 1))
    missing_list+=("project level (required)")
fi

# Disambiguation — the first occurrence of either "project level" or
# "user level" must be "project level". Catches "use user level, not
# project level" style regressions where both phrases appear but the
# wrong one is the answer.
first_level=$(grep -oi -E -- "(project level|user level)" "$OUT" | head -1 | tr 'A-Z' 'a-z')
if [ -n "$first_level" ] && [ "$first_level" != "project level" ]; then
    misses=$((misses + 1))
    missing_list+=("first level reference is '$first_level' — wrong scope presented as the answer")
fi

# At least one of the install-path anchors must be present.
# Order: prefer the longer form; fall back to bare directory mention.
path_alt=(".claude/skills" ".codex/skills" ".claude/" ".codex/")
path_hit=0
for alt in "${path_alt[@]}"; do
    if grep -i -F -- "$alt" "$OUT" > /dev/null 2>&1; then
        path_hit=1
        break
    fi
done
if [ "$path_hit" -eq 0 ]; then
    misses=$((misses + 1))
    missing_list+=(".claude/skills | .codex/skills | .claude/ | .codex/ (any)")
fi

if [ "$misses" -eq 0 ]; then
    echo "GSTACK-BIN VERIFY: PASS"
    exit 0
else
    echo "GSTACK-BIN VERIFY: FAIL"
    echo "missing anchors:"
    for m in "${missing_list[@]}"; do
        echo "  - $m"
    done
    echo "--- captured output (head -40) ---"
    head -40 "$OUT"
    echo "--- captured output (tail -10) ---"
    tail -10 "$OUT"
    exit 1
fi
