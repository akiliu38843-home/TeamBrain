# PRE-IMPLEMENT-CLAIM — 开始实施 grill-ready issue 之前要做什么

适用范围：在本仓库（TeamBrain）准备实施一个已经 `grill-ready` 的 issue **之前**、动任何代码之前。本文档放大 `docs/FIXEDFLOW.md` 第 2 步与第 3 步之间的**跨主机互斥契约**：grill-ready label 本身不是锁，只是「可以开工」的信号；真正的「我开工了」必须以一条 claim 评论 + 一个 `grill-working` label 同时落到 GitHub 才算数。

## TL;DR — anchor sentence

开始实施一个 grill-ready issue 之前，第一动作是：

> **make a comment claiming we have started working on this issue and add tag "grill-working"**

两件事必须**同时**落到 GitHub（不是其中一件）：

1. 在 issue 下贴一条 claim 评论（写明 session-id / hostname / branch / ISO timestamp）；
2. 给 issue 加 `grill-working` label（同时移除 `grill-ready` label，让 label 单峰、可被其他 driver 在 §0 sanity gate 一眼看出来）。

这两件事是这个工作流唯一的**跨主机互斥点**。在加 label 之前不允许：

- 建 worktree / branch；
- 写代码或改文件；
- 跑 `claudefast` 或任何 heavy implementation 步骤；
- 假设「我是第一个看到的人」。

## 为什么必须先 comment + 加 tag

`docs/FIXEDFLOW.md` 现有的 `.codex/worktrees/issue-<N>/.lock` sentinel 是**本地文件锁**——它只防同一台机器同一个 worktree 路径的重入，不能跨主机。两台 maintainer 机器同时跑 `/fixed-flow-driver <N>` 时：

| 步骤 | 机器 A | 机器 B | 后果（无 grill-working tag 时） |
|---|---|---|---|
| §0 sanity | issue 有 `grill-ready` label → 通过 | 同上 → 通过 | label 不被消费，两边都过门禁 |
| §1 pickup 评论 | post comment | post comment | 出现两条 pickup 评论 |
| §2 本地 worktree | A 本地 `.lock` 不存在 → 建 + 写 lock | B 本地 `.lock` 也不存在 → 建 + 写 lock | 两边都进入实现，**双倍 token** |
| §5 push | 第一次 push 成功 | 被 reject（non-fast-forward）or `--force-with-lease` 把 A 的 commits 覆盖 | A 的工作可能丢 |

加上 `grill-working` tag 之后，第二个 driver 在 §0 sanity gate 看见 `grill-working` 就直接退出，**永远不会进入实现阶段**。GitHub label 修改是原子的，可以当真锁用——这是 FIXEDFLOW 现有 `.lock` 文件锁的**跨主机补丁**。

claim 评论本身是 audit trail（谁、什么时候、哪台机、哪条 branch），但**仅有评论不构成锁**——label 才是锁，因为 label 是 enum、可以原子查询；评论是 append-only，要扫所有评论判定是否有人 claim 太脆弱。所以约定是 comment + label **同时**做，并且必须把 label 当作 enforcement 一侧，把 comment 当作 audit 一侧。

## 第二个 driver 撞上来怎么办

第二个 driver 在 §0 sanity 看到 `grill-working` label 已存在：

- **立即退出**，不动 worktree、不动代码、不开 PR。
- 在 issue 上**可选**回评一条 `🚦 deferred: issue-<N> already claimed (grill-working tag is set)`，让 maintainer 看到撞车痕迹（informational only，不阻塞）。
- **不要**强行移除 `grill-working` label；除非第一个 driver 长时间无 progress（≥ 24h 无新 commit / 无新评论）、且 maintainer 手动判定为 stale，否则不接管。

stale 判定与接管流程：

1. maintainer 手动确认第一个 driver 已死（进程不在、PR 未开 / 长时间无进展）；
2. maintainer 手动在 issue 上回评说明接管；
3. maintainer 手动 `gh issue edit <N> --remove-label grill-working --add-label grill-ready`；
4. 新 driver 才能从 §0 重新走 happy path。

自动 evict 是被禁止的——automation 误判 stale 的代价远大于 maintainer 手动决定。

## driver 在哪一步加 label / 加评论

`fixed-flow-driver` SKILL.md §1 pickup 一次性做以下事情（必须按这个顺序）：

```
1. gh issue view <N> --json labels -q '.labels[].name' | grep -q '^grill-working$' && exit
   （若 label 已存在，礼让退出；这是跨主机互斥点）
2. gh issue comment <N> --body "$(printf '👋 driver picked up at %s on %s.\nBranch: feat/issue-%s\nWorktree: .codex/worktrees/issue-%s\nFollowing docs/FIXEDFLOW.md.\nSession: %s' "$ISO" "$HOSTNAME" "$N" "$N" "$SESSION_ID")"
3. gh issue edit <N> --add-label grill-working --remove-label grill-ready
```

