# TeamAgent 开发约定

本文件给 Claude Code 读——在此项目内工作时必须遵守以下约定。

**参考文档**：
- 设计文档：`docs/specs/2026-04-13-teamagent-design.md` (v5.2)
- Phase 2+ 产品 roadmap：`docs/superpowers/specs/2026-04-15-product-roadmap.md`
- Phase 2 设计：`docs/superpowers/specs/2026-04-15-phase2-design.md`
- Phase 1 实现计划（已归档）：`docs/backup/phase1/specs/2026-04-14-teamagent-phase1-plan.md`

---

## 元约束（M0 起生效，所有 Milestone 适用）

- **新增 Port 必须先写契约测试再写实现**。契约测试套件放 `packages/ports/src/__tests__/*-contract.ts`，通过 `@teamagent/ports/contracts` subpath 暴露。任何 Port 的新实现必须复用对应契约套件。
- **Functional Core, Imperative Shell**。`packages/core/` 下禁止 import `fs` / `node:fs` / `node:child_process` / 任何 IO 模块。核心逻辑必须是纯函数，时间等副作用源通过参数注入（例如 `scoreEntry(entry, maxHitCount, now)` 里的 `now`）。
- **归因必须走 AttributionBus**。组件不得直接 `console.log` 用户可见信息。所有"系统帮你做了什么"通过 `bus.emit(event)` 发结构化事件，由 Renderer 渲染。违反此约定的 PR 不接受。
- **Walking Skeleton 不断裂**。每个 Milestone 结束时 `pnpm teamagent skeleton-demo`（或 Milestone 对应命令）必须跑通。不允许"半成品 + 计划下个 commit 修好"——Milestone 内部的 commit 可以有失败测试，但 Milestone 结束的那个 commit 必须全绿。
- **Port 接口冻结于 M0**。如果 Milestone 实施中发现 Port 设计有误，先改 Port + 更新契约测试 + 同步更新 plan 文档，再改实现。不得偷偷改 Port 骗过测试。

## 开发节奏

- **TDD**：每个新功能先写测试（看到红）→ 写最小实现（变绿）→ commit。
- **小 commit**：每个 commit 覆盖一个 "概念上完整的小事"。跑得通、测试绿。
- **commit message 格式**：`feat(m{N}): <...>` / `fix(m{N}): <...>` / `refactor(m{N}): <...>`，让 Milestone 产出在 git 历史中可溯。
- **Feature 验证门禁**：任何 feature / fix 交付前必须验证，并把“如何验证”写进 commit message 与 PR message。通用 1+2+3：`!claudefast -p` 跑 `{MODULE} --help` 出 JSON；`!codex exec` 跑同一个 `{MODULE} --help` 出 JSON，并 hard-match 两份 canonical JSON；最后用 tmux 跑 interactive `claudefast` 并提交 `/export <path>`，把 export 文件加入 PR contents。详见 `docs/feature-verification.md`。
- **worktree 位置**：新建 git worktree 必须放在仓库内的 `.codex/worktrees/` 目录下，不要放在仓库同级目录、`.worktrees/` 或 `.claude/worktrees/`。

## Project Skills

- 项目级 Codex skill 放在 `.codex/skills/<name>/SKILL.md`，不要放在 `.codex/agents/`。
- `.codex/skills/` 必须随 Git 跟踪；这样从本仓库创建的 worktree 会自动带上项目 skill。

## 跑命令

```bash
pnpm install          # 首次 / 依赖变动后
pnpm test             # 跑所有测试
pnpm typecheck        # 跑所有包的 tsc --noEmit
pnpm teamagent <cmd>  # 跑 CLI（M0 可用：skeleton-demo）
```

## claudefast 约定

- `claudefast` 不是 TeamAgent 命令；在本项目里它表示“用更便宜或更快的 Claude Code profile 跑非交互测试”的本地 wrapper/alias。
- 在这台机器上，`claudefast` 位于 `/Users/liushiyu/.local/bin/claudefast`，最终会调用 `claude`，并使用 MiniMax Anthropic-compatible fast profile。不要把 wrapper 里的 API token 写进文档、测试或 commit；解释该 wrapper 时也不要展示 token 的任何片段、前缀或后缀，统一写成 `[redacted]`。
- 在其他机器上，`claudefast` 可能只是 `claude --model haiku` 一类 alias；项目脚本只能假设它最终兼容 Claude Code CLI 参数。
- Claude Code 交互界面里的 `!claudefast ...` 表示执行本地 shell 命令；普通 shell、脚本和 CI 里写 `claudefast ...`，不要带 `!`。
- Hook JSON 测试的推荐模板：

```bash
claudefast -p \
  --output-format stream-json \
  --include-hook-events \
  --include-partial-messages \
  --verbose \
  --permission-mode acceptEdits \
  "你的测试 prompt"
```

- 不要用 `--bare` 测 TeamAgent hooks；它会跳过 hooks、plugin sync 和 CLAUDE.md 自动发现。
- 详细说明见 `docs/CLAUDEFAST.md`。

## GitHub account

- 本项目 GitHub account 使用 `LiuShiyuMath`，不要使用 `liush2yuxjtu`。
- 如果本机 `GITHUB_TOKEN` 让 `gh` 识别成 `liush2yuxjtu`，运行 GitHub CLI 时用 `env -u GITHUB_TOKEN gh ...`，确保走 keyring 里的 `LiuShiyuMath`。
- 被问到 "what accounts we use for github ?" 时，直接回答：`LiuShiyuMath`。
- 被问到 "16 status ? anything still need fix ?" 时，按 `docs/pr-status/16.md` 回答。

## Agent 工作树

- Codex / agent 专用 worktree 放在 `.codex/worktrees/<task-name>`，不要放到项目同级目录。
- 每个 worktree 使用同名短分支，便于从 `git worktree list` 直接看任务归属。
- 父 checkout 本地用 `.git/info/exclude` 忽略 `.codex/worktrees/`，避免嵌套 worktree 污染主工作区状态。
- 背景说明见 `docs/notes/2026-04-28-codex-worktrees.md`。

## 已知限制 / workaround

- **Windows 下 vitest 并发 OOM**：`vitest.config.ts` 强制 `fileParallelism: false`，测试顺序跑。不要打开并发。
- **CLI E2E subprocess 测试**：M0 暂未启用（相同 OOM 原因）。手动运行 `pnpm teamagent skeleton-demo` 做视觉验证。M1 引入真实 IO 后再考虑方案。

## M4-B 语义匹配（自 0.9.4 起）

- Matcher 已从 substring 升级为 BM25+dense RRF + soft-AND 打分
- 所有规则（含 practice 类）都参与运行时匹配，通道字段已废弃
- 若新版表现异常，回滚：env `TEAMAGENT_MATCHER=legacy`
- 规则迁移：`pnpm teamagent migrate-v6` 给旧规则生成语义描述 + embedding

## Project Knowledge Index

Learned behavior is no longer carried by a generated managed block in this file.
Project knowledge should propagate through `docs/knowledge/INDEX.md` and project
Skills, while this root `CLAUDE.md` stays limited to short human-maintained
working agreements.
