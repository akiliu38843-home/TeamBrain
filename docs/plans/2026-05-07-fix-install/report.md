```
   ┌──────── report — fix-install · postinstall ≤ 30s ────────┐
   │  status: DONE (pending PR + Codex review)                │
   │  wall-clock default: 0.05–0.06s (was: ~120s+ for warmup) │
   │  ADR 0001: proposed → accepted                           │
   └──────────────────────────────────────────────────────────┘
```

# report — fix-install · postinstall ≤ 30s

## 实际改动

| 文件 | 内容 |
|---|---|
| `packages/teamagent/postinstall.mjs` | Stage 2 同步 `await spawnWithTimeout(... 'warmup' ..., 300_000)` → `spawnDetachedWarmup(binPath)` (写 placeholder + detached + `child.unref()`)。保留 `TEAMAGENT_SKIP_WARMUP=1`，新增 `TEAMAGENT_FOREGROUND_WARMUP=1` 与 `init.ts` 对齐 escape hatch。Banner 文案改为「向量模型: 后台下载中 (~10 分钟); 期间使用 substring fallback (ADR 0001)」。 |
| `docs/adr/0001-two-stage-install.md` | Status `proposed → accepted`，加 implementation pointer（postinstall.mjs / init.ts / warmup-state.ts / bin-pre-tool-use）+ verifier 引用。 |
| `scripts/verify-postinstall-detached.sh` | Judge harness：stub `dist/bin.js`，跑 default / foreground / skip 三条路径，量 wall-clock + state file，结果落 `.judge/<run_id>/*.json` + evidence。 |
| `docs/plans/2026-05-07-fix-install/{research,plan,report}.md` | 三段 plan trio。 |

## Verifier 实测（hermetic, stub bin.js）

```
{"label":"01-default-detached","exit_code":0,"wallclock_s":"0.05","warmup_state_status":"downloading","warmup_state_pid":"0"}
{"label":"02-foreground","exit_code":0,"wallclock_s":"0.07","warmup_state_status":"<absent>","warmup_state_pid":"<absent>"}
{"label":"03-skip","exit_code":0,"wallclock_s":"0.05","warmup_state_status":"<absent>","warmup_state_pid":"<absent>"}
```

- **default 路径**：50ms wall-clock；state file 写入 `status="downloading"`, `pid=0` （placeholder schema 与 `warmup-state.ts:writeInitialPlaceholder` 一致）。✅
- **foreground 路径**：70ms（stub `bin.js` exits 0 immediately；real install 仍是 ~5–10 分钟下载，符合 escape-hatch 语义）。✅
- **skip 路径**：50ms，不写 state file（`bin-pre-tool-use` reader 看到 missing → 直接走 substring fallback）。✅

## 实际 install 总时间预估

| 阶段 | 当前（detached） | 之前（同步） |
|---|---|---|
| `npm install -g <tarball>` 下载 + 解压 + deps | ~5–15s | ~5–15s |
| postinstall Stage 1 doctor + hook（并行）| ~1–3s | ~1–3s |
| **postinstall Stage 2 warmup** | **<100ms** | ~120s（首装；网络慢甚至 timeout 300s） |
| postinstall Stage 3 update-state | <10ms | <10ms |
| **总 wall-clock** | **~6–18s（≤30s 预算）** | **~125s+** |

ADR 0001 的「30-second-hook landing copy promise」满足。

## 副作用与回归

- `bin-pre-tool-use` 在 `status !== "ready"` 时回退 legacy substring matcher（既有逻辑，issue #91 实现）；未来 ~10 分钟 detached child 跑完 warmup 后写 `status="ready"`，下一次进程启动自动升级到 BM25+dense RRF。
- `seed/packs/universal.jsonl` 已经使用 substring-friendly patterns（ADR 0001 consequences §2 要求），detached 期间 substring matcher 命中率不受影响。
- env var 与 `init.ts` 对齐为 `TEAMAGENT_FOREGROUND_WARMUP=1`（避免引入新名字 `TEAMAGENT_INLINE_WARMUP`）；`TEAMAGENT_SKIP_WARMUP=1` 行为不变。
- postinstall.mjs 仍是 standalone（不 import 任何内部包），符合该文件 file-level 注释约束。

## 未做 / 已 flag

| 项 | 原因 | 后续 |
|---|---|---|
| `pnpm typecheck` / `pnpm test` | 改的全是 `.mjs` 与 `.md` / `.sh`；无 TS 文件改动；fresh worktree 没 `node_modules`，pnpm install 会触发 postinstall 自身（递归测自己） | 用户合并到 main 后 CI 会自动跑 |
| 真实 npm install 端到端 timing 实测 | 需要 build dist + npm pack + npm install -g 全链；本 PR 只动 postinstall.mjs，hermetic verifier 已覆盖 spawn 行为 | 可以在合并后用 `release-prep/install.sh.draft` 做真实 e2e |
| Worktree 路径迁移 `.claude/worktrees/fix-install` → `.codex/worktrees/fix-install` | `CLAUDE.md` 「worktree 位置」段约束新建 worktree 必须放 `.codex/worktrees/`；本 worktree 已存在，迁移不属本 PR scope | 单独 housekeeping PR |

## Commit 计划

```
feat(install): detach postinstall warmup so install returns in ≤30s

postinstall.mjs Stage 2 used to await `bin warmup` synchronously with a
300s timeout, which made `npm install -g <tarball>` block on a ~120MB
HuggingFace download (5–10 minutes typical, longer on slow networks).
Switch to detached spawn + writeInitialPlaceholder, mirroring
packages/cli/src/commands/init.ts:589 spawnDetachedWarmup. The legacy
foreground path is preserved behind TEAMAGENT_FOREGROUND_WARMUP=1
(unified with init.ts; replaces a brief TEAMAGENT_INLINE_WARMUP draft).

Wall-clock (hermetic verifier scripts/verify-postinstall-detached.sh,
stub bin.js):
  default detached:  0.05s   (was: 120s+ for warmup)
  foreground escape: 0.07s   (stub; real warmup still 5–10min)
  skip:              0.05s

Refs ADR 0001 (status flipped proposed → accepted in this commit).
```

## 验证方式（写入 commit + PR message）

1. `bash scripts/verify-postinstall-detached.sh` — 三路径全 exit 0、default wall-clock <30s、state file `status="downloading"` `pid=0`。
2. `claudefast -p "summarize packages/teamagent/postinstall.mjs after edit; was it switched from sync warmup to detached?"` — semantic 校验改动方向正确。
3. `codex exec --skip-git-repo-check -s read-only "summarize ADR 0001 status section"` — 验 ADR 已 flip accepted。
4. tmux `claudefast` interactive `/export <path>` — 留一份会话 export 进 PR。