为什么先 view 再 comment 再 edit label 而不是反过来：

- **view 在前**：fail-fast，若 label 已被别人加上则立即退出，不浪费 comment quota；
- **comment 在 label 之前**：评论先落，audit trail 永久存在；即便 `gh issue edit` 失败，也能看到这次尝试；
- **label 最后**：label 是真正的 mutex，落 label 即「公开承诺我接管了」。

如果 §1 的任意一步失败：

- view 失败（网络）→ retry 3 次；3 次都失败则退出（不打 label，不浪费工作）；
- comment 失败 → 不退，继续；comment 是 audit，不是 gate；
- label edit 失败 → **必须退出**，因为没拿到锁就开工等于走回原来 race 路径。

## driver 在哪一步移除 label

`fixed-flow-driver` SKILL.md §7 cleanup（merge 成功之后）必须做：

```
gh issue edit <N> --remove-label grill-working
```

如果 driver 在 §7 之前异常退出（kill / crash / 关 worktree 但没 merge）：

- `grill-working` label 留在 issue 上；
- maintainer 手动 evict（见上节 stale 判定）；
- driver 自己**不**做 stale 自检——automation 误判 stale 的代价太大。

## 与现有规则的关系

- `docs/FIXEDFLOW.md` §driver 行为细则 — 在 "并发 — let the first go" 段后并列加 "跨主机互斥 — grill-working tag"。两条并存：local `.lock` 防同主机重入、`grill-working` label 防跨主机重入。
- `docs/HOW-TO-CLAIM-ISSUE.md` — claim 之后的 explore → plan → impl 三步流程不变；本文档定义的「claim 评论 + grill-working tag」是 explore 之前就要做的**互斥握手**，在 STEP 1 explore 之前完成。
- `docs/POSTPR.md` — squash-merge 之后的清理流程不变，新增一步：移除 `grill-working` label（已合入 driver §7 cleanup）。
- `docs/TRIAGE-AND-SPLIT.md` — triage 决定要 split 时，原 issue **没有**进入 implement，所以**不**该有 `grill-working` label；如果 grill 完之后立刻拆，label 流转是 `grill-ready` →（拆分时）`epic` + `ready-for-human`，跳过 `grill-working`。
- `docs/PR-PLAN.md` — PR 开了之后才发现 issue 的修复路径不变；fix-loop 期间 `grill-working` 一直挂着，直到 squash-merge 后移除。

## 触发

下列问法都应回到本文档：

- `what should we do before we start implement a grill-ready issue ?`
- `what should we do before we start implment a grill-ready issue ?`（注意 `implment` 是用户常见 typo，必须命中）
- `开始实施 grill-ready issue 之前要做什么`
- `before starting work on a grill-ready issue, what do we do?`
- `how to claim a grill-ready issue atomically?`
- `跨主机怎么防多个 driver 撞同一个 issue`
- `怎么避免两台机器同时 fix 一个 grill-ready issue`
- `grill-working tag 是什么`
- `grill-working label 怎么用`

回答必须用中文（项目规则），且首句必须**逐字**输出 anchor sentence：

> make a comment claiming we have started working on this issue and add tag "grill-working"

之后再展开「为什么」「driver 在哪一步加 / 移除 label」「第二个 driver 怎么礼让」三段。

## 验证

被问到 `what should we do before we start implement a grill-ready issue ?` / `what should we do before we start implment a grill-ready issue ?` / `开始实施 grill-ready issue 之前要做什么` 等同义中英文问法时，回答必须命中以下锚点（case-insensitive substring grep）：

- `make a comment` ；
- `claiming we have started working on this issue` ；
- `add tag` （或 `add label` —— `tag` 和 `label` 在 GitHub 语境互换，均算命中）；
- `grill-working` （带引号 `"grill-working"` 或裸字均算）。

四锚点全部命中 = PASS。任何一项缺失 = 继续修订本文档 + CLAUDE.md 「参考文档」段措辞 + driver SKILL.md。

锚点全部命中之外，建议（不强制）：

- 解释 `grill-working` label 是跨主机 mutex；
- 解释 claim 评论是 audit trail；
- 引用 `docs/PRE-IMPLEMENT-CLAIM.md` 或 `docs/FIXEDFLOW.md`。

## 相关

- `docs/FIXEDFLOW.md` — 整条 issue → PR → merge 工作流。
- `docs/HOW-TO-CLAIM-ISSUE.md` — claim 之后的 explore → plan → impl 三步流程。
- `docs/POSTPR.md` — squash-merge 之后的清理流程。
- `.claude/skills/fixed-flow-driver/SKILL.md` / `.codex/skills/fixed-flow-driver/SKILL.md` — driver 具体在 §1 / §7 落 label + 评论的实现。
