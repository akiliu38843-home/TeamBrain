import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { findTeamagentRoot } from "../walk-up.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "walk-up-test-"));
  // Resolve realpath in case the OS tmpdir is itself a symlink (e.g. macOS
  // /tmp -> /private/tmp). Without this, path.resolve in findTeamagentRoot
  // may differ from the literal tmpDir string and break equality assertions.
  tmpDir = fs.realpathSync(tmpDir);
});

afterEach(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

/**
 * Create `<dir>/.teamagent/knowledge.db` as a regular file.
 */
function plantDb(dir: string): void {
  const teamagentDir = path.join(dir, ".teamagent");
  fs.mkdirSync(teamagentDir, { recursive: true });
  fs.writeFileSync(path.join(teamagentDir, "knowledge.db"), "stub");
}

describe("findTeamagentRoot", () => {
  it("cwd has knowledge.db -> returns cwd itself", () => {
    plantDb(tmpDir);
    expect(findTeamagentRoot(tmpDir)).toBe(tmpDir);
  });

  it("parent has knowledge.db, cwd does not -> returns parent", () => {
    plantDb(tmpDir);
    const child = path.join(tmpDir, "child");
    fs.mkdirSync(child, { recursive: true });
    expect(findTeamagentRoot(child)).toBe(tmpDir);
  });

  it("grandparent has knowledge.db -> returns grandparent", () => {
    plantDb(tmpDir);
    const grandchild = path.join(tmpDir, "child", "grandchild");
    fs.mkdirSync(grandchild, { recursive: true });
    expect(findTeamagentRoot(grandchild)).toBe(tmpDir);
  });

  it("no knowledge.db anywhere on the walk -> returns null", () => {
    // Tmp dir tree exists but no .teamagent/knowledge.db planted.
    // Walk-up climbs from tmpDir to fs root and returns null.
    const child = path.join(tmpDir, "child");
    fs.mkdirSync(child, { recursive: true });
    expect(findTeamagentRoot(child)).toBeNull();
  });

  it(".teamagent/knowledge.db is a directory not a file -> keeps walking (returns null when no real DB above)", () => {
    // Documented choice: when knowledge.db exists but is NOT a regular file,
    // findTeamagentRoot treats it as "not a match" and keeps walking up the
    // tree. Since we plant it at tmpDir and there is no real DB above tmpDir
    // within the test's controlled scope, the function will eventually return
    // null when it reaches fs root.
    const teamagentDir = path.join(tmpDir, ".teamagent");
    fs.mkdirSync(path.join(teamagentDir, "knowledge.db"), { recursive: true });
    expect(findTeamagentRoot(tmpDir)).toBeNull();
  });

  it("start is a non-existent path -> returns null", () => {
    // path.resolve still produces an absolute path; fs.statSync throws on
    // every candidate up the chain; loop tolerates and walks to fs root.
    const ghost = path.join(tmpDir, "does", "not", "exist", "anywhere");
    expect(findTeamagentRoot(ghost)).toBeNull();
  });
});
