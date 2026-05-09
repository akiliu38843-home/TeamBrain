import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ulid } from 'ulid';
import { main, resolveDaemonBin } from '../bin-digital-twin-tap.js';
import {
  defaultConfig,
  saveConfig,
  digitalTwinPaths,
  projectDirForCwd,
  TEAM_SHARED_TOKEN,
} from '@teamagent/digital-twin';

function freshHome(): string {
  const home = join(tmpdir(), `dt-tap-bin-${ulid()}`);
  mkdirSync(home, { recursive: true });
  return home;
}

function makeStdinReader(payload: string): () => Promise<string> {
  return async () => payload;
}

function writeTranscript(home: string, cwd: string, sessionId: string, body: string): void {
  const dir = join(home, '.claude', 'projects', projectDirForCwd(cwd));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${sessionId}.jsonl`), body, 'utf-8');
}

function enableConfigInHome(home: string): void {
  const cfg = defaultConfig({ user_id: 'u@h', machine_id: 'm-1' });
  cfg.uploader.token = 't';
  saveConfig(cfg, digitalTwinPaths(home).configFile);
}

describe('bin-digital-twin-tap main', () => {
  let home: string;
  beforeEach(() => {
    home = freshHome();
  });

  it('auto-creates default config when missing and proceeds to tap (zero-touch onboarding)', async () => {
    const cwd = '/proj/zero-touch';
    const sessionId = 'sess-1';
    writeTranscript(home, cwd, sessionId, 'x');

    const paths = digitalTwinPaths(home);
    expect(existsSync(paths.configFile)).toBe(false);

    const stdin = makeStdinReader(
      JSON.stringify({ session_id: sessionId, transcript_path: '', cwd }),
    );
    await main(stdin, () => home);

    // Config file was auto-created with the team-shared sentinel token.
    expect(existsSync(paths.configFile)).toBe(true);
    const persisted = JSON.parse(readFileSync(paths.configFile, 'utf-8'));
    expect(persisted.uploader.enabled).toBe(true);
    expect(persisted.uploader.token).toBe(TEAM_SHARED_TOKEN);
    expect(persisted.uploader.endpoint).toBe('http://192.168.22.88:8080');

    // tap-session ran: a queue payload + metadata were written.
    const entries = readdirSync(paths.pendingDir);
    expect(entries.filter((e) => e.endsWith('.payload')).length).toBe(1);
    expect(entries.filter((e) => e.endsWith('.json')).length).toBe(1);
  });

  it('respects user-paused config (enabled=false) and does not tap', async () => {
    const cwd = '/proj/paused';
    const sessionId = 'sess-paused';
    writeTranscript(home, cwd, sessionId, 'x');

    const paused = defaultConfig({ user_id: 'paused@x', machine_id: 'paused-host' });
    paused.uploader.enabled = false;
    const paths = digitalTwinPaths(home);
    saveConfig(paused, paths.configFile);
    const before = readFileSync(paths.configFile, 'utf-8');

    const stdin = makeStdinReader(
      JSON.stringify({ session_id: sessionId, transcript_path: '', cwd }),
    );
    await main(stdin, () => home);

    // Config file untouched.
    expect(readFileSync(paths.configFile, 'utf-8')).toBe(before);
    // No queue write.
    let queueEntries: string[] = [];
    try {
      queueEntries = readdirSync(paths.pendingDir);
    } catch {
      queueEntries = [];
    }
    expect(queueEntries.length).toBe(0);
  });

  it('patches missing token (enabled=true, token=null) and proceeds to tap', async () => {
    const cwd = '/proj/patch';
    const sessionId = 'sess-patch';
    writeTranscript(home, cwd, sessionId, 'x');

    const cfg = defaultConfig({ user_id: 'patch@x', machine_id: 'patch-host' });
    // enabled=true (default), token=null (default) — first-run patch case.
    const paths = digitalTwinPaths(home);
    saveConfig(cfg, paths.configFile);

    const stdin = makeStdinReader(
      JSON.stringify({ session_id: sessionId, transcript_path: '', cwd }),
    );
    await main(stdin, () => home);

    const persisted = JSON.parse(readFileSync(paths.configFile, 'utf-8'));
    expect(persisted.uploader.token).toBe(TEAM_SHARED_TOKEN);
    // Identity preserved.
    expect(persisted.identity.user_id).toBe('patch@x');
    expect(persisted.identity.machine_id).toBe('patch-host');

    const entries = readdirSync(paths.pendingDir);
    expect(entries.filter((e) => e.endsWith('.payload')).length).toBe(1);
  });

  it('returns silently and does not rewrite a malformed config file', async () => {
    const cwd = '/proj/malformed';
    const sessionId = 'sess-malformed';
    writeTranscript(home, cwd, sessionId, 'x');

    const paths = digitalTwinPaths(home);
    mkdirSync(paths.teamagentDir, { recursive: true });
    writeFileSync(paths.configFile, '{not json', 'utf-8');
    const before = readFileSync(paths.configFile, 'utf-8');

    const stdin = makeStdinReader(
      JSON.stringify({ session_id: sessionId, transcript_path: '', cwd }),
    );
    await main(stdin, () => home);

    // File untouched.
    expect(readFileSync(paths.configFile, 'utf-8')).toBe(before);
    // No tap.
    let queueEntries: string[] = [];
    try {
      queueEntries = readdirSync(paths.pendingDir);
    } catch {
      queueEntries = [];
    }
    expect(queueEntries.length).toBe(0);
  });

  it('returns silently when stdin is empty', async () => {
    const cwd = '/proj/empty';
    const sessionId = 'sess-2';
    writeTranscript(home, cwd, sessionId, 'x');
    enableConfigInHome(home);

    await main(makeStdinReader(''), () => home);

    const paths = digitalTwinPaths(home);
    let entries: string[] = [];
    try {
      entries = readdirSync(paths.pendingDir);
    } catch {
      entries = [];
    }
    expect(entries.length).toBe(0);
  });

  it('returns silently when stdin is invalid JSON', async () => {
    const cwd = '/proj/bad';
    const sessionId = 'sess-3';
    writeTranscript(home, cwd, sessionId, 'x');
    enableConfigInHome(home);

    await main(makeStdinReader('not-json'), () => home);

    const paths = digitalTwinPaths(home);
    let entries: string[] = [];
    try {
      entries = readdirSync(paths.pendingDir);
    } catch {
      entries = [];
    }
    expect(entries.length).toBe(0);
  });

  it('taps the session into the queue when config is enabled and transcript exists', async () => {
    const cwd = '/proj/ok';
    const sessionId = 'sess-4';
    writeTranscript(home, cwd, sessionId, 'session-body');
    enableConfigInHome(home);

    const stdin = makeStdinReader(
      JSON.stringify({ session_id: sessionId, transcript_path: '', cwd }),
    );
    await main(stdin, () => home);

    const paths = digitalTwinPaths(home);
    const entries = readdirSync(paths.pendingDir);
    const payloads = entries.filter((e) => e.endsWith('.payload'));
    const metas = entries.filter((e) => e.endsWith('.json'));
    expect(payloads.length).toBe(1);
    expect(metas.length).toBe(1);
  });

  it('stays silent (no queue write) when transcript file does not exist', async () => {
    const cwd = '/proj/missing-transcript';
    const sessionId = 'sess-5';
    enableConfigInHome(home);

    const stdin = makeStdinReader(
      JSON.stringify({ session_id: sessionId, transcript_path: '', cwd }),
    );
    await main(stdin, () => home);

    const paths = digitalTwinPaths(home);
    let entries: string[] = [];
    try {
      entries = readdirSync(paths.pendingDir);
    } catch {
      entries = [];
    }
    expect(entries.length).toBe(0);
  });

  it('rejects payloads missing required fields', async () => {
    const cwd = '/proj/badfields';
    const sessionId = 'sess-6';
    writeTranscript(home, cwd, sessionId, 'x');
    enableConfigInHome(home);

    // Missing session_id
    const stdin = makeStdinReader(JSON.stringify({ transcript_path: '', cwd }));
    await main(stdin, () => home);

    const paths = digitalTwinPaths(home);
    let entries: string[] = [];
    try {
      entries = readdirSync(paths.pendingDir);
    } catch {
      entries = [];
    }
    expect(entries.length).toBe(0);
  });
});

describe('resolveDaemonBin', () => {
  let home: string;
  beforeEach(() => {
    home = freshHome();
  });

  function makeFakeMonorepo(rootHome: string): { selfDir: string; daemonAt: string } {
    // Mirror the real monorepo layout: <root>/packages/cli/dist/bin-digital-twin-tap.cjs
    // and <root>/packages/digital-twin/dist/bin-uploader.cjs. resolveDaemonBin
    // walks `selfDirname → ../../digital-twin/dist/bin-uploader.cjs`.
    const selfDir = join(rootHome, 'packages', 'cli', 'dist');
    const daemonDir = join(rootHome, 'packages', 'digital-twin', 'dist');
    mkdirSync(selfDir, { recursive: true });
    mkdirSync(daemonDir, { recursive: true });
    const daemonAt = join(daemonDir, 'bin-uploader.cjs');
    writeFileSync(daemonAt, '// fake daemon bundle\n', 'utf-8');
    return { selfDir, daemonAt };
  }

  it('returns the user-installed path when present (no monorepo lookup)', () => {
    const paths = digitalTwinPaths(home);
    mkdirSync(paths.digitalTwinDir, { recursive: true });
    const userInstalled = join(paths.digitalTwinDir, 'bin-uploader.cjs');
    writeFileSync(userInstalled, '// existing user-installed bundle\n', 'utf-8');

    // selfDirname is irrelevant here because the user-installed path wins.
    const result = resolveDaemonBin(home, {
      selfDirname: () => '/nonexistent/cli/dist',
    });
    expect(result).toBe(userInstalled);
  });

  it('falls back to the monorepo dist and self-installs to user path', () => {
    const fakeRoot = join(tmpdir(), `dt-mono-${ulid()}`);
    mkdirSync(fakeRoot, { recursive: true });
    const { selfDir, daemonAt } = makeFakeMonorepo(fakeRoot);

    const paths = digitalTwinPaths(home);
    const userInstalled = join(paths.digitalTwinDir, 'bin-uploader.cjs');
    expect(existsSync(userInstalled)).toBe(false);

    const result = resolveDaemonBin(home, { selfDirname: () => selfDir });
    expect(result).toBe(userInstalled);
    expect(existsSync(userInstalled)).toBe(true);
    // Bytes copied from the monorepo bundle.
    expect(readFileSync(userInstalled, 'utf-8')).toBe(
      readFileSync(daemonAt, 'utf-8'),
    );
  });

  it('returns the monorepo path directly when self-install fails', () => {
    const fakeRoot = join(tmpdir(), `dt-mono-fail-${ulid()}`);
    mkdirSync(fakeRoot, { recursive: true });
    const { selfDir, daemonAt } = makeFakeMonorepo(fakeRoot);

    const result = resolveDaemonBin(home, {
      selfDirname: () => selfDir,
      // Simulate read-only HOME or EACCES on copy.
      copyFileSync: () => {
        throw new Error('EACCES');
      },
    });
    expect(result).toBe(daemonAt);
  });

  it('returns null when neither user-installed nor monorepo dist exists', () => {
    // Fresh tmpdir with no bin-uploader.cjs anywhere.
    const result = resolveDaemonBin(home, {
      selfDirname: () => '/nonexistent/cli/dist',
    });
    expect(result).toBeNull();
  });
});
