import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Walks from `start` (inclusive) up to filesystem root. Returns the first
 * ancestor whose `<dir>/.teamagent/knowledge.db` exists as a regular file.
 * Returns null if none. Stops at fs.root. Uses fs.statSync.
 *
 * Used by hook-shell, bin-stop, bin-session-start, session-start-logic
 * to fix issue #161: Claude Code launched from a sub-directory must still
 * find the project's `.teamagent/knowledge.db` registered in an ancestor.
 *
 * Behaviour notes:
 * - "First match wins, starting at cwd inclusive" — if both `cwd` and
 *   an ancestor have a `.teamagent/knowledge.db`, `cwd` wins.
 * - If `<dir>/.teamagent/knowledge.db` exists but is NOT a regular file
 *   (e.g. a directory or symlink-to-directory), this function treats it as
 *   "not a match" and KEEPS WALKING. We do not return null early because a
 *   higher ancestor may still have a valid file. This is the documented
 *   choice for the "db-is-directory" case.
 * - If `start` does not exist on disk, `path.resolve` still returns an
 *   absolute path; the loop tolerates `fs.statSync` throwing on missing
 *   candidates and walks up to root, eventually returning null.
 * - Cross-platform: uses `path.resolve` / `path.join` / `path.dirname` so
 *   Windows drive roots (`C:\`) and POSIX root (`/`) are both handled by
 *   the `parent === cur` stop condition.
 */
export function findTeamagentRoot(start: string): string | null {
  let cur = path.resolve(start);
  while (true) {
    const candidate = path.join(cur, ".teamagent", "knowledge.db");
    try {
      if (fs.statSync(candidate).isFile()) return cur;
    } catch {
      /* missing — keep walking */
    }
    const parent = path.dirname(cur);
    if (parent === cur) return null; // reached fs root
    cur = parent;
  }
}
