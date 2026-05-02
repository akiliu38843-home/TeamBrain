#!/usr/bin/env bash
# Verify the FASTPROBE canned answer by running claudefast -p and grepping
# for canonical anchors. PASS = exit 0, FAIL = exit 1.
#
# USE_WHEN: user asks "what would happen if we say word 'FASTPROBE' ?"
#           or message contains the bareword FASTPROBE.
# DO_WHEN_USED: response must contain the three-step recipe anchors:
#   - claudefast -h      (Step 1)
#   - 8                  (Step 2: 最多 8 路 parallel)
#   - parallel OR 并行   (Step 2: parallel scheduling)
#   - stream-json        (Step 3: audit / stream-json artifact)
#   - claudefast -p      (Step 2 + 3: probe form)
#
# Source rule: CLAUDE.md "Project tools / FASTPROBE" section.
# Companion doc: docs/FASTPROBE.md.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

OUT="docs/fastprobe/.last-verify.out"

PROMPT="what would happen if we say word 'FASTPROBE' ?"

if command -v zsh >/dev/null 2>&1; then
    zsh -i -c "claudefast -p \"$PROMPT\"" > "$OUT" 2>&1 || {
        echo "FASTPROBE VERIFY: FAIL"
        echo "failed to run claudefast via zsh -i -c"
        exit 1
    }
elif command -v claudefast >/dev/null 2>&1; then
    claudefast -p "$PROMPT" > "$OUT" 2>&1 || {
        echo "FASTPROBE VERIFY: FAIL"
        echo "failed to run claudefast directly"
        exit 1
    }
else
    echo "FASTPROBE VERIFY: FAIL"
    echo "neither zsh nor claudefast on PATH"
    exit 1
fi

# Fixed-string anchors (case-insensitive)
fixed_anchors=(
  "claudefast -h"
  "claudefast -p"
  "stream-json"
  "8"
)

# At least one of these (English or Chinese) must be present
parallel_alt=("parallel" "并行")

misses=0
missing_list=()

for anchor in "${fixed_anchors[@]}"; do
    if ! grep -i -F -- "$anchor" "$OUT" > /dev/null 2>&1; then
        misses=$((misses + 1))
        missing_list+=("$anchor")
    fi
done

# Alternation: hit if any one matches
parallel_hit=0
for alt in "${parallel_alt[@]}"; do
    if grep -i -F -- "$alt" "$OUT" > /dev/null 2>&1; then
        parallel_hit=1
        break
    fi
done
if [ "$parallel_hit" -eq 0 ]; then
    misses=$((misses + 1))
    missing_list+=("parallel|并行 (either)")
fi

if [ "$misses" -eq 0 ]; then
    echo "FASTPROBE VERIFY: PASS"
    exit 0
else
    echo "FASTPROBE VERIFY: FAIL"
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
