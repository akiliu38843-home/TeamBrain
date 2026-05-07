```
   ╔══════════════════════════════════════════════════════════╗
   ║         postinstall ≤ 30s · two-stage install            ║
   ╠══════════════════════════════════════════════════════════╣
   ║  npm install -g <tar>                                    ║
   ║      ├─ Stage1: doctor ‖ install-user-hook   ~1–3s       ║
   ║      ├─ Stage2: spawn detached warmup        <50 ms      ║
   ║      │     └→ background pid → ~/.teamagent/.warmup-     ║
   ║      │        state.json (downloading→ready)             ║
   ║      └─ Stage3: update-state init            <10 ms      ║
   ║  shell prompt returns ≤ 30s ✅                            ║
   ╚══════════════════════════════════════════════════════════╝
```

# plan — fix-install · postinstall ≤ 30s

> 跟 `docs/HOWTO-PLAN-PR.md`、`docs/PR-PLAN.md`、DUCKPLAN 三段铁律对齐。

---

## 1. task description（做什么 / 怎么做 / 不做什么）

**做什么**：把 `packages/teamagent/postinstall.mjs` Stage 2 从「同步等 ~120 MB 模型下载」切到「detached + writeInitialPlaceholder」，与 `packages/cli/src/commands/init.ts:589 spawnDetachedWarmup` 同款实现。让 `npm install -g <tarball>` wall-clock 进 30 秒。

**怎么做**：
1. 在 `postinstall.mjs` inline 写 placeholder（`postinstall.mjs` 是 standalone，不能 `import` `warmup-state.ts`，复制 schema 写入逻辑：`status: "downloading"`, `started_at: ISO`, `pid: 0`, `model: "Xenova/multilingual-e5-small"`，atomic `tmp + rename`）。
2. 替换 Stage 2 的 `await spawnWithTimeout(... 'warmup' ..., 300_000)` 为 `spawn(..., { detached: true, stdio: ['ignore', logFd, logFd] }) ; child.unref()`，log 落在 `~/.teamagent/warmup.log`。
3. 新增 `TEAMAGENT_FOREGROUND_WARMUP=1` opt-in：保留旧的同步路径作 escape hatch。
4. 更新 banner 文案：从「向量模型已预热」改成「向量模型: 后台下载中（约 10 分钟）；期间使用 substring fallback 匹配」。`TEAMAGENT_SKIP_WARMUP=1` 文案不变。
5. 更新 `docs/adr/0001-two-stage-install.md` Status `proposed → accepted`，加 implementation pointer。

**不做什么**：
- 不动 `init.ts` / `warmup-state.ts` / `bin-pre-tool-use` 既有 detached 路径（已 OK）。
- 不换模型、不 lazy-on-first-use、不默认 `SKIP_WARMUP`。
- 不迁移 worktree 位置（违规但已存在；report.md flag）。
- 不改 `release/install.sh`（postinstall 是 npm 自动跑，install.sh 不归它管）。

## 2. expected outputs（可验收交付物）

- 修改 `packages/teamagent/postinstall.mjs`（detached spawn + inline placeholder + 新 banner 文案 + `TEAMAGENT_FOREGROUND_WARMUP` 分支）。
- 修改 `docs/adr/0001-two-stage-install.md` Status accepted + implementation pointer (`packages/teamagent/postinstall.mjs` + `packages/cli/src/commands/init.ts`).
- 新增 `packages/teamagent/__tests__/postinstall.test.mjs`（或既有 test 套件追加）：
  - Stage 2 detached spawn 调用 `spawn(... { detached: true })` + `child.unref()`。
  - placeholder state file 写出后 `readWarmupState` 能解析（模拟跑一次，断言 `~/.teamagent/.warmup-state.json` 存在 + `status === "downloading"` + `pid === 0`）。
  - `TEAMAGENT_FOREGROUND_WARMUP=1` 触发同步路径。
  - `TEAMAGENT_SKIP_WARMUP=1` 既有行为不变。
