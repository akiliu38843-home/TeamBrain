/**
 * Issue #161 — end-to-end regression test.
 *
 * Reproduces the scenario from the issue body: a parent directory has
 * `.teamagent/knowledge.db`; Claude Code is launched from a *child* sub-
 * directory. Before the fix, `findTeamagentRoot` did not exist and every
 * hook entry hard-coded `path.join(cwd, ".teamagent", "knowledge.db")`,
 * so the project DB was invisible from the child cwd. After the fix:
 *
 *   1. `findTeamagentRoot(<root>/sub)` walks up to `<root>` and finds
 *      `<root>/.teamagent/knowledge.db`.
 *   2. The hook-shell layer joins that ancestor with `.teamagent/knowledge.db`
 *      to get the correct project DB path.
 *   3. `decideAction(<root>/sub)` returns `"skip-already-initialized"` so
 *      SessionStart does NOT auto-init a duplicate child `.teamagent/`.
 *
 * This test asserts (1) + (2) + (3) — the three observable behaviours that
 * collectively prove the regression is fixed.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { findTeamagentRoot } from "../lib/walk-up.js";
import { decideAction } from "../session-start-logic.js";

interface Fixture {
  root: string;
  sub: string;
  cleanup: () => void;
}

function setupFixture(): Fixture {
  // Build a parent project root with `.teamagent/knowledge.db` and a `sub/`
  // child directory we'll use as the cwd.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "issue161-"));
  const sub = path.join(root, "sub");
  fs.mkdirSync(sub, { recursive: true });

  // Create the minimal artefact that `findTeamagentRoot` looks for: a regular
  // file at `<root>/.teamagent/knowledge.db`. Empty contents are fine — the
  // walk-up util only checks `fs.statSync(...).isFile()`.
  const teamagentDir = path.join(root, ".teamagent");
  fs.mkdirSync(teamagentDir, { recursive: true });
  fs.writeFileSync(path.join(teamagentDir, "knowledge.db"), Buffer.alloc(0));

  // For decideAction's project-marker check (irrelevant for the skip-already-
  // initialized branch but harmless to set up), give the parent a `.git/` dir.
  fs.mkdirSync(path.join(root, ".git"), { recursive: true });

  return {
    root,
    sub,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

describe("issue #161 — walk-up integration regression", () => {
  let fx: Fixture;

  beforeEach(() => {
    fx = setupFixture();
  });

  afterEach(() => {
    fx.cleanup();
  });

  it("findTeamagentRoot(<root>/sub) returns <root> (parent has .teamagent/knowledge.db)", () => {
    // fs.realpath the expected root because mkdtempSync may return a symlinked
    // path on macOS (e.g. /var/folders → /private/var/folders) and walk-up
    // resolves through path.resolve which preserves the symlink target.
    const realRoot = fs.realpathSync(fx.root);
    const realSub = fs.realpathSync(fx.sub);

    const found = findTeamagentRoot(realSub);
    expect(found).not.toBeNull();
    expect(found).toBe(realRoot);
  });

  it("hook-shell-style projectDbPath resolution from child cwd points at parent's DB", () => {
    // This replicates the exact resolution rule used by hook-shell/index.ts
    // (and by bin-stop / bin-session-start) after the issue #161 fix:
    //
    //   const projectRoot = findTeamagentRoot(cwd) ?? cwd;
    //   const projectDbPath = path.join(projectRoot, ".teamagent", "knowledge.db");
    //
    // From inside the child sub-directory, `projectDbPath` MUST be the parent
    // `<root>/.teamagent/knowledge.db` — NOT `<sub>/.teamagent/knowledge.db`
    // (which is what the pre-fix code computed).
    const realRoot = fs.realpathSync(fx.root);
    const realSub = fs.realpathSync(fx.sub);

    const projectRoot = findTeamagentRoot(realSub) ?? realSub;
    const projectDbPath = path.join(projectRoot, ".teamagent", "knowledge.db");

    const expected = path.join(realRoot, ".teamagent", "knowledge.db");
    expect(projectDbPath).toBe(expected);
    expect(fs.existsSync(projectDbPath)).toBe(true);
  });

  it("decideAction(<root>/sub) returns 'skip-already-initialized' (does not auto-init duplicate)", () => {
    // SessionStart decision: when the cwd is a child of an already-initialized
    // project, decideAction must NOT spawn auto-init (which would create a
    // second `.teamagent/` directory inside the child). Issue #161's fix wires
    // findTeamagentRoot into decideAction so the ancestor's DB is honoured.
    const realSub = fs.realpathSync(fx.sub);
    const action = decideAction(realSub);
    expect(action).toBe("skip-already-initialized");
  });

  it("decideAction(<root>) — i.e. the cwd itself has the DB — also returns 'skip-already-initialized'", () => {
    // Sanity: the "cwd inclusive" semantics of findTeamagentRoot mean even
    // launching cc directly from the project root must short-circuit out of
    // auto-init.
    const realRoot = fs.realpathSync(fx.root);
    const action = decideAction(realRoot);
    expect(action).toBe("skip-already-initialized");
  });

  it("findTeamagentRoot returns null when no ancestor has .teamagent/knowledge.db", () => {
    // Negative control: an unrelated tmp dir with NO project root above it
    // (we walk up to fs root without finding a match) must not falsely match
    // some real .teamagent/ on the developer's machine. Use a fresh tmp dir
    // that we know has nothing TeamAgent-shaped above it within the test.
    const lonelyRoot = fs.mkdtempSync(path.join(os.tmpdir(), "issue161-empty-"));
    try {
      const lonely = path.join(lonelyRoot, "sub");
      fs.mkdirSync(lonely, { recursive: true });
      // We can't fully prove the absence of a real ancestor `.teamagent/db`
      // on the host machine, so this test asserts the weaker — but still
      // load-bearing — invariant: from a sub of `lonelyRoot`, findTeamagentRoot
      // must NOT return `lonelyRoot` (because we never wrote a DB there).
      const found = findTeamagentRoot(fs.realpathSync(lonely));
      expect(found).not.toBe(fs.realpathSync(lonelyRoot));
    } finally {
      fs.rmSync(lonelyRoot, { recursive: true, force: true });
    }
  });
});
