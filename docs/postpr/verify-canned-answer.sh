#!/usr/bin/env bash
# Verify the POSTPR canned answer by running claudefast -p and grepping
# for canonical anchors. PASS = exit 0, FAIL = exit 1.
#
# Anchors (case-insensitive):
#   - fetch the codex review
#   - chatgpt-codex-connector
#   - pulls/.*comments       (regex anchor — gh api endpoint)
#   - @codex review
#   - silent
#   - loop
#
# All six must be present in the response for PASS.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

OUT="docs/postpr/.last-verify.out"
PROMPT="what we shall do after each PR?"

# Prefer direct claudefast to avoid zsh startup noise (for example starship
# errors) contaminating the verifier output. Fall back to non-interactive zsh
# only when claudefast is not directly on PATH.
if command -v claudefast >/dev/null 2>&1; then
    claudefast -p "$PROMPT" > "$OUT" 2>&1 || {
        echo "POSTPR VERIFY: FAIL"
        echo "failed to run claudefast directly"
        exit 1
    }
elif command -v zsh >/dev/null 2>&1; then
    PROMPT_FOR_CLAUDEFAST="$PROMPT" zsh -c 'claudefast -p "$PROMPT_FOR_CLAUDEFAST"' > "$OUT" 2>&1 || {
        echo "POSTPR VERIFY: FAIL"
        echo "failed to run claudefast via zsh -c"
        exit 1
    }
else
    echo "POSTPR VERIFY: FAIL"
    echo "neither zsh nor claudefast on PATH"
    exit 1
fi

# Fixed-string anchors (case-insensitive)
fixed_anchors=(
  "fetch the codex review"
  "chatgpt-codex-connector"
  "@codex review"
  "silent"
  "loop"
)

# Regex anchors (case-insensitive)
regex_anchors=(
  "pulls/[^[:space:]]*comments"
)

misses=0
missing_list=()

for anchor in "${fixed_anchors[@]}"; do
    if ! grep -i -F -- "$anchor" "$OUT" > /dev/null 2>&1; then
        misses=$((misses + 1))
        missing_list+=("$anchor")
    fi
done

for anchor in "${regex_anchors[@]}"; do
    if ! grep -i -E -- "$anchor" "$OUT" > /dev/null 2>&1; then
        misses=$((misses + 1))
        missing_list+=("$anchor (regex)")
    fi
done

if [ "$misses" -eq 0 ]; then
    echo "POSTPR VERIFY: PASS"
    exit 0
else
    echo "POSTPR VERIFY: FAIL"
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
