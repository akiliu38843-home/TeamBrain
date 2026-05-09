#!/usr/bin/env node
/**
 * Digital-Twin Stop Hook tap entry.
 *
 * Reads the Claude Code Stop hook stdin payload (StopHookInput), and forwards
 * (cwd, session_id) to `tapSession()` from `@teamagent/digital-twin`. Designed
 * to coexist with the existing TeamAgent learning Stop hook (`bin-stop.ts`)
 * — this entry deliberately does not call the learning pipeline.
 *
 * Hard rules:
 * - NEVER exits non-zero. Stop hook must not block session close.
 * - Returns silently if config disables digital-twin or if no transcript exists.
 * - Best-effort daemon spawn via resolveDaemonBin: prefers the user-installed
 *   `~/.teamagent/digital-twin/bin-uploader.cjs`, falls back to the monorepo
 *   build at `packages/digital-twin/dist/bin-uploader.cjs`, and silently
 *   self-installs the latter to the former on first hit. If neither exists,
 *   queue files persist for a future tick to pick up.
 */
import { existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ensureDefaultConfig,
  isEnabled,
  tapSession,
  digitalTwinPaths,
} from '@teamagent/digital-twin';

interface StopHookInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name?: string;
}

function isValidStopHookInput(v: unknown): v is StopHookInput {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as StopHookInput).session_id === 'string' &&
    typeof (v as StopHookInput).cwd === 'string'
  );
}

/**
 * `__dirname` shim that works in both CJS bundles (tsup) and ESM modules
 * (vitest). Returns the directory of the entry file. Tests can override via
 * `resolveDaemonBin`'s `selfDirname` dep.
 */
function selfDirname(): string {
  if (typeof __dirname === 'string' && __dirname.length > 0) return __dirname;
  return path.dirname(fileURLToPath(import.meta.url));
}

export interface ResolveDaemonBinDeps {
  /** Override entry-file directory. Tests use this to point at a fixture monorepo. */
  selfDirname?: () => string;
  /** Override existsSync so tests don't touch the real filesystem. */
  existsSync?: (p: string) => boolean;
  /** Best-effort self-install hooks. Failures must be swallowed by callers. */
  mkdirSync?: (p: string, opts: { recursive: true }) => void;
  copyFileSync?: (src: string, dest: string) => void;
}

/**
 * Resolve the uploader daemon binary path. Returns the absolute path to a
 * `bin-uploader.cjs` that `node` can spawn directly, or `null` when no copy
 * is reachable (queue files then persist for a future tick to pick up).
 *
 * Lookup order:
 *   1. `~/.teamagent/digital-twin/bin-uploader.cjs` — the user-installed
 *      production location. Stable across worktrees and `git pull`s, so the
 *      daemon stays runnable even when the working tree is mid-rebase.
 *   2. `<monorepo>/packages/digital-twin/dist/bin-uploader.cjs` — fallback
 *      for fresh worktrees / vitest / dev loops where the user-installed
 *      copy doesn't exist yet. Resolved relative to this entry's `__dirname`
 *      (works for both `cli/src/` during vitest and `cli/dist/` post-bundle,
 *      since both are `<monorepo>/packages/cli/{src,dist}` two levels above
 *      `digital-twin/dist`).
 *
 * When (2) hits but (1) doesn't, perform a best-effort self-install: copy
 * the monorepo bundle to `~/.teamagent/digital-twin/bin-uploader.cjs` so
 * subsequent invocations use the stable production location. Self-install
 * failure (read-only HOME, EACCES, etc.) is non-fatal — return the monorepo
 * path so this tick still spawns the daemon.
 */
export function resolveDaemonBin(
  home: string,
  deps: ResolveDaemonBinDeps = {},
): string | null {
  const ex = deps.existsSync ?? existsSync;
  const here = (deps.selfDirname ?? selfDirname)();
  const paths = digitalTwinPaths(home);
  const userInstalled = path.join(paths.digitalTwinDir, 'bin-uploader.cjs');
  if (ex(userInstalled)) return userInstalled;

  const monorepoDist = path.join(
    here,
    '..',
    '..',
    'digital-twin',
    'dist',
    'bin-uploader.cjs',
  );
  if (!ex(monorepoDist)) return null;

  try {
    const md = deps.mkdirSync ?? mkdirSync;
    const cp = deps.copyFileSync ?? copyFileSync;
    md(paths.digitalTwinDir, { recursive: true });
    cp(monorepoDist, userInstalled);
    return userInstalled;
  } catch {
    return monorepoDist;
  }
}

export async function main(
  stdinReader: () => Promise<string> = readStdin,
  homedirFn: () => string = homedir,
): Promise<void> {
  const home = homedirFn();
  // Zero-touch onboarding: auto-create a default config on first invocation
  // so newly-installed teammates don't need to run `teamagent digital-twin
  // login` manually. Respects `enabled: false` (user-paused) and malformed
  // JSON (returns null → silent skip below).
  let cfg;
  try {
    cfg = ensureDefaultConfig(home);
  } catch {
    return;
  }
  if (!isEnabled(cfg)) return;

  let raw: string;
  try {
    raw = (await stdinReader()).trim();
  } catch {
    return;
  }
  if (!raw) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (!isValidStopHookInput(parsed)) return;

  const daemonBin = resolveDaemonBin(home);
  tapSession(
    { cwd: parsed.cwd, sessionId: parsed.session_id },
    {
      homedir: () => home,
      daemonBin,
    },
  );
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf-8');
}

// Auto-invoke when this bundle is the entry point. Use process.argv[1] —
// works in both ESM (vitest) and CJS (tsup-bundled) contexts.
if (path.basename(process.argv[1] ?? '').startsWith('bin-digital-twin-tap')) {
  main().catch(() => {
    /* never block session close */
  });
}
