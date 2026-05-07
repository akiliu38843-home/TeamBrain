#!/usr/bin/env bash
# verify-real-install-30s.sh — judge harness for real-world install <=30s.
#
# Builds + npm-packs teamagent, then runs `npm install -g` against an isolated
# --prefix and --cache directory (so the user's global npm setup is untouched).
# Measures wall-clock for three paths so we can attribute time:
#   01-skip       TEAMAGENT_SKIP_WARMUP=1   pure npm work (no postinstall warmup branch)
#   02-detached   default                   ADR 0001 path (Stage 2 detached)
#   03-foreground TEAMAGENT_FOREGROUND_WARMUP=1  legacy sync warmup (escape hatch)
#
# 03-foreground takes ~5-10min on first run because it actually pulls the
# 120MB Xenova model. Pass SKIP_FOREGROUND=1 to drop it from the run.
set -eu
cd "$(dirname "$0")/.."

WORKTREE=$(pwd)
RUN_ID="${RUN_ID:-real-$(date +%s)}"
JUDGE_DIR=".judge/${RUN_ID}"
EVIDENCE_DIR="${JUDGE_DIR}/evidence"
mkdir -p "${EVIDENCE_DIR}"

PKG_DIR="${WORKTREE}/packages/teamagent"
TGZ=$(ls "${PKG_DIR}"/teamagent-*.tgz 2>/dev/null | head -1 || true)
if [ -z "${TGZ}" ] || [ ! -f "${TGZ}" ]; then
  echo "FATAL: no tarball; run 'cd packages/teamagent && npm pack' first" >&2
  exit 1
fi
TGZ_SIZE=$(stat -f%z "${TGZ}" 2>/dev/null || stat -c%s "${TGZ}")
echo "tarball: ${TGZ} (${TGZ_SIZE} bytes)"

run_install() {
  local label="$1"; shift
  local pref
  local cach
  local home
  pref=$(mktemp -d -t "ta-pre-${label}-XXXX")
  cach=$(mktemp -d -t "ta-cache-${label}-XXXX")
  home=$(mktemp -d -t "ta-home-${label}-XXXX")
  local out="${EVIDENCE_DIR}/${label}.out"
  local timing="${EVIDENCE_DIR}/${label}.time"
  local statefile="${home}/.teamagent/.warmup-state.json"
  local exit_code=0

  echo ">>> ${label}: prefix=${pref} cache=${cach} home=${home}" | tee -a "${EVIDENCE_DIR}/run.log"
  HOME="${home}" "$@" \
    /usr/bin/time -p npm install -g \
      --prefix="${pref}" \
      --cache="${cach}" \
      "${TGZ}" \
    >"${out}" 2>"${timing}.raw" || exit_code=$?

  awk '/^real |^user |^sys /{print > "/dev/stderr"; next} {print}' "${timing}.raw" 2>"${timing}" 1>>"${out}"
  rm -f "${timing}.raw"

  local wall_s
  wall_s=$(awk '/^real /{print $2}' "${timing}" | head -1)
  local user_s
  user_s=$(awk '/^user /{print $2}' "${timing}" | head -1)
  local sys_s
  sys_s=$(awk '/^sys /{print $2}' "${timing}" | head -1)

  local state_status="<absent>"
  local state_pid="<absent>"
  if [ -f "${statefile}" ]; then
    state_status=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('${statefile}','utf8')).status)}catch(e){console.log('<parse-err>')}" 2>/dev/null || echo "<parse-err>")
    state_pid=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('${statefile}','utf8')).pid)}catch(e){console.log('<parse-err>')}" 2>/dev/null || echo "<parse-err>")
    cp "${statefile}" "${EVIDENCE_DIR}/${label}.warmup-state.json"
  fi

  cat > "${JUDGE_DIR}/${label}.json" <<JSON_EOF
{
  "label": "${label}",
  "exit_code": ${exit_code},
  "wallclock_s": "${wall_s:-null}",
  "user_s": "${user_s:-null}",
  "sys_s": "${sys_s:-null}",
  "warmup_state_status": "${state_status}",
  "warmup_state_pid": "${state_pid}",
  "tarball_size_bytes": ${TGZ_SIZE},
  "stdout_path": "${EVIDENCE_DIR}/${label}.out",
  "timing_path": "${EVIDENCE_DIR}/${label}.time"
}
JSON_EOF

  rm -rf "${pref}" "${cach}" "${home}"
}

# 01: SKIP_WARMUP baseline — pure npm work + Stage1+3 only
run_install "01-skip" env TEAMAGENT_SKIP_WARMUP=1

# 02: default detached — ADR 0001 path
run_install "02-detached" env

# 03: foreground (skip by default — would actually download 120MB; opt in via env)
if [ "${SKIP_FOREGROUND:-1}" != "1" ]; then
  run_install "03-foreground" env TEAMAGENT_FOREGROUND_WARMUP=1
fi

# Summary
printf '\n=== verify-real-install-30s run %s ===\n' "${RUN_ID}"
for f in "${JUDGE_DIR}"/*.json; do
  node -e "const j=require('${WORKTREE}/${f}'); console.log(JSON.stringify(j))"
done
echo "evidence dir: ${EVIDENCE_DIR}"