- `docs/plans/2026-05-07-fix-install/{research,plan,report}.md` 全套 trio。
- atomic commit `feat(install): detach postinstall warmup so install returns in ≤30s` + `Refs ADR 0001`。
- `pnpm typecheck` + `pnpm test` 全绿。

## 3. how-to-eval-from-3rd-party-harness（judge harness + LLM judge from raw JSON）

不让 postinstall 自己评自己。Judge harness：

```text
.judge/<run_id>/
├── 01-pre.json        baseline: TEAMAGENT_FOREGROUND_WARMUP=1 跑 postinstall 的 wall-clock + exit code
├── 02-detached.json   default 路径: time + exit code + warmup-state.json status/pid 快照
├── 03-skip.json       TEAMAGENT_SKIP_WARMUP=1 路径快照
├── 04-vitest.json     pnpm --filter @teamagent/teamagent test --reporter=json
├── 05-typecheck.json  pnpm typecheck stdout/stderr + exit code
└── evidence/          stdout / stderr / 真实 ~/.teamagent/.warmup-state.json + warmup.log 拷贝
```

固定工具：`/usr/bin/time -p`、`vitest --reporter=json`、`tsc --noEmit`、`stat -f` on state file。harness 读 raw stdout/stderr 写出固定 schema：

```json
{
  "exit_code": 0,
  "metrics": {
    "wallclock_ms_default": 280,
    "wallclock_ms_inline": 612340,
    "wallclock_ms_skip": 95,
    "warmup_state_status": "downloading",
    "warmup_state_pid": "<int>",
    "child_unref_called": true
  },
  "evidence_dir": ".judge/<run_id>/evidence",
  "stdout_path": ".judge/<run_id>/02-detached.stdout"
}
```

LLM judge prompt（独立的 claudefast 跑）：

> 只读 `.judge/<run_id>/*.json` 与 evidence；不要看源代码、不要看本 plan。给出 PASS / FAIL：
> - `wallclock_ms_default ≤ 30000`？
> - `warmup_state_status === "downloading"` 且 state file 真实存在？
> - typecheck/vitest 全绿？
> - inline 路径 still works (exit 0, warmup_state_status 终态 ready/failed 都算 ok)？

通过条件：四问全 PASS。Verifier 命令：

```bash
claudefast -p \
  --output-format stream-json \
  --include-partial-messages \
  --verbose \
  --permission-mode acceptEdits \
  "你是 install-fix judge。读 .judge/<run_id>/*.json + evidence，按 plan §3 四个 PASS 条件逐条裁定，输出 JSON {pass: bool, reasons: string[]}。"
```

## 4. claudefast probes（FASTPROBE 三步固定组合）

并行（最多 8 路），全 `--output-format stream-json --include-partial-messages --verbose`：

1. `claudefast -h` 看当前 flag。
2. `claudefast -p "summarize packages/teamagent/postinstall.mjs after edit"` 拿 diff 摘要。
3. `claudefast -p "summarize docs/adr/0001-two-stage-install.md status section"` 验 ADR 已 flip。
4. `claudefast -p "explain spawnDetachedWarmup contract from packages/cli/src/commands/init.ts"` 对照 init.ts 与 postinstall.mjs detached 一致性。
5. `claudefast -p --debug hooks --debug-file .fastprobe/hooks.debug.log "what would happen if we say POSTPR"` 验 canned-answer 链路没被破坏。

汇总：所有 probe stream-json 落 `.fastprobe/`，给后续 PR review 留 evidence。

## 5. 风险与 rollback

- **风险 1**：detached child 在某些 npm wrapper（yarn / pnpm 全局）下被 reparent 到 init 而不是脱离。`child.unref()` + `detached: true` + `stdio: pipe-to-fd` 这套是 Node 推荐方式，init.ts 同款已生效在 issue #91。回滚：`git revert`。
- **风险 2**：用户期望 install 完模型就 ready。Banner 文案 + ADR + `TEAMAGENT_FOREGROUND_WARMUP=1` 三层告知。
- **风险 3**：worktree 路径违规（`.claude/worktrees/fix-install` 而非 `.codex/worktrees/`）。已在 report 标注；未来 PR 处理。
