#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT_DIR="$ROOT/docs/feature-verify-kit/runs"
mkdir -p "$OUT_DIR"

PROMPT='Read docs/系统展示.md and docs/feature-verification.md. Return ONLY JSON with keys: positioning, metrics, market_gap, delivered_vs_planned, hooks, knowledge_delivery, self_evolution. Each key must be a non-empty string.'
SCHEMA='{"type":"object","properties":{"positioning":{"type":"string","minLength":1},"metrics":{"type":"string","minLength":1},"market_gap":{"type":"string","minLength":1},"delivered_vs_planned":{"type":"string","minLength":1},"hooks":{"type":"string","minLength":1},"knowledge_delivery":{"type":"string","minLength":1},"self_evolution":{"type":"string","minLength":1}},"required":["positioning","metrics","market_gap","delivered_vs_planned","hooks","knowledge_delivery","self_evolution"],"additionalProperties":false}'

claude -h > "$OUT_DIR/claude-help.txt" 2>&1 || true

# Use claudefast wrapper (zsh shell function defined in ~/.zshrc) so this run
# uses CLAUDE_CONFIG_DIR=$HOME/.claude-minimax — isolated from the user's main
# ~/.claude/ config (which may have Stop hooks like laziness-self-report that
# would hijack the JSON-schema response). README of this kit specifies
# claudefast as the entrypoint; this honors that.
zsh -i -c "claudefast -p --model haiku \
  --output-format stream-json \
  --include-hook-events \
  --include-partial-messages \
  --verbose \
  --permission-mode acceptEdits \
  --json-schema $(printf '%q' "$SCHEMA") \
  $(printf '%q' "$PROMPT")" \
  > "$OUT_DIR/claude-stream.jsonl" \
  2> "$OUT_DIR/claude-stream.stderr.log"

node -e '
const fs=require("fs");
const p=process.argv[1];
const out=process.argv[2];
const lines=fs.readFileSync(p,"utf8").split(/\n+/).filter(Boolean);
// Prefer .structured_output (set when --json-schema is used); fall back to
// parsing .result as JSON for older claude CLI versions.
let obj=null;
for(const line of lines){
  try{
    const j=JSON.parse(line);
    if(j && j.type==="result"){
      if(j.structured_output && typeof j.structured_output==="object"){
        obj=j.structured_output;
      } else if(typeof j.result==="string"){
        try{ obj=JSON.parse(j.result); }catch{}
      }
    }
  }catch{}
}
if(!obj) throw new Error("No structured_output or parseable result found in stream-json");
fs.writeFileSync(out, JSON.stringify(obj,null,2));
' "$OUT_DIR/claude-stream.jsonl" "$OUT_DIR/claude-features.json"

echo "Wrote: $OUT_DIR/claude-stream.jsonl"
echo "Wrote: $OUT_DIR/claude-features.json"
