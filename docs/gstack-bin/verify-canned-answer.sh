#!/usr/bin/env bash
# Verify the "gstack skills / brain sync bin path" canned answer by running
# claudefast -p and grepping for canonical anchors. PASS = exit 0, FAIL = 1.
#
# USE_WHEN: user asks
#   "gstack skills and brain sync bin — project level or user level ?"
# DO_WHEN_USED: response must say the resolution is "project level" for both
#   gstack skills and the brain sync bin in this repo.
#
# Anchors (case-insensitive):
#   - project level   (the answer)
#   - one of: .claude/skills, .codex/skills, .claude/, .codex/
#     (referencing where project-level skills/configs live; we accept the
#     short form because the response sometimes elides /skills)
#
# Forbidden as the *answer*: if the response says "user level" without a
#   "project level" override, that is wrong — but we keep the verifier
#   strict-positive only (require "project level"); the rule doc itself
#   handles disambiguation.
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

# Required anchor — the answer
if ! grep -i -F -- "project level" "$OUT" > /dev/null 2>&1; then
    misses=$((misses + 1))
    missing_list+=("project level (required)")
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
