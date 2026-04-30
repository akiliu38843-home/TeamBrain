```
   ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
   │  H0 - 2    │→ │  H2 - 6    │→ │  H6 - 12   │→ │  H12 - 24  │
   │  Frame it  │  │  Skeleton  │  │  Review    │  │  Real run  │
   └────────────┘  └────────────┘  └────────────┘  └────────────┘
                                                          │
   ┌────────────┐  ┌────────────┐  ┌────────────┐         ▼
   │  H60 - 72  │← │  H36 - 60  │← │  H24 - 36  │← ──────┘
   │  Release   │  │  Real run2 │  │  Patch     │
   └────────────┘  └────────────┘  └────────────┘
```

# TeamBrain 72h Light-Speed Bootstrap

72 小时把 TeamBrain 从「空 repo + 一个想法」推进到 v0.1，靠人 + agent 不间断协作完成。

## Day 0 Status (as of 2026-05-01)

**Day 0 / Hour 0 – 2「Frame the problem」阶段：FINISHED ✅**

| 产出 | 状态 | Artifact |
|------|------|----------|
| Mission statement (≤200 字) | ✅ Done | 见下文 *Mission statement* 段 |
| 原始 trap dump | ✅ Done | [../notes/2026-05-01-day0-team-experience-dump.md](../notes/2026-05-01-day0-team-experience-dump.md) — 40 坑 + 10 标准 + 5 失败案例 |
| HTML 快照 | ✅ Done | [2026-05-01-teambrain-72h-bootstrap.html](2026-05-01-teambrain-72h-bootstrap.html) |
| 生成方式 | ✅ Reproducible | 7 路并行 `claudefast -p --output-format stream-json --verbose`（FASTPROBE pattern, see `docs/FASTPROBE.md`），尾部 `<laziness-self-report>` 6 项均 false |

下一阶段：**Hour 2 – 6 / Skeleton parallel build**（尚未启动）。Day 0 work
本身已收敛，可以驱动 Hour 2 – 6 的四 agent 并行骨架构建。

### Mission statement

> TeamBrain 是 agent 团队的**共享经验脑**：把每次踩过的坑、判断标准、失败案例固化成可验证规则，让新 agent / 新人 5 分钟内能避开历史坑、跑通真实任务；不靠口头审、不靠 mock 通过、不靠"我感觉应该这样"。

## Cast & Constraints

- **1 人类 owner**：方向、删废话、补真实失败案例。
- **2 个 Claude Code instances**（Agent A、Agent B）。
- **2 个 Codex instances**（Agent C、Agent D）。
- **1 个 reviewer agent**：审规则、审 mock、审可验证性。
- 所有人不睡觉，连续 72h。

不做的事：
- 不做 UI。
- 不做数据库。
- 只做 Markdown + prompts + scripts。

## Hour 0 – 2 / Frame the problem

**Human**
- 说清楚 TeamBrain 是什么。
- 说清楚它不是给人看的文档站。
- 倒出历史坑（已经踩过的、模糊的规则、被绕过的检查）。

输出：一段 ≤ 200 字的 mission statement + 一份原始 trap dump（粗糙即可，留给 Agent B 整理）。

## Hour 2 – 6 / Skeleton parallel build

四个 agent 并行，每个 agent 一个独立目录，互不阻塞。

| Agent | Stack | Output |
|------|-------|--------|
| Agent A | Claude Code | `repo skeleton` + `README.md` |
| Agent B | Claude Code | `TRAPS.md` + trap 格式约定 |
| Agent C | Codex | `TASK_TEMPLATE.md` + `VERIFY_TEMPLATE.md` |
| Agent D | Codex | `agent_rules/claude.md` + `agent_rules/codex.md` |

收敛点：H6 时 owner 把四份产出 merge 到 `main`，跑一次 `tree`，确认目录结构干净。

## Hour 6 – 12 / Reviewer pass + human cleanup

**Reviewer Agent** 顺序检查：
1. 规则是否空泛 —— 比如「写好代码」「保持简洁」一律拒绝，要求改成 ground-truth 可验。
2. 有没有 mock loophole —— 任何「跳过」「skip if」「allow if no test」必须打上 ⚠️。
3. 每个任务模板是否能 ground-truth verify —— `VERIFY_TEMPLATE.md` 必须给出可执行命令 + 期望输出。

**Human** 跟在 reviewer 之后：
- 删除废话。
- 保留硬规则。
- 补充真实失败案例（H0 trap dump 里挑 3 – 5 条最痛的写进 `TRAPS.md`）。

## Hour 12 – 24 / Real Task #1

让 Claude 与 Codex 读完整 TeamBrain，跑一个真实任务（不是 hello-world，是用户自己今天就想做的活）。

收集：
- 完整对话 transcript。
- 命令输出 evidence。
- 失败点列表 —— TeamBrain 没拦住的错。

## Hour 24 – 36 / Patch the brain

把 Task #1 暴露的问题反向写回去：
- 新失败 → 新 trap（按 `TRAPS.md` 格式）。
- 模糊规则 → 硬规则（带可执行验证）。
- 加 `no-mocking checklist`。
- 加 `evidence checklist`。

收敛点：每条新增规则必须配一个 reproducible failing case（对应 Task #1 的 evidence）。

## Hour 36 – 60 / Real Task #2

换一个任务、换一个 agent（最好换 stack：Task #1 用 Claude，Task #2 用 Codex；反之亦然）。

通过条件：
- Task #1 的错误一个都不再犯。
- 新出现的错误数量 < Task #1。

如果 Task #2 仍把 Task #1 的错重犯一次，回到 H24 – 36 再 patch 一轮，不进入 release。

## Hour 60 – 72 / Release v0.1

- 清理目录（删 scratch、删未引用的 markdown）。
- 写 onboarding flow（新 agent / 新人怎么 5 分钟接入）。
- 写 usage examples（≥ 2 个真实任务的 walkthrough）。
- `git tag v0.1` + push。

## Success Bar

v0.1 被认为合格的硬条件：

1. 一个**没读过任何历史**的新 agent，按 onboarding flow 5 分钟内能跑通一个 task。
2. Task #1 全部失败点都在 `TRAPS.md` 里有对应条目。
3. 每条规则都能用 `VERIFY_TEMPLATE.md` 里描述的命令验证，没有「靠人审」的口头规则。
4. 没有任何「mock 即通过」的 loophole。

## Anti-pattern（在 72h 内必须避免）

- 写 plan.md 时塞「先去读哪些文件」之类的预热脚本。
- 让 agent 自己评价自己产出（必须走 reviewer agent + human）。
- 用 hello-world 当真实任务（Task #1 / #2 必须是 owner 当下真要做的活）。
- 跳过 H6 – 12 的 reviewer pass 直接进入 Real Task #1。
