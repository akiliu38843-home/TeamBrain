import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOOK_TAG = "teamagent-pre-tool-use";
const POST_HOOK_TAG = "teamagent-post-tool-use";
const USER_PROMPT_TAG = "teamagent-user-prompt-submit";
const STOP_HOOK_TAG   = "teamagent-stop";
const STATUS_LINE_TAG = "teamagent-statusline";

export interface InstallHookOptions {
  cwd?: string;
  /** 显式指定 PreToolUse hook 入口绝对路径 */
  hookEntry?: string;
  /** 显式指定 PostToolUse hook 入口绝对路径 */
  postHookEntry?: string;
  /** 显式指定 UserPromptSubmit hook 入口绝对路径 */
  userPromptEntry?: string;
  /** 显式指定 Stop hook 入口绝对路径 */
  stopEntry?: string;
  /** 显式指定 statusLine 脚本入口绝对路径 */
  statusLineEntry?: string;
  /** 显式指定 user-level home（默认 os.homedir()）。测试用。 */
  homeDir?: string;
  /**
   * Issue #161 — Layer 1 viral install. When `true` (default), additionally
   * write the same TeamAgent hook entries (PreToolUse / PostToolUse /
   * UserPromptSubmit / Stop) into `<homeDir>/.claude/settings.json` so
   * Claude Code launched from any cwd (including sub-directories of an
   * already-initialized project) registers the project's hooks. The
   * project-level write to `<cwd>/.claude/settings.local.json` is unchanged
   * either way. When `false`, behaviour is unchanged from before #161.
   */
  userLevel?: boolean;
}

