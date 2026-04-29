# TeamAgent

> 让团队的 AI **记住教训、复用经验、提前避坑**。  
> *A self-evolving rule engine for Claude Code teams.*

[![npm version](https://badge.fury.io/js/teamagent.svg)](https://www.npmjs.com/package/teamagent)
![Node >=22](https://img.shields.io/badge/node-%3E%3D22-green)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

## 你会愿意给这个项目点 ⭐ 的原因 / Why it is worth a star

你可能正被这些问题困扰：
- 同一个错误，AI 在不同会话反复犯；
- 团队经验分散在 PR、口头约定和历史文档中，AI 很难实时利用；
- 规则越积越多，但维护成本越来越高。

**TeamAgent 的目标**：把“这次纠错”变成“下次预防”。  
你纠正 AI 一次，系统把经验沉淀为结构化知识，并在下一次风险操作前提醒/拦截。它不是一次性 prompt 技巧，而是一套持续学习的工程化机制。  
**English:** Turn one correction into long-term prevention. TeamAgent captures feedback, compiles reusable rules, and intervenes before the same mistake repeats.

## 目录
- [它是什么：一句话定位](#它是什么一句话定位)
- [它现在能做什么（基于当前实现）](#它现在能做什么基于当前实现)
- [1 分钟快速上手](#1-分钟快速上手)
- [核心工作流：从纠错到防错](#核心工作流从纠错到防错)
- [命令总览（按任务阶段）](#命令总览按任务阶段)
- [系统使用规则（强烈建议先读）](#系统使用规则强烈建议先读)
- [典型使用场景](#典型使用场景)
- [已知边界与客观限制](#已知边界与客观限制)
- [故障排查与 FAQ](#故障排查与-faq)
- [系统要求 / 更多文档](#系统要求)

## 它是什么：一句话定位 / What it is
TeamAgent 是围绕 Claude Code Hooks 构建的**自进化规则引擎**：
- 持续学习你对 AI 的纠错；
- 在工具调用前做风险匹配；
- 根据真实效果动态校准规则质量；
- 让经验以规则形式长期生效。

**English:** TeamAgent is a self-evolving policy layer on top of Claude Code hooks: learn from corrections, check risky actions before tool execution, and continuously calibrate rule quality from outcomes.

## 它现在能做什么（基于当前实现）/ Current capabilities
### 1) 自动学习纠错经验
- 从会话与纠正信号中提取可复用规则；
- 写入结构化知识条目，供后续检索、校准、编译。

### 2) 实时预警 / 拦截
- 在 `PreToolUse` 阶段匹配即将执行的工具调用（Bash / Write / Edit / WebFetch）；
- 命中后按规则等级输出 `suggest / warn / block`。

### 3) 规则质量自动校准
- 基于“命中后是否有效”动态调整置信度；
- 低价值或高误报规则会被降权，减少噪音。

### 4) 双层知识存储
- 项目内个人知识（project/personal）；
- 机器全局知识（global）；
- 兼顾隔离性与跨项目复用。

### 5) 可观测归因输出
- 通过结构化归因事件说明“系统做了什么、为什么做”；
- 便于工程化验证与维护，而不是黑盒行为。

> 现阶段重点是“个人闭环能力”。团队级共享（team scope）和 MCP 实时顾问属于后续路线，尚未完整落地。

### 快速价值总结 / Value at a glance
- 减少重复错误：同类问题不会反复出现。  
- 降低沟通成本：团队经验变成系统能力。  
- 提升可解释性：每次干预都有可追踪归因。  
- 支持渐进治理：规则会校准，不是越积越乱。

## 1 分钟快速上手 / 1-minute quickstart
```bash
# 1) 安装
npm install -g teamagent

# 2) 进入你的项目
cd your-project

# 3) 初始化（建目录、注册 hook、准备规则产物）
teamagent init

# 4) 可选：安装团队标配插件（写入 ~/.claude/settings.json）
teamagent install-plugins

# 5) 完全重启 Claude Code（必须）
```

随后执行：

```bash
teamagent doctor
```

若诊断异常，先按提示修复再继续使用。

> Tip: `install-plugins` 是显式 opt-in，因为它会写入用户全局 `~/.claude/settings.json`。

## 核心工作流：从纠错到防错 / Closed-loop workflow
1. 你在对话中纠正 AI；
2. TeamAgent 分析信号并抽取经验；
3. 经验进入知识库并可被校准；
4. 下一次 AI 调用工具前进行规则匹配；
5. 命中后给出建议、警告或阻断；
6. 再根据效果继续校准，形成闭环。

**结果**：把“事后复盘”前移为“事前防错”。

**English:** Move quality control from post-mortem to pre-execution guardrails.

## 命令总览（按任务阶段）
### A. 安装与初始化
| 命令 | 作用 |
|---|---|
| `teamagent init` | 初始化当前项目 |
| `teamagent init --install-plugins` | 初始化 + 安装团队标配插件 |
| `teamagent doctor` | 环境与安装诊断 |
| `teamagent install-plugins` | 独立安装/重装插件 |

### B. 规则学习与维护
| 命令 | 作用 |
|---|---|
| `teamagent analyze --commit` | 分析会话并提交知识条目 |
| `teamagent calibrate` | 重新校准规则置信度 |
| `teamagent compile` | 重新编译规则输出 |
| `teamagent pitfall` | 手动记录一条经验 |
| `teamagent review` | 复核近期规则 |
| `teamagent stats` | 查看知识库统计 |

### C. 运维与治理
| 命令 | 作用 |
|---|---|
| `teamagent verify` | 跑验证场景并输出指标 |
| `teamagent uninstall` | 卸载（可选删除数据） |
| `teamagent config show` | 查看当前配置 |
| `teamagent --help` | 查看完整命令与参数 |

## 系统使用规则（强烈建议先读）/ Operational rules
1. **初始化后必须重启 Claude Code**：不是刷新，是完整退出重开。  
2. **Windows 推荐 Git Bash**：PowerShell/CMD 不是推荐运行环境。  
3. **`install-plugins` 会修改用户全局配置**：写入 `~/.claude/settings.json`，影响该用户所有项目。  
4. **先跑 doctor，再排障**：依赖、路径、扩展加载问题可优先在 `teamagent doctor` 定位。  
5. **Hook 原则是“可降级，不阻断主流程”**：目标是保证开发流不中断。

### 推荐落地方式 / Suggested rollout
1. 先在单个仓库 `init + doctor`，观察 1~2 天命中质量；  
2. 再启用团队常用插件并统一 FAQ；  
3. 每周固定做一次 `review + calibrate`，保持规则库健康。

## 典型使用场景

- 把代码评审里的重复建议前置到 AI 执行前；
- 让团队规范长期稳定地被 AI 遵循；
- 多仓库切换时复用稳定经验，减少重复沟通；
- 把 AI 使用从“个人技巧”升级为“可观测、可演进系统”。

## 已知边界与客观限制 / Known limitations
- 当前主打个人层闭环；`team` 级共享仍在后续阶段；
- MCP Server 形态的实时顾问能力尚未完整落地；
- 部分能力依赖可选组件（如 `sqlite-vec`），缺失时会降级。

这不影响核心价值：先有效压低“重复犯错”频率。

## 故障排查与 FAQ / Troubleshooting
### Q1: 装完后“没反应”怎么办？
先确认：执行过 `teamagent init`、完整重启过 Claude Code、`teamagent doctor` 是否通过。

### Q2: 插件安装失败怎么办？
确认 `claude` 在 PATH（`claude --version`），再检查网络/仓库访问能力。

### Q3: `claudefast` 是 TeamAgent 命令吗？
不是。它通常是本机 `claude` wrapper/alias，用于低成本非交互测试。详见 `docs/CLAUDEFAST.md`。

### Q4: 如何安全卸载？
```bash
teamagent uninstall --delete-data
npm uninstall -g teamagent
```

### Q5: 如何确认 Hook 真正生效？
执行 `teamagent doctor`，并用一个小型可控命令做验证（例如触发已知规则的 Bash 输入），观察是否出现预期提示/拦截。

## 系统要求
- Node.js >= 22
- Claude Code >= 1.0
- macOS / Linux / Windows（推荐 Git Bash）

## 更多文档

- 系统总览：[`docs/SYSTEM.md`](docs/SYSTEM.md)
- 架构说明：[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- claudefast 说明：[`docs/CLAUDEFAST.md`](docs/CLAUDEFAST.md)

## License

MIT

如果这个项目帮你减少了一次重复返工，欢迎点一个 ⭐。  
你的 Star 会帮助更多团队把 AI 协作从“能用”推进到“可靠好用”。
