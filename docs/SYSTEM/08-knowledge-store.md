```text
   ┌──────────────────────────────────────────────────────────────┐
   │  Knowledge store — physical layout vs scope routing          │
   │                                                              │
   │   personal ──→  <cwd>/.teamagent/knowledge.db                │
   │   global   ──→  ~/.teamagent/global.db                       │
   │   team     ─×→  THROW (Phase 4 — git-synced .mdc)            │
   │                                                              │
   │   write router:  DualLayerStore.add(entry) {                 │
   │     switch (entry.scope.level) ...                           │
   │   }                                                          │
   │   read router:   PreToolUse Promise.all([P, T, G])           │
   │                  T retriever runs but T DB has 0 rows        │
   └──────────────────────────────────────────────────────────────┘
```

# TeamAgent 系统技术文档: 8. 知识库设计

Source index: [SYSTEM.md](../SYSTEM.md)

## 8. 知识库设计

### 数据库 Schema 简述

`knowledge.db`（和 `global.db`）包含以下主要表：

**`knowledge` 表（核心）**

| 列 | 类型 | 说明 |
|----|------|------|
| id | TEXT PK | 唯一标识 |
| scope_level | TEXT | personal/team/global（CHECK 约束） |
| category | TEXT | C/E/S/K |
| current_tier | TEXT | experimental/.../enforced/dormant |
| confidence | REAL | 0.0~1.0 |
| demerit | REAL | 累计扣分（指数衰减） |
| enforcement | TEXT | block/warn/suggest/passive |
| status | TEXT | active/conflict/stale/archived/dormant |
| hit_count | INTEGER | 被命中次数 |
| override_count | INTEGER | 被绕过次数 |

**`wiki_meta` 表（Wiki 专用）**

关联 `knowledge.id`，额外存储 `source_url`、`source_type`、`tldr`、`keywords`、`user_thumbs_down`、`inline_injection_count` 等 Wiki 专属字段。

**`events` 表（事件日志，append-only）**

存储所有 hook 命中事件（kind 如 `hook-pre.matched`、`hook-post.result`），供 Calibrator 读取用于置信度更新。

**`observations` 表**

Calibrator V2 用，存储 `(knowledge_id, outcome=success|failure)` 细粒度观察记录，供 Wilson Score 算法计算置信区间。

**`rule_candidates` 表**

`scan-errors` 命令生成的候选规则，status=pending，等待 `review-candidates` 命令人工审核。

完整 DDL：`packages/adapters/src/storage/sqlite/schema.ts:19`，`scope_level CHECK IN ('personal','team','global')` 在 `:24`，`idx_knowledge_scope` 在 `:67`。

### Scope 路由（personal / team / global）

`DualLayerStore` 是双层物理存储（仅两个 sqlite 文件），但 schema 预留了三个 `scope.level` 槽位，方便 Phase 4 接入 team-level 同步而无需迁移。

| `scope.level` | 写路径 | 读路径 | 物理介质 | 状态 |
|---------------|--------|--------|----------|------|
| `personal` | `DualLayerStore.add → project.add` → 项目 DB | `findActive()` 项目 DB 优先返回 | `<cwd>/.teamagent/knowledge.db` | ✅ |
| `global` | `DualLayerStore.add → global.add` → 全局 DB | `findActive()` 项目 DB 后跟全局 DB | `~/.teamagent/global.db` | ✅ |
| `team` | **`throw new Error("...not supported until Phase 4")`** | PreToolUse 三路并发会查（恒空），`review --scope=team` 映射到 `personal` | git-tracked `.teamagent/rules/*.mdc`（未实现） | ❌ Phase 4 |

**写路径源**：`packages/adapters/src/storage/sqlite/dual-layer-store.ts:26-38` —
```ts
switch (entry.scope.level) {
  case "personal": this.project.add(entry); return;
  case "global":   this.global.add(entry); return;
  case "team":     throw new Error("team-scoped entries are not supported until Phase 4");
}
```

**读路径源**：`packages/cli/src/bin-pre-tool-use.ts:112-140` 用 `Promise.all` 并发查 personal + team + global 三路（team retriever 实际跑但永远返回空集，因为 team 写不进 DB）；`packages/cli/src/commands/review.ts:44-46` 把 `--scope=team` 静默映射成 `personal`（v2 行为）。

### 隐私边界（当前实现）

只有两道真墙 + 一道占位虚墙：

```
   personal write ──→ project DB only ──→ 永远不离开 <cwd>/.teamagent/
   global   write ──→ global DB only  ──→ 永远不离开 ~/.teamagent/
   team     write ──→ THROWS Error    ──→ 还没物理介质（Phase 4 = git PR）
```

「routing IS the privacy boundary」是 design intent；Phase 4 之前 team 槽是占位符，机器之间不共享 TeamAgent 学习。

### Phase 4 计划摘要

`docs/superpowers/plans/2026-05-01-phase4-team-memory-plan.md` 是 14 天 ship 计划，关键任务：

- T1：MDC codec（`.teamagent/rules/*.mdc`）+ git-sync transport（`teamagent sync pull/push`）
- T2：多解并列模型 `problem_cluster_id` + `variant_id`，告别 v2 单行 entry
- T3：PII redactor + pre-commit hook 拦截外泄
- T4：promote / dislike 工作流（个人 → team 提案）
- T6：SessionStart 自动 pull + import；`teamagent export / import`
- 团队验收 gate

详细字段、API、降级路径见上述 plan。

### confidence 计算

v2 系统使用 **Wilson Score 置信区间**（`packages/core/src/calibrator/v2/wilson.ts`）替代简单增减：

```
wilson_lower = (successes + z²/2) / (total + z²) - z × √(successes×failures/total + z²/4) / (total + z²)
```

其中 z=1.645（90% 置信区间），successes/failures 来自 `observations` 表。这比直接 ±0.05 更稳健——小样本时下界更保守，大样本时更接近真实成功率。

### Tier 晋升/降级条件

**晋升**（confidence 驱动 + hysteresis 防抖）：
- confidence 超过阈值（experimental<0.30 → probation<0.55 → stable<0.75 → canonical<0.90）
- 在当前 Tier 驻留时间满足 `hysteresis` 要求（防止噪声导致的快速抖动）
- 实现：`packages/core/src/calibrator/v2/hysteresis.ts`

**降级**（Demerit 系统）：
- 每次 AI override（绕过规则）或 validator 验证失败，累加 demerit
- demerit≥5：强制 Tier 降 1 级（soft demote）
- demerit≥15：强制 Tier 降 2 级（hard demote）
- demerit≥30：进入 dormant（休眠）
- demerit 按指数半衰期自然衰减（experimental: 7天，enforced: 28天）
- dormant 状态可被 resurrect，`resurrect_count≥3` 则永久归档，防止"僵尸知识"反复复活

---