interface ClaudeSettings {
  hooks?: {
    PreToolUse?: HookEntry[];
    PostToolUse?: HookEntry[];
    UserPromptSubmit?: HookEntry[];
    Stop?: HookEntry[];
    [k: string]: unknown;
  };
  statusLine?: {
    type?: string;
    command?: string;
    _teamagentTag?: string;
    /** 用户原 statusLine.command 字面值（issue #104：chain wrap 备份用） */
    _teamagentOriginalCommand?: string;
    /** 用户原 statusLine.type（默认 "command"） */
    _teamagentOriginalType?: string;
    /** 备份来源：user = ~/.claude/settings.json；project = 当前 settings.local.json */
    _teamagentOriginalScope?: "user" | "project";
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

interface HookEntry {
  matcher?: string;
  hooks: HookCommand[];
  /** TeamAgent 标签，用于卸载识别（自定义字段，settings.json 不要求）*/
  _teamagentTag?: string;
}

interface HookCommand {
  type: "command";
  command: string;
  timeout?: number;
}

function cliRoot(): string {
  // 从当前文件位置向上走，找到包含 dist/bin-pre-tool-use.cjs 的目录。
  // - Dev (source, tsx):  .../packages/cli/src/commands/install-hook.ts
  //                       → .../packages/cli/
  // - Bundled (npm):      .../node_modules/teamagent/dist/bin.js
  //                       → .../node_modules/teamagent/
  // 旧实现硬编码"退 3 层"，在 bundle 模式退到 node_modules/，
  // 再拼 "dist/bin-stop.cjs" 得到 node_modules/dist/bin-stop.cjs（不存在）。
  const here = fileURLToPath(import.meta.url);
  let dir = path.dirname(here);
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, "dist", "bin-pre-tool-use.cjs"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // 兜底：bundle 时总是 dist/bin.js → 上一级就是包根
  return path.dirname(path.dirname(here));
}

function defaultHookEntry(): string {
  return path.join(cliRoot(), "dist", "bin-pre-tool-use.cjs");
}

function defaultPostHookEntry(): string {
  return path.join(cliRoot(), "dist", "bin-post-tool-use.cjs");
}

/**
 * 把 Windows 反斜杠路径转为正斜杠格式。
 * Git Bash 会吞掉路径里的反斜杠（视为转义），所以 hook command 必须用 /。
 * `C:\path\to\repo` → `C:/path/to/repo`
 */
function toForwardSlash(p: string): string {
  return p.replace(/\\/g, "/");
}

function readSettings(file: string): ClaudeSettings {
  if (!fs.existsSync(file)) return {};
  const raw = fs.readFileSync(file, "utf-8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as ClaudeSettings;
}

function writeSettings(file: string, settings: ClaudeSettings): void {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + "\n", "utf-8");
}

/**
 * 把 TeamAgent PreToolUse hook 注册到 .claude/settings.local.json。
 * 用 settings.local.json 而非 settings.json 是因为：
 * - settings.local.json 是用户机器本地配置（Claude Code 约定不入 git）
 * - 入 git 的话每次提交都会带上 hook 引用，跨开发者不一致
 *
 * 重复安装是幂等的。
 */
export function installHook(opts: InstallHookOptions = {}): {
  settingsPath: string;
  hookEntry: string;
  postHookEntry: string;
  alreadyInstalled: boolean;
  postAlreadyInstalled: boolean;
  /** issue #104 起含义变更：true = statusLine bundle 缺失（极少发生）。
   *  用户已有 statusLine 时不再 skip，而是 chain wrap，见 statusLineMergedScope。 */
  statusLineSkipped: boolean;
  /** issue #104：本次 install 把哪一层用户 statusLine wrap 进了 chain；
   *  null = 用户原本就没有 statusLine，TeamBrain 独占 */
  statusLineMergedScope: "user" | "project" | null;
} {
  const cwd = opts.cwd ?? process.cwd();
  const settingsPath = path.join(cwd, ".claude", "settings.local.json");
  const hookEntry = opts.hookEntry ?? defaultHookEntry();
  const postHookEntry = opts.postHookEntry ?? defaultPostHookEntry();

  // 确认 PreToolUse bundled .cjs 存在
  if (!fs.existsSync(hookEntry)) {
    throw new Error(
      `Hook bundle not found: ${hookEntry}\n` +
        `请先运行: pnpm --filter @teamagent/cli build:hook`,
    );
  }
  // PostToolUse bundle 是软依赖——不存在时给警告但不阻断（兼容老安装）
  const hasPostBundle = fs.existsSync(postHookEntry);

  const settings = readSettings(settingsPath);
  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = [];
  if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];

  // PreToolUse 注册
  const preExisting = settings.hooks.PreToolUse.find(
    (h) => h._teamagentTag === HOOK_TAG,
  );
  let alreadyInstalled = false;
  if (preExisting) {
    alreadyInstalled = true;
  } else {
    const forwardPath = toForwardSlash(hookEntry);
    settings.hooks.PreToolUse.push({
      matcher: "Bash|Write|Edit|WebFetch",
      _teamagentTag: HOOK_TAG,
      hooks: [
        { type: "command", command: `node ${shellQuote(forwardPath)}`, timeout: 30 },
      ],
    });
  }

  // PostToolUse 注册（仅 bundle 存在时）
  let postAlreadyInstalled = false;
  if (hasPostBundle) {
    const postExisting = settings.hooks.PostToolUse.find(
      (h) => h._teamagentTag === POST_HOOK_TAG,
    );
    if (postExisting) {
      postAlreadyInstalled = true;
    } else {
      const forwardPath = toForwardSlash(postHookEntry);
      settings.hooks.PostToolUse.push({
        matcher: "Bash|Write|Edit|WebFetch",
        _teamagentTag: POST_HOOK_TAG,
        hooks: [
          { type: "command", command: `node ${shellQuote(forwardPath)}`, timeout: 30 },
        ],
      });
    }
  }

  // 清理空数组
  if (settings.hooks.PostToolUse?.length === 0) delete settings.hooks.PostToolUse;
  if (settings.hooks.PreToolUse?.length === 0) delete settings.hooks.PreToolUse;

  // UserPromptSubmit 注册
  const userPromptEntry = opts.userPromptEntry
    ?? path.join(cliRoot(), "dist", "bin-user-prompt-submit.cjs");
  const hasUserPromptBundle = fs.existsSync(userPromptEntry);
  if (!settings.hooks.UserPromptSubmit) settings.hooks.UserPromptSubmit = [];
  if (hasUserPromptBundle) {
    const upExisting = settings.hooks.UserPromptSubmit.find(
      (h) => h._teamagentTag === USER_PROMPT_TAG,
    );
    if (!upExisting) {
      settings.hooks.UserPromptSubmit.push({
        _teamagentTag: USER_PROMPT_TAG,
        hooks: [{ type: "command", command: `node ${shellQuote(toForwardSlash(userPromptEntry))}`, timeout: 10 }],
      });
    }
  }
  if (settings.hooks.UserPromptSubmit.length === 0) delete settings.hooks.UserPromptSubmit;

  // Stop 注册
  const stopEntry = opts.stopEntry
    ?? path.join(cliRoot(), "dist", "bin-stop.cjs");
  const hasStopBundle = fs.existsSync(stopEntry);
  if (!settings.hooks.Stop) settings.hooks.Stop = [];
  if (hasStopBundle) {
    const stopExisting = settings.hooks.Stop.find(
      (h) => h._teamagentTag === STOP_HOOK_TAG,
    );
    if (!stopExisting) {
      settings.hooks.Stop.push({
        _teamagentTag: STOP_HOOK_TAG,
        hooks: [{ type: "command", command: `node ${shellQuote(toForwardSlash(stopEntry))}`, timeout: 60 }],
      });
    }
  }
  if (settings.hooks.Stop.length === 0) delete settings.hooks.Stop;

  // statusLine 注册。CC 只有一个 statusLine 槽位 — 若用户已有 statusLine（user
  // level `~/.claude/settings.json` 或 project level `.claude/settings.local.json`），
  // 把用户 cmd 与 TeamBrain cmd chain 起来：
  //   bash -c '<user_cmd>; echo; <teamagent_cmd>'
  // 中间 echo 让两段输出换行（issue #104）。用户原 cmd 字面值备份到
  // _teamagentOriginalCommand / Type / Scope，便于 uninstall 还原。
  const statusLineEntry = opts.statusLineEntry
    ?? path.join(cliRoot(), "dist", "teamagent-statusline.cjs");
  const hasStatusLineBundle = fs.existsSync(statusLineEntry);
  // statusLineSkipped 保留字段为兼容；新语义：仅在 bundle 缺失时为 true
  let statusLineSkipped = false;
  let statusLineMergedScope: "user" | "project" | null = null;
  if (hasStatusLineBundle) {
    const homeDir = opts.homeDir ?? os.homedir();
    const teamCmd = `node ${shellQuote(toForwardSlash(statusLineEntry))}`;
    const existing = settings.statusLine;
    const existingIsTagged = existing?._teamagentTag === STATUS_LINE_TAG;
    const existingIsEmpty = !existing || Object.keys(existing).length === 0;

    let userCmd: string | null = null;
    let userType = "command";
    let userScope: "user" | "project" | null = null;

    if (existingIsTagged) {
      // 之前装过 teamagent — 复用上次备份（保留用户原 cmd），idempotent
      const orig = existing?._teamagentOriginalCommand;
      const origType = existing?._teamagentOriginalType;
      const origScope = existing?._teamagentOriginalScope;
      if (typeof orig === "string" && orig.length > 0) {
        userCmd = orig;
        userType = typeof origType === "string" ? origType : "command";
        userScope = origScope === "project" || origScope === "user" ? origScope : null;
      }
    } else if (!existingIsEmpty) {
      // 用户在 project level 自己写过 statusLine — 收编为 project scope 备份
      const cmd = existing?.command;
      const t = existing?.type;
      if (typeof cmd === "string" && cmd.length > 0) {
        userCmd = cmd;
        userType = typeof t === "string" ? t : "command";
        userScope = "project";
      }
    }

    if (!userCmd) {
      // project level 无信号 — 看 user level (~/.claude/settings.json)
      const userLevel = readUserLevelStatusLine(homeDir);
      if (userLevel) {
        userCmd = userLevel.command;
        userType = userLevel.type;
        userScope = "user";
      }
    }

    const newStatusLine: NonNullable<ClaudeSettings["statusLine"]> = {
      type: "command",
      command: buildStatusLineCommand(userCmd, teamCmd),
      _teamagentTag: STATUS_LINE_TAG,
    };
    if (userCmd) {
      newStatusLine._teamagentOriginalCommand = userCmd;
      newStatusLine._teamagentOriginalType = userType;
      newStatusLine._teamagentOriginalScope = userScope ?? "user";
      statusLineMergedScope = userScope;
    }
    settings.statusLine = newStatusLine;
  } else {
    statusLineSkipped = true;
  }

  writeSettings(settingsPath, settings);

  // Issue #161 — Layer 1 viral install. Default `userLevel: true` so Claude
  // Code launched from a sub-directory of an initialized project still has
  // the TeamAgent hooks registered. The user-level write is additive and
  // idempotent — existing TeamAgent-tagged entries are replaced in place,
  // foreign entries are preserved untouched.
  const userLevel = opts.userLevel ?? true;
  if (userLevel) {
    const homeDir = opts.homeDir ?? os.homedir();
    mergeUserLevelHooks(homeDir, {
      hookEntry,
      postHookEntry,
      userPromptEntry,
      stopEntry,
    });
  }

  return {
    settingsPath,
    hookEntry,
    postHookEntry,
    alreadyInstalled,
    postAlreadyInstalled,
    statusLineSkipped,
    statusLineMergedScope,
  };
}

/**
 * Issue #161 — write TeamAgent hook entries to `<homeDir>/.claude/settings.json`.
 *
 * Idempotent + additive:
 * - For each hook channel (PreToolUse / PostToolUse / UserPromptSubmit / Stop),
 *   we look up the existing TeamAgent-tagged entry and *replace it in place*.
 *   Foreign (non-TeamAgent-tagged) entries are preserved untouched.
 * - If the bundle for a given channel does not exist on disk we skip writing
 *   that channel (matches project-level behaviour).
 * - If `<homeDir>/.claude/settings.json` does not exist, the file is created
 *   with the minimal `{ "hooks": { ... } }` shape.
 *
 * NB: we deliberately do NOT touch `statusLine` here — that's the project's
 * project-level concern (#104) and the user-level statusLine is consulted as
 * a *read* by `readUserLevelStatusLine` above; rewriting it user-level would
 * conflict with that read path.
 */
function mergeUserLevelHooks(
  homeDir: string,
  entries: {
    hookEntry: string;
    postHookEntry: string;
    userPromptEntry: string;
    stopEntry: string;
  },
): void {
  const userSettingsPath = path.join(homeDir, ".claude", "settings.json");
  const settings = readSettings(userSettingsPath);
  if (!settings.hooks) settings.hooks = {};

  const channelOps: Array<{
    channel: "PreToolUse" | "PostToolUse" | "UserPromptSubmit" | "Stop";
    tag: string;
    bundlePath: string;
    matcher?: string;
    timeout: number;
  }> = [
    {
      channel: "PreToolUse",
      tag: HOOK_TAG,
      bundlePath: entries.hookEntry,
      matcher: "Bash|Write|Edit|WebFetch",
      timeout: 30,
    },
    {
      channel: "PostToolUse",
      tag: POST_HOOK_TAG,
      bundlePath: entries.postHookEntry,
      matcher: "Bash|Write|Edit|WebFetch",
      timeout: 30,
    },
    {
      channel: "UserPromptSubmit",
      tag: USER_PROMPT_TAG,
      bundlePath: entries.userPromptEntry,
      timeout: 10,
    },
    {
      channel: "Stop",
      tag: STOP_HOOK_TAG,
      bundlePath: entries.stopEntry,
      timeout: 60,
    },
  ];

  for (const op of channelOps) {
    if (!fs.existsSync(op.bundlePath)) continue;

    if (!settings.hooks[op.channel]) settings.hooks[op.channel] = [];
    const list = settings.hooks[op.channel] as HookEntry[];

    const command = `node ${shellQuote(toForwardSlash(op.bundlePath))}`;
    const newEntry: HookEntry = {
      _teamagentTag: op.tag,
      hooks: [{ type: "command", command, timeout: op.timeout }],
    };
    if (op.matcher) newEntry.matcher = op.matcher;

    const existingIdx = list.findIndex((h) => h._teamagentTag === op.tag);
    if (existingIdx >= 0) {
      // Replace in place — keeps array order stable and avoids duplicates.
      list[existingIdx] = newEntry;
    } else {
      list.push(newEntry);
    }
  }

  // Drop any channels that ended up empty (preserves prior structure when we
  // never had to touch them).
  for (const ch of ["PreToolUse", "PostToolUse", "UserPromptSubmit", "Stop"] as const) {
    const list = settings.hooks[ch] as HookEntry[] | undefined;
    if (Array.isArray(list) && list.length === 0) delete settings.hooks[ch];
  }
  if (settings.hooks && Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  writeSettings(userSettingsPath, settings);
}

/**
 * 读 user-level `~/.claude/settings.json` 的 statusLine。返回非 teamagent 自己的
 * 那条；teamagent 自己 tag 过的或文件不存在均返回 null（避免重入嵌套）。
 */
function readUserLevelStatusLine(
  homeDir: string,
): { command: string; type: string } | null {
  const userSettingsPath = path.join(homeDir, ".claude", "settings.json");
  if (!fs.existsSync(userSettingsPath)) return null;
  try {
    const raw = fs.readFileSync(userSettingsPath, "utf-8").trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      statusLine?: { command?: string; type?: string; _teamagentTag?: string };
    };
    const sl = parsed.statusLine;
    if (!sl || typeof sl.command !== "string" || sl.command.length === 0) return null;
    if (sl._teamagentTag) return null;
    return { command: sl.command, type: typeof sl.type === "string" ? sl.type : "command" };
  } catch {
    return null;
  }
}

function escapeForBashSingleQuote(s: string): string {
  // POSIX 单引号转义：'foo' bar → 'foo'\''bar'
  return s.replace(/'/g, "'\\''");
}

function buildStatusLineCommand(
  userCmd: string | null,
  teamCmd: string,
): string {
  if (!userCmd) return teamCmd;
  const u = escapeForBashSingleQuote(userCmd);
  const t = escapeForBashSingleQuote(teamCmd);
  return `bash -c '${u}; echo; ${t}'`;
}

/** 移除 TeamAgent hook 注册（PreToolUse + PostToolUse 一并）。 */
export function uninstallHook(opts: { cwd?: string } = {}): {
  settingsPath: string;
  removed: boolean;
} {
  const cwd = opts.cwd ?? process.cwd();
  const settingsPath = path.join(cwd, ".claude", "settings.local.json");

  if (!fs.existsSync(settingsPath)) {
    return { settingsPath, removed: false };
  }

  const settings = readSettings(settingsPath);
  if (!settings.hooks) {
    return { settingsPath, removed: false };
  }

  let removedAny = false;

  if (settings.hooks.PreToolUse) {
    const before = settings.hooks.PreToolUse.length;
    settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter(
      (h) => h._teamagentTag !== HOOK_TAG,
    );
    if (settings.hooks.PreToolUse.length !== before) removedAny = true;
    if (settings.hooks.PreToolUse.length === 0) delete settings.hooks.PreToolUse;
  }

  if (settings.hooks.PostToolUse) {
    const before = settings.hooks.PostToolUse.length;
    settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(
      (h) => h._teamagentTag !== POST_HOOK_TAG,
    );
    if (settings.hooks.PostToolUse.length !== before) removedAny = true;
    if (settings.hooks.PostToolUse.length === 0) delete settings.hooks.PostToolUse;
  }

  if (settings.hooks.UserPromptSubmit) {
    const before = settings.hooks.UserPromptSubmit.length;
    settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit.filter(
      (h) => h._teamagentTag !== USER_PROMPT_TAG,
    );
    if (settings.hooks.UserPromptSubmit.length !== before) removedAny = true;
    if (settings.hooks.UserPromptSubmit.length === 0) delete settings.hooks.UserPromptSubmit;
  }

  if (settings.hooks.Stop) {
    const before = settings.hooks.Stop.length;
    settings.hooks.Stop = settings.hooks.Stop.filter(
      (h) => h._teamagentTag !== STOP_HOOK_TAG,
    );
    if (settings.hooks.Stop.length !== before) removedAny = true;
    if (settings.hooks.Stop.length === 0) delete settings.hooks.Stop;
  }

  if (settings.hooks && Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  // statusLine：只有在明确打了 teamagent tag 时才动。issue #104 起 install
  // 会把用户原 cmd 备份到 _teamagentOriginalCommand。卸载策略：
  //   scope=project → 把项目级 statusLine 写回原 {type, command}
  //   scope=user / 缺失 → 直接删项目级条目（用户的 ~/.claude/settings.json
  //     从未被 install 触碰，CC 重新解析时会回到用户级）
  if (settings.statusLine?._teamagentTag === STATUS_LINE_TAG) {
    const orig = settings.statusLine._teamagentOriginalCommand;
    const origType = settings.statusLine._teamagentOriginalType;
    const origScope = settings.statusLine._teamagentOriginalScope;
    if (
      typeof orig === "string" &&
      orig.length > 0 &&
      origScope === "project"
    ) {
      settings.statusLine = {
        type: typeof origType === "string" ? origType : "command",
        command: orig,
      };
    } else {
      delete settings.statusLine;
    }
    removedAny = true;
  }

  writeSettings(settingsPath, settings);
  return { settingsPath, removed: removedAny };
}

function shellQuote(p: string): string {
  // 双引号包装 + 反斜杠转义内部引号；适用于 Windows + bash + Claude Code
  if (/^[A-Za-z0-9_./:\\-]+$/.test(p)) return p;
  return `"${p.replace(/"/g, '\\"')}"`;
}
