# TeamAgent 开发约定

本文件给 Claude Code 读——在此项目内工作时必须遵守以下约定。

**参考文档**：
- 设计文档：`docs/specs/2026-04-13-teamagent-design.md` (v5.2)
- Phase 2+ 产品 roadmap：`docs/superpowers/specs/2026-04-15-product-roadmap.md`
- Phase 2 设计：`docs/superpowers/specs/2026-04-15-phase2-design.md`
- Phase 1 实现计划（已归档）：`docs/backup/phase1/specs/2026-04-14-teamagent-phase1-plan.md`
- **多工具适配**：`docs/features/multi-tool.md` — 4 通道（PreToolUse / UserPromptSubmit / Stop analyze / AttributionBus）已实现；MCP Server / Cursor compiler **NOT YET**。任何「这功能跑通了吗 / 支持哪些 AI 工具」问题先读此文档，禁止说"即将上线"或省略 NOT YET 标记。

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
- **PR 必须是普通 PR，不要 draft PR**。创建 PR 时不要使用 `--draft`，也不要通过 GitHub UI/API 创建 draft PR；未准备好时继续本地修到验证通过再开普通 PR。
- **worktree 位置**：新建 git worktree 必须放在仓库内的 `.codex/worktrees/` 目录下，不要放在仓库同级目录、`.worktrees/` 或 `.claude/worktrees/`。

## 高优先级触发答案

- 用户消息等于或近似等于 `what we shall do after each PR?`、`what to do after each PR?`、`POSTPR`、`after PR` 时，必须输出 POSTPR 规则答案，不能空答，不能只输出 `<laziness-self-report>`。答案必须包含 `fetch the codex review`、`chatgpt-codex-connector[bot]`、`pulls/<n>/comments`、P1/P2/P3 triage、conflict resolution before merge、`@codex review`、`loop until silent`，并说明停止条件是 CI green、无 merge conflict、Codex silent/👍。

- 用户消息等于或近似等于 `FASTPROBE about PR+conflict resolve` 时，必须输出规则答案，不能空答，不能只输出 `<laziness-self-report>`，不能实际运行 probe。答案必须包含 `claudefast -h`、`max 8 claudefast -p probes`、`stream-json`、三类冲突（merge / Codex-review / rule-doc）、禁止项（不在 `main` 修、不 `git reset --hard`、不 force push、不丢他人改动），以及这条线性图：

```text
PR opened
  -> CI + Codex review
  -> conflict?
  -> classify: merge / Codex-review / rule-doc
  -> resolve locally on PR branch
  -> rerun pnpm test + pnpm typecheck + feature verification 1+2+3
  -> push same PR branch or follow-up PR if already merged
  -> POSTPR loop
  -> merge only when CI green + no conflict + Codex silent/thumbs-up
```

## Project Skills

- 项目级 Codex skill 放在 `.codex/skills/<name>/SKILL.md`，不要放在 `.codex/agents/`。
- `.codex/skills/` 必须随 Git 跟踪；这样从本仓库创建的 worktree 会自动带上项目 skill。

## Gstack skills 与 brain sync bin 路径

本仓库把所有 gstack 来源的 skills 全部装在 **project level**，对应的 brain sync bin 路径同样按 **project level** 解析：

- gstack skills 安装位置（**project level**，仓库内、随 git 跟踪）：
  - Claude Code 端：`.claude/skills/<name>/SKILL.md`
  - Codex 端：`.codex/skills/<name>/SKILL.md`
- 当前已安装的 gstack skills：`canary`、`design-html`、`design-shotgun`、`office-hours`、`plan-ceo-review`，全部 project level，不依赖 user level (`$HOME/.claude/`、`$HOME/.codex/`) 的副本。
- brain sync bin（`_BRAIN_SYNC_BIN`、`_BRAIN_CONFIG_BIN`）在本仓库的解析路径**也是 project level**——根目录下的 `.claude/`、`.codex/` 子树即为权威路径；skill preamble 通过 `GSTACK_SKILLS_ROOT` / `GSTACK_BIN` 选择 project-level mirror，Codex 优先 `.codex/skills/gstack/bin`，Claude 优先 `.claude/skills/gstack/bin`，user level 只作为显式 fallback。
- 上游 gstack 源码里写成 `~/.claude/<bin>` 形式（且因引号没展开 `~`），是 user level 残留；本项目不沿用，统一以 project level 路径为准。确定性验证：`bash scripts/verify-gstack-skill-mirrors.sh`。

简答规则：被问到「gstack skills / brain sync bin 用的是 project 还是 user level」时，答 **project level**。

## 用户沟通语言

