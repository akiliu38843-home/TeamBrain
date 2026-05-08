import os from "node:os";
import path from "node:path";
import nodeFs from "node:fs";
import { DualLayerStore, normalizeCwd } from "@teamagent/adapters";
import { matchRules } from "@teamagent/core";
import type { KnowledgeEntry } from "@teamagent/types";

export interface DemoHookOptions {
  toolName: string;
  toolInput: Record<string, unknown>;
  cwd?: string;
  homeDir?: string;
  projectDbPath?: string;
  userGlobalDbPath?: string;
  /** Aliases used by sandbox-style callers (mirror of toolName/toolInput). */
  tool?: string;
  input?: Record<string, unknown>;
}

/** Structured result of executeDemoHook: human text + machine-readable decision. */
export interface DemoHookResult {
  output: string;
  decision: "allow" | "deny";
}

function decisionFor(rule: KnowledgeEntry | undefined): "allow" | "deny" {
  if (rule && rule.enforcement === "block") return "deny";
  return "allow";
}

function formatBlockReason(rule: KnowledgeEntry): string {
  return [
    `🚫 TeamAgent 拦截 (置信 ${rule.confidence.toFixed(2)})`,
    `应改用: ${rule.correct_pattern}`,
    `原因: ${rule.reasoning}`,
    `(规则 id: ${rule.id})`,
  ].join("\n");
}

function formatWarnMessage(rule: KnowledgeEntry): string {
  return [
    `💡 TeamAgent 经验 (置信 ${rule.confidence.toFixed(2)})`,
    `推荐: ${rule.correct_pattern}`,
    `原因: ${rule.reasoning}`,
  ].join("\n");
}

/**
 * 离线模拟一次 PreToolUse hook。
 * 用真实的知识库（personal/global SQLite）做匹配，但不需要 Claude Code。
 *
 * 返回归因式 stdout 文本（人类可读），而不是 hook JSON——便于命令行查看。
 *
 * B-066 — IRON LAW: demo-hook 是离线诊断命令，**严禁**写入 events.db、
 * 触发 store.update / hit_count / success_count 增量、或向 attribution
 * bus emit 任何被下游 calibrate 视为真实证据的事件。校准管线靠 events.db
 * 推断置信度，demo 一次会导致规则在没有任何真实触发的情况下置信度漂移
 * （历史上实测 0.70 → 0.83）。任何修改本函数的人都必须保持这个不变量；
 * `__tests__/demo-hook.test.ts` 里有 lock 这条约束的两条单元测试。
 */
export function executeDemoHook(opts: DemoHookOptions): DemoHookResult {
  const cwd = normalizeCwd(opts.cwd ?? process.cwd());
  const home = opts.homeDir ?? os.homedir();
  const toolName = opts.toolName ?? opts.tool ?? "";
  const toolInput = opts.toolInput ?? opts.input ?? {};

  const projectDbPath = opts.projectDbPath ?? path.join(cwd, ".teamagent", "knowledge.db");
  const userGlobalDbPath = opts.userGlobalDbPath ?? path.join(home, ".teamagent", "global.db");

  // 只打开已存在的 DB，避免在测试目录里意外创建空文件（也规避 Windows WAL 锁）
  const effectiveProject = nodeFs.existsSync(projectDbPath) ? projectDbPath : ":memory:";
  const effectiveGlobal = nodeFs.existsSync(userGlobalDbPath) ? userGlobalDbPath : ":memory:";

  let rules: KnowledgeEntry[] = [];
  try {
    const store = new DualLayerStore({
      projectDbPath: effectiveProject,
      userGlobalDbPath: effectiveGlobal,
    });
    rules = store.findActive();
    store.close();
  } catch {
    // store 打开失败时降级为空规则集
  }

  const matches = matchRules({ toolName, input: toolInput }, rules);

  if (matches.length === 0) {
    const out = [
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "🟢 TeamAgent · 模拟 PreToolUse 结果",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      `▸ 工具: ${toolName}`,
      `▸ 输入: ${JSON.stringify(toolInput)}`,
      "▸ 决策: 通过 (无规则命中)",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
    ].join("\n");
    return { output: out, decision: "allow" };
  }

  const top = matches[0]!;

  if (top.enforcement === "block") {
    const reason = formatBlockReason(top);
    const out = [
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "🚫 TeamAgent · 模拟 PreToolUse 结果",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      `▸ 工具: ${toolName}`,
      `▸ 输入: ${JSON.stringify(toolInput)}`,
      "▸ 决策: deny",
      "▸ 拦截原因:",
      ...reason.split("\n").map((ln) => `    ${ln}`),
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
    ].join("\n");
    return { output: out, decision: "deny" };
  }

  if (top.enforcement === "warn") {
    const msg = formatWarnMessage(top);
    const out = [
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "💡 TeamAgent · 模拟 PreToolUse 结果",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      `▸ 工具: ${toolName}`,
      `▸ 输入: ${JSON.stringify(toolInput)}`,
      "▸ 决策: allow",
      "▸ 给 AI 的提示:",
      ...msg.split("\n").map((ln) => `    ${ln}`),
      `▸ 附加上下文: ${top.correct_pattern}`,
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
    ].join("\n");
    return { output: out, decision: "allow" };
  }

  // suggest / passive 默认通过
  const out = [
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "🟢 TeamAgent · 模拟 PreToolUse 结果",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    `▸ 工具: ${toolName}`,
    `▸ 输入: ${JSON.stringify(toolInput)}`,
    "▸ 决策: 通过 (suggest/passive)",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
  ].join("\n");
  return { output: out, decision: decisionFor(top) };
}

