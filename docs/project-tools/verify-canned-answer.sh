#!/usr/bin/env bash
# Verify the "project tools" canned answer by running claudefast -p and
# grepping for canonical anchors. PASS = exit 0, FAIL = exit 1.
#
# USE_WHEN: user asks "what project tools we have ?"
# DO_WHEN_USED: response must list the project tool registry, in particular
#   FASTPROBE must appear (the rule explicitly requires it). Other strong
#   signals tie the answer to this repo's actual tool set.
#
# Anchors (case-insensitive):
#   - FASTPROBE          (mandatory per CLAUDE.md "Project tools / FASTPROBE")
#   - claudefast         (canonical CLI wrapper)
#   - DOGFOOD            (live agent dev loop entry)
#   - POSTPR             (post-PR Codex check entry)
#   - BUGREPORT          (bug report entry)
#   - RULE-VERIFY        (rule verification harness — added with this skill)
#
# Source rule: CLAUDE.md "Project tools / FASTPROBE" section.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

OUT="docs/project-tools/.last-verify.out"

PROMPT="what project tools we have ?"

if command -v zsh >/dev/null 2>&1; then
    zsh -i -c "claudefast -p \"$PROMPT\"" > "$OUT" 2>&1 || {
        echo "PROJECT-TOOLS VERIFY: FAIL"
        echo "failed to run claudefast via zsh -i -c"
        exit 1
    }
elif command -v claudefast >/dev/null 2>&1; then
    claudefast -p "$PROMPT" > "$OUT" 2>&1 || {
        echo "PROJECT-TOOLS VERIFY: FAIL"
        echo "failed to run claudefast directly"
        exit 1
    }
else
    echo "PROJECT-TOOLS VERIFY: FAIL"
    echo "neither zsh nor claudefast on PATH"
    exit 1
fi

anchors=(
  "FASTPROBE"
  "claudefast"
  "DOGFOOD"
  "POSTPR"
  "BUGREPORT"
  "RULE-VERIFY"
)

misses=0
missing_list=()

for anchor in "${anchors[@]}"; do
    if ! grep -i -F -- "$anchor" "$OUT" > /dev/null 2>&1; then
        misses=$((misses + 1))
        missing_list+=("$anchor")
    fi
done

if [ "$misses" -eq 0 ]; then
    echo "PROJECT-TOOLS VERIFY: PASS"
    exit 0
else
    echo "PROJECT-TOOLS VERIFY: FAIL"
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
