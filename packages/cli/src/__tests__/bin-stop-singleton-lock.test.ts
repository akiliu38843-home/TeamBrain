import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { shouldSkipForExistingPipeline } from "../bin-stop.js";

/**
 * Regression test for issue #189: detached Stop pipeline must not spawn
 * concurrent children. shouldSkipForExistingPipeline returns the live
 * owner pid when we should skip, null when the spawn should proceed.
 *
 * Lock file format: {"pid":<int>,"started_at":"<iso>"}.
 *
 * Stale conditions (treated as "no live owner"):
 *   - file missing
 *   - JSON parse error
 *   - pid not alive (process.kill(pid, 0) raises ESRCH)
 *   - started_at older than STOP_PIPELINE_LOCK_MAX_AGE_MS (30 min)
 */
describe("shouldSkipForExistingPipeline (issue #189)", () => {
  let tmpDir: string;
  let lockPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "teamagent-locktest-"));
    lockPath = path.join(tmpDir, ".stop-pipeline.lock");
  });

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("returns null when lock file missing", () => {
    expect(shouldSkipForExistingPipeline(lockPath)).toBeNull();
  });

  it("returns null when lock file is malformed JSON", () => {
    writeFileSync(lockPath, "not valid json {", "utf-8");
    expect(shouldSkipForExistingPipeline(lockPath)).toBeNull();
  });

  it("returns null when stored pid is dead", () => {
    // PID 1 is init/launchd — alive. We need a definitely-dead pid.
    // Spawn a no-op subprocess and let it exit, capture pid.
    // Simpler: pick a very large pid unlikely to be in use.
    const probablyDeadPid = 999_999_999;
    writeFileSync(
      lockPath,
      JSON.stringify({ pid: probablyDeadPid, started_at: new Date().toISOString() }),
      "utf-8",
    );
    expect(shouldSkipForExistingPipeline(lockPath)).toBeNull();
  });

  it("returns null when lock is older than 30 min (stale by age)", () => {
    const veryOld = new Date(Date.now() - 31 * 60 * 1000).toISOString();
    writeFileSync(
      lockPath,
      JSON.stringify({ pid: process.pid, started_at: veryOld }),
      "utf-8",
    );
    expect(shouldSkipForExistingPipeline(lockPath)).toBeNull();
  });

  it("returns the pid when lock holder is our own (alive) process", () => {
    // process.pid is guaranteed alive (we are it). started_at = now.
    writeFileSync(
      lockPath,
      JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }),
      "utf-8",
    );
    expect(shouldSkipForExistingPipeline(lockPath)).toBe(process.pid);
  });

  it("returns null when started_at is malformed", () => {
    writeFileSync(
      lockPath,
      JSON.stringify({ pid: process.pid, started_at: "not-an-iso-date" }),
      "utf-8",
    );
    // Invalid started_at => treat as stale => null (allow new spawn).
    expect(shouldSkipForExistingPipeline(lockPath)).toBeNull();
  });
});
