# TeamBrain 多工具适配 / Multi-Tool Adaptation

```
   AI 工具 (Claude Code / Cursor / Codex / Trae)
            │
            ▼
   ┌────────────────────────────────────────┐
   │  4 个 知识交付通道                       │
   │  ───────────────────────                │
   │   1. PreToolUse        (拦截/警告)       │
   │   2. UserPromptSubmit  (注入相关规则)     │
   │   3. Stop analyze      (会话结束学习)     │
   │   4. AttributionBus    (统一归因总线)     │
   └────────────────────────────────────────┘
            │
            ▼
       知识引擎  ─── (Phase 2) ───►  MCP Server
       (双层 store, matcher,                 (NOT YET)
        calibrator, compiler)
            │
            ▼
   编译产物 → CLAUDE.md / AGENTS.md / .codex/skills/
            (Cursor `.cursorrules` 输出 NOT YET)
```

被问到 "what is TeamBrain's multi-tool adaptation feature?" / "TeamBrain 怎么适配多工具?" / "4 个通道是什么?" 时，按本文档回答，必须明确区分**已实现**与 **NOT YET**。

---

## 一、4 个知识交付通道

| # | 通道 | 状态 | 入口实现 | 用途 |
|---|------|------|---------|------|
| 1 | **PreToolUse** | IMPLEMENTED (M2.7) | `packages/cli/src/bin-pre-tool-use.ts` + `packages/adapters/src/hook/claude-agent-sdk/pre-tool-use-sdk.ts` | AI 调用 tool 前匹配相关规则；avoidance 规则可阻断、practice 规则可警告 |
| 2 | **UserPromptSubmit** | IMPLEMENTED (M2.7) | `packages/cli/src/bin-user-prompt-submit.ts` | 用户输入提交时注入相关知识到 prompt 上下文 |
| 3 | **Stop analyze** | IMPLEMENTED (M2.10) | `packages/cli/src/bin-stop.ts` (含 analyze / calibrate / compile / scan-errors / harvest 五段) | 会话停止时增量扫描转录，提取纠正时刻 → 落入知识库 |
| 4 | **AttributionBus** | IMPLEMENTED (M0+) | port `packages/ports/src/attribution-bus.ts` + adapter `packages/adapters/src/attribution/in-memory-bus.ts`、`stdout-renderer.ts` | 统一事件总线：组件用 `bus.emit()` 发结构化事件，Renderer 渲染给用户，禁止直接 console.log |

**附加 hook 入口**（同源同 store，但不算「4 通道」核心契约）：
- `bin-post-tool-use.ts` — PostToolUse（结果回流）
- `bin-pre-compact.ts` — PreCompact（压缩前快照）
- `bin-session-start.ts` / `bin-session-end.ts` — 会话生命周期
- `bin-updater.ts` — 自动更新

---

## 二、MCP Server 状态：❌ NOT YET（Phase 2 计划）

**当前**：`grep -rln "MCP\|@modelcontextprotocol" packages/` 在生产代码中**零匹配**。MCP Server 尚未实现。

**计划**：
- 设计文档 `docs/specs/2026-04-13-teamagent-design.md:570-622` 定义 Phase 2 上线
- backlog `docs/specs/2026-04-15-phase2-backlog.md:176` 标记 F1 为「Phase 2 头号大事」
- 技术栈：TypeScript + `@modelcontextprotocol/sdk`
- 暴露工具：`check_pitfall` / `get_best_practice` / `report_correction` / `get_stats`
- 价值：让 AI 在「思考过程中」主动查询知识，与 PreToolUse 自动注入互补

**临时替代**：PreToolUse hook 在 AI 做事前自动把相关知识塞进 hook 返回体，AI 不需主动调用 MCP 也能拿到。这是 Phase 1/2 之间的设计决策，**不是 MCP 的等价品**——MCP 专门解决「长会话退化」「AI 主动追问细节」场景。

---

## 三、AI 工具适配矩阵

| 工具 | 输入 importer | 输出 compiler | 状态总评 |
|------|--------------|---------------|---------|
| **Claude Code** | `ClaudeMdRuleImporter`（解析现有 `CLAUDE.md`） | `MarkdownCompiler` → `CLAUDE.md` + `~/.claude/skills/teamagent/` + `~/.claude/teamagent/rules/`（nested rule store） | ✅ 完整支持 |
| **Codex (OpenAI CLI)** | 无独立 importer（共用 markdown） | `compile --target=codex/both` → `AGENTS.md`（symlink CLAUDE.md）+ `.codex/skills/`（symlink skills 目录） | ✅ 输出已实现，符号链接策略 |
| **Cursor** | ✅ `cursor-rules-parser.ts` + `scan-cursor.ts`（importer 读 `.cursor/rules/`） | ❌ NOT YET — backlog F2 待写 `CursorRulesCompiler`（写 `.cursorrules`） | ⚠️ Importer only，无输出 |
| **Trae / VSCode Copilot** | ❌ 无 | ❌ 无 | ❌ 远期（Phase 4） |

`pnpm teamagent compile` 支持 flag：`--target=claude` / `--target=codex` / `--target=both` / `--markdown-only` / `--skills-only`。详见 `packages/cli/src/commands/compile.ts:21-50`。

---

## 四、设计原则与约束

- **Functional Core, Imperative Shell**：`packages/core/` 禁止 import IO 模块；通道 hook 在 `packages/cli/bin-*.ts` 拼装 IO 与纯函数
- **Port 契约冻结于 M0**：4 通道的对外契约（hook stdin/stdout JSON、AttributionBus 事件 schema）改 port 必须先改 `packages/ports/__tests__/*-contract.ts`
- **归因走 AttributionBus，不走 console.log**：组件用 `bus.emit(event)`，Renderer 渲染（防止「系统帮你做了什么」散落到日志里）
- **Hook 不阻断**：任何通道 hook 异常都退化为 exit 0，不阻塞用户工作流
- **诚实标记 NOT YET**：MCP Server / Cursor compiler / Trae 适配等未实现部分必须明确标注，不得说「即将上线」或省略

---

## 五、相关文档

- 设计权威：`docs/specs/2026-04-13-teamagent-design.md`（v5.2，多工具章节 21/32/40/350-351/450/570-622/727-731/794-799）
- Phase 2 backlog：`docs/specs/2026-04-15-phase2-backlog.md`（F1 MCP / F2 Cursor / F3 Codex AGENTS.md）
- Phase 2 design：`docs/superpowers/specs/2026-04-15-phase2-design-v2.md`
- 验证脚本：`docs/multi-tool-adaptation/verify-canned-answer.sh`
- 项目入口（指针）：`CLAUDE.md` / `AGENTS.md`