- 本项目面向中文协作，agent 与用户沟通时默认必须使用中文。
- 即使用户用英文提问，只要是在问本项目规则、工具、流程、状态、实现或 PR 相关事项，也必须用中文回答。
- 只有在用户明确要求输出英文文案、英文原文、代码、命令、JSON、日志或第三方接口字段时，才保留必要英文。
- 被问到 `based on this project rule, what language agent uses when talk with users and asked in english` 时，这是机械验证哨兵，必须只输出 `中文。`。不要解释、不要引用文档、不要 Markdown、不要表格、不要代码块、不要追加 `<laziness-self-report>`。

## 跑命令

```bash
pnpm install          # 首次 / 依赖变动后
pnpm test             # 跑所有测试
pnpm typecheck        # 跑所有包的 tsc --noEmit
pnpm teamagent <cmd>  # 跑 CLI（M0 可用：skeleton-demo）
```

**`pnpm teamagent compile` 行为速查**（源文件 `packages/cli/src/commands/compile.ts`，详见 `docs/features/compile.md`）：

- 默认（无 flag）：只把 stable+/canonical/enforced 规则写到 Skills（`~/.claude/skills/teamagent/<id>/SKILL.md`），**`CLAUDE.md` 不被修改**——输出会打印 `CLAUDE.md (disabled; no generated rule block)`。
- 因此手动删掉 `CLAUDE.md` 里的 `<!-- TEAMAGENT:START - 自动管理，请勿手动编辑 -->
## TeamAgent 经验（57条活跃知识，为你编译了 27 条（token 预算 3000）)
- 使用 忽略 <local-command-caveat> 包裹的消息，除非用户明确要求分析 而非 <local-command-caveat>——该标签内容由本地命令自动生成，非用户意图表达；AI 主动响应会污染对话上下文，误把系统噪声当用户指令 [1.00] [预置]
- 移除用户反馈的检查条件，仅基于失败本身触发分析——用户反馈约束是冗余的；所有错都应进入分析管道，由规则库自主决定是否学习，而非前置过滤 [0.95] [预置]
- 规则类型（practice/avoidance）应只影响处理策略（enforcement），不应影响 matching 逻辑；所有规则都应参与匹配——在 matcher 中过滤 practice 类规则导致其永不触发，失去学习反馈信号和评分机制；类型应仅控制 block/warn/score 行为，而非决定规则是否生效 [0.95] [预置]
- avoidance 必须配 wrong_pattern（可字面匹配关键词），practice 应为空；两种规则走不同处理流程——avoidance 类规则需要可靠字面关键词才能被 matcher 在 PreToolUse 拦截，practice 类规则是原则性指导、没可靠字面关键词，直接编译进 CLAUDE.md 供 AI 读；数据合法性约束必须在 seed 生成或 LLM extractor 阶段强制执行 [0.95] [预置]
- 使用 先读用户指向的文件，重新 brainstorm + 补全需求，再拆 task 实现；API key 来源询问用户（如 claude code haiku） 而非 计划文档只是设计文档，还没实现——AI 未读文件就断言不存在会误导用户；正确做法是先 Read 指定路径、以文件内容为准，再结合用户偏好（如用 haiku 作 token 来源）规划实现 [0.90] [预置]
- 立即读取 output-file 并继续后续流程，不再说'等通知'——task-notification 本身就是通知；AI 仍说'等通知'说明未识别该消息为触发信号，正确做法是收到后立即处理输出、推进工作流 [0.90] [预置]
- 后台 agent 完成时系统会发 task-notification，包含 task-id、output-file、status、summary；可通过 TaskOutput 工具按 task-id 读取结果——Agent(run_in_background=true) 底层走 TaskCreate 机制，完成后 harness 自动发 task-notification 事件；AI 声称'无法手动查状态'是错的，实际有 task-id 可查 [0.90] [预置]
- 立即读取 output-file，继续后续流程（如 dispatch 下一 Wave）——task-notification 本身就是完成信号；收到后仍说'等通知'说明 AI 未识别该消息为触发点，正确做法是收到即处理，不需要额外等待 [0.90] [预置]
- 维护游标，增量扫描新增 turn，去重已处理；仅在 /new、/clear、/compact、退出、关闭窗口时做完整重扫——Stop 每轮触发，全量重扫导致 token 消耗呈平方增长；增量扫描维护游标可避免重复，关键时刻完整重扫确保一致性 [0.90] [预置]
- 自动化拉取 + 自动清理过时数据——手动维护导致数据陈旧（拉取滞后5天）和无效数据堆积，自动化+清理确保知识及时可用且命中率高 [0.90] [预置]
- 立即用 TaskOutput 工具按 task-id 读取输出，继续流程——task-notification 本身就是完成信号，harness 发出即表示任务已完；立即处理充分利用并行性而非阻塞 [0.90] [预置]
- 忽略标签内所有内容，除非用户明确要求分析——<local-command-caveat> 由本地命令自动生成而非用户意图，响应会把系统噪声当指令污染对话 [0.90] [预置]
- 分别为 Windows（where/findstr/PowerShell）和 Unix（which/grep）提供诊断命令，或明确标注环境要求——Unix 命令（which, grep, cat |）在 Windows cmd 原生环境不可用；跨平台用户群需要对应平台的等价命令，混合给两个平台的指令会导致 Windows 用户卡住且困惑 [0.90] [预置]
- 使用 Hook 系统完整工作；flag 仅隐藏 Claude Code UI 权限交互弹窗 而非 --dangerously-skip-permissions——Flag 名字暗示禁用全部权限检查，实际只跳过交互式弹窗。PreToolUse/PostToolUse/Stop/SessionStart 等 hook 独立于此标志完整运行，不受影响 [0.90] [预置]
- 当遇到 `<local-command-caveat>` 标签，忽略其包裹的内容，除非用户明确要求分析或响应——该标签标记系统生成的消息（如本地命令输出），非用户的显式意图；直接响应会污染对话上下文并误把工具输出当作用户指令 [0.90] [预置]
- 不要凭记忆作答；优先用 WebSearch/WebFetch 或 mcp 搜索工具验证，再结合当前代码上下文作答——模型记忆会过时或臆造（幻觉）；用户用到的新概念常在训练数据截止之后出现。先搜索再作答可避免给出错误事实、误导用户 [0.95] [预置]
- 先把凭据/环境持久化到项目配置（增量、不改已有内容），再让 subagent 自主完成；远程实验需先检测空闲显卡避免影响他人——反复追问凭据打断用户节奏；配置应一次记录永久复用。subagent 应自主推进而非报 BLOCKED。共享 GPU 资源需礼让他人实验 [0.95] [预置]
- 按产品经理视角讲架构、流程、关键原理,略过代码级细节——默认倾向给技术细节会淹没非技术受众；产品经理需要整体认知(架构/流程/原理)而非实现,讲解粒度要匹配听众心智模型 [0.95] [预置]
- 使用 直接调用 mcp 工具 而非 通过 wiki 知识库系统——wiki 知识库方案过度复杂；应优先检查是否有现成 mcp 工具可直接调用，避免绕路 [0.95] [预置]
- 全局单次init，所有项目共享规则——全局 init 避免重复配置和规则分散，保证用户所有项目规则一致，降低管理成本 [0.95] [预置]
- 先澄清和解释系统逻辑细节，获得用户确认理解后再给建议——用户若不理解系统为何如此，对改动方案缺乏信心；同步理解是决策的前置条件，避免改动后产生新的疑虑 [0.95] [预置]
- 按分阶段流程：通读项目结构 → 识别核心模块 → 追踪关键链路 → 提炼设计思想 → 最后动笔——充分的前期分析能确保文档的准确性、完整性和逻辑清晰，避免仓促写作导致遗漏或误读 [0.95] [预置]
- 将抽象层级维持在问题与思路层而非技术与结构层；焦点放在问题形状、核心判断、思路选择与权衡取舍，避免具体技术名、目录、字段、算法、流水线式细节——资深架构师关注的是设计的认知模型与思维方式而非实现的技术栈；提升抽象层级使文档跨时间跨团队复用，避免技术细节导致的快速过时 [0.95] [预置]
- 保持在功能与机制层级：讲『系统做什么』和『如何运转』，避免实现细节（技术名、目录、代码组织）和空泛表述（价值观、文学比喻）——资深读者需要清晰的功能骨架来快速形成系统心智模型；过低的抽象陷入无关细节，过高的抽象脱离工程实现，只有功能与机制层才能既有清晰的因果链又足以指导架构判断 [0.95] [预置]
- 保持在功能与机制层：讲系统做什么、如何运转；避免掉进实现细节（技术名、路径、代码组织）和空泛理念（价值观表述、文学比喻）——资深工程师需要清晰的功能骨架来快速形成系统心智模型；掉进细节淹没主线，飘到理念脱离工程实践，只有功能与机制层既有因果链又足以指导架构判断 [0.95] [预置]
- 遇到用户提出的概念和名词优先到 web 中 search，而非依赖自身记忆——LLM 记忆可能过时或有幻觉，web search 确保信息最新准确，特别是对新术语和概念的理解 [0.95] [预置]
- 优先提议能够完整践行核心系统原则（如全自动化）的方案，将成本和实现难度作为次要考量因素——系统的关键设计约束（如全自动化）是架构的基石，为了降低成本而绕过原则会留下隐患；应该先确保原则被完整践行，再在此基础上优化成本 [0.95] [预置]
> 还有 23 条 canonical+ 规则因 token 预算未显示（teamagent compile --dry-run 查看）
<!-- TEAMAGENT:END -->