/**
 * 在单个 argv slot 内按 `;` 或 `&` 切分多对 key=value。
 * 返回 null 表示没有内嵌分隔符；否则返回所有解析出来的 [k,v] 对。
 *
 * 注：不处理转义（例如 `\;` / `\&`）——shell quoting 已经覆盖大多数场景。
 * 简单 split 即可，复杂 case 请使用空格分隔的多个 argv slot。
 */
function splitMultiField(v: string): Array<[string, string]> | null {
  const sep = v.includes(";") ? ";" : v.includes("&") ? "&" : null;
  if (!sep) return null;
  const parts = v.split(sep).filter((p) => p.length > 0);
  const out: Array<[string, string]> = [];
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    out.push([part.slice(0, idx), part.slice(idx + 1)]);
  }
  return out.length > 0 ? out : null;
}

/**
 * 解析 demo-hook 的 CLI 参数：argv[0]=tool, argv[1..]=key=value
 *
 * 支持四种输入形式：
 *  1. 空格分隔多 slot：`Write file_path=test.js content='console.log(1)'`
 *  2. 单 slot 内 `;` 分隔：`Write 'file_path=test.js;content=console.log(1)'`
 *  3. 单 slot 内 `&` 分隔：`Write 'file_path=test.js&content=console.log(1)'`
 *  4. 单 slot 整个 JSON：`Write '{"file_path":"test.js","content":"console.log(1)"}'`
 */
export function parseDemoHookArgs(args: string[]): DemoHookOptions | null {
  if (args.length === 0) return null;
  const toolName = args[0]!;
  const rest = args.slice(1);

  // Form 4: 单个 slot 且以 `{` 开头 `}` 结尾，整体当 JSON 解析为 toolInput
  if (rest.length === 1) {
    const only = rest[0]!.trim();
    if (only.startsWith("{") && only.endsWith("}")) {
      try {
        const parsed = JSON.parse(only);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const toolInput = parsed as Record<string, unknown>;
          return { toolName, toolInput, tool: toolName, input: toolInput };
        }
      } catch {
        // JSON parse 失败时 fallthrough 到普通 key=value 解析
      }
    }
  }

  const toolInput: Record<string, unknown> = {};
  const assign = (k: string, v: string) => {
    // 尝试解析 JSON，否则保留为字符串
    try {
      toolInput[k] = JSON.parse(v);
    } catch {
      toolInput[k] = v;
    }
  };

  for (const a of rest) {
    const idx = a.indexOf("=");
    if (idx < 0) continue;
    const k = a.slice(0, idx);
    const v = a.slice(idx + 1);
    // Form 2/3: v 内含 `;` 或 `&` 表示多对 key=value 共用一个 slot。
    // 但必须先把当前 (k, firstV) 还原回去，再追加后续 pairs。
    const multi = splitMultiField(v);
    if (multi) {
      // v 形如 `test.js;content=console.log(1)` —— 第一段是裸 value，归属当前 k；
      // 后续段已经是 `key=value` 形式（已经被 splitMultiField 拆开）。
      const sep = v.includes(";") ? ";" : "&";
      const parts = v.split(sep);
      assign(k, parts[0]!);
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i]!;
        const eq = part.indexOf("=");
        if (eq < 0) continue;
        assign(part.slice(0, eq), part.slice(eq + 1));
      }
      continue;
    }
    assign(k, v);
  }

  return { toolName, toolInput, tool: toolName, input: toolInput };
}
