```
TASK LIFECYCLE
==============

  issue
    |
    v
  agent reads TRAPS.md
    |
    v
  fills ALL sections of this template  ← no section may be skipped or empty
    |
    v
  runs VERIFY recipe / shell cmd → evidence saved to .judge/<run_id>/
    |
    v
  commits with evidence artifacts included in commit body
    |
    v
  reviewer signs off on evidence (not on vibes)
    |
    v
  DONE  ✓

REJECTION PATH:
  any section blank → reviewer rejects → back to "fills ALL sections"
  verbal sign-off ("looks good") → rejected → must re-run VERIFY
```

---

## When to use

This is the canonical wrapper for any real task issued to an agent inside TeamBrain. Use it whenever work must be verifiable by a reviewer who was not present during execution. Do NOT use it for hello-world, proof-of-concept scratch tasks, or one-off explorations that will be discarded — those go in a scratch branch with no expectation of evidence.

---

## Required sections

Every issued task MUST fill ALL sections below. Leaving any section blank or writing "N/A" is a rejection signal.

---

### 1. Title

**Purpose:** Unambiguous single sentence that names the deliverable, not the activity.

**Required content:** One imperative sentence. Example: "Add feature flag `billing_v2` to `packages/core/src/flags.ts`." Not: "Work on billing flags."

**Verify hook:** Reviewer reads it cold and can restate the deliverable without asking clarifying questions.

**Failure mode if missing:** Agent interprets scope freely; reviewer cannot determine if task is done.

---

### 2. Context links

**Purpose:** Ground the task in a concrete artifact so the agent has no excuse to guess intent.

**Required content:** At least one of: GitHub PR URL, GitHub issue URL, or quoted line from a dump file (e.g., `docs/notes/2026-05-01-day0-team-experience-dump.md:82`). "See Slack" or "discussed verbally" are rejected.

**Verify hook:** Reviewer clicks or `cat`s each link and confirms it resolves.

**Failure mode if missing:** Agent builds on a misremembered requirement; no audit trail when scope disputes arise.

---

### 3. Scope IN

**Purpose:** Enumerate exactly what the agent is allowed to touch.

**Required content:** Concrete file paths or module names. Example:
```
packages/core/src/flags.ts
packages/core/src/__tests__/flags.test.ts
```
Wildcards allowed only when the glob is unambiguous (e.g., `packages/core/src/flags/**`).

**Verify hook:** Reviewer runs `git diff --name-only HEAD~1` and confirms every changed file is in Scope IN.

**Failure mode if missing:** Agent edits unrelated files; reviewer has no basis to reject the diff.

---

### 4. Scope OUT

**Purpose:** Explicit non-goals that pre-empt scope creep.

**Required content:** At least one concrete exclusion. Example: "Do NOT touch `packages/cli/`, `packages/ports/`, or any file outside Scope IN. Do NOT refactor existing flag logic."

**Verify hook:** Reviewer checks `git diff --name-only` against Scope OUT list; any match is an automatic reject.

**Failure mode if missing:** Agent "helpfully" refactors adjacent code; reviewer must untangle unrelated changes.

---

### 5. Deliverable

**Purpose:** Specify exactly what must exist when the task is done.

**Required content:**
- Exact output file paths (not directories).
- Commit message convention: `feat(teambrain): <imperative sentence>` or `fix(teambrain): ...`.
- Any artifact that must be attached (e.g., `.judge/<run_id>/judge.json`, screenshot).

**Verify hook:** Reviewer runs `git show --stat HEAD` and confirms all listed paths are present.

**Failure mode if missing:** Agent commits partial work and claims completion.

---

### 6. Success criteria

**Purpose:** Make "done" machine-readable so no verbal sign-off is possible.

**Required content:** One of:
- A `VERIFY_TEMPLATE.md` recipe ID (e.g., `VERIFY-PNPM-001`).
- A shell command + exact expected output. Example:
  ```bash
  pnpm test --filter packages/core 2>&1 | tail -1
  # expected: "Tests: X passed, 0 failed"
  ```
- A JSON field check against `.judge/<run_id>/judge.json`.

**Hard rule:** "Looks good to me", "CI is green", and "tests pass locally" are NOT valid success criteria and MUST be rejected by the reviewer. A passing CI that runs zero new tests for the new code is also a rejection.

**Verify hook:** Reviewer runs the exact command or checks the exact recipe; pass/fail is deterministic.

**Failure mode if missing:** Agent ships untested code behind a CI badge.

---

### 7. Evidence checklist

**Purpose:** Force the agent to save raw proof before closing the task.

**Required content:** Enumerate exactly what must be saved and where:
```
[ ] .judge/<run_id>/stdout.txt      — raw test runner output
[ ] .judge/<run_id>/coverage.json   — lcov or equivalent
[ ] .judge/<run_id>/judge.json      — structured summary: exit_code, metrics, evidence_dir
[ ] (if UI) .judge/<run_id>/screenshot.png
```
The run_id must be the short git sha of the evidence commit (e.g., `abc1234`).

**Verify hook:** Reviewer runs `ls .judge/` and opens `judge.json`; if any listed artifact is absent the task is rejected.

**Failure mode if missing:** "Evidence" is a verbal claim; reviewer has nothing to audit.

---

### 8. Anti-mock checklist

**Purpose:** Close the loophole where tests pass only because real behavior is mocked away.

**Required content:** Agent must confirm each item before committing:
```
[ ] No `it.skip` or `test.skip` on tests for the SUT (subject under test).
[ ] No `// TODO: test later` comments in new or modified files.
[ ] No environment-only mocks that replace the SUT itself (mocking its dependencies is fine).
[ ] No `/* istanbul ignore */` added in this diff without a linked ticket.
[ ] Existing coverage % did not decrease (check .judge/<run_id>/coverage.json delta).
```

**Verify hook:** Reviewer greps:
```bash
grep -rn "it\.skip\|test\.skip\|TODO.*test\|istanbul ignore" <Scope IN paths>
```
Any hit that is not pre-existing (check `git diff`) is a rejection.

**Failure mode if missing:** Agent skips failing tests to make CI green; passing CI does not mean passing tests.

---

### 9. Trap-awareness checklist

**Purpose:** Ensure the agent has read the relevant TRAPS.md entries before starting.

**Required content:** List the TRAPS.md trap IDs that apply to this task, with a one-line confirmation that the agent has read each. Example:
```
[ ] TRAP-GIT-001 — confirmed read; will use --force-with-lease
[ ] TRAP-REVIEW-002 — confirmed read; will verify no it.skip added
[ ] TRAP-OPS-011 — confirmed read; will save .judge/ before commit
```
If no traps apply, write: "Reviewed TRAPS.md; no applicable traps for this task scope."

**Verify hook:** Reviewer cross-checks listed IDs against TRAPS.md to confirm they exist and match the task.

**Failure mode if missing:** Agent repeats a known failure pattern that is already documented.

---

### 10. Reviewer hand-off

**Purpose:** Name who reviews, what they need, and when.

**Required content:**
- Reviewer name or role (e.g., "Backend reviewer" or "@alice").
- Artifacts required for review: PR URL, `.judge/<run_id>/` path, any Slack thread.
- Review deadline (absolute date/time, not "ASAP").

**Verify hook:** Reviewer confirms they received all listed artifacts before starting review.

**Failure mode if missing:** Task sits in limbo; no one knows who is responsible.

---

## Filled-in example

```
Title:
  Add feature flag `billing_v2` to packages/core/src/flags.ts

Context links:
  GitHub Issue: https://github.com/org/TeamBrain/issues/42
  Spec line: docs/specs/2026-05-01-teambrain-72h-bootstrap.md:82

Scope IN:
  packages/core/src/flags.ts
  packages/core/src/__tests__/flags.test.ts

Scope OUT:
  Do NOT touch packages/cli/, packages/ports/, docs/, or any file outside Scope IN.
  Do NOT refactor existing flag infrastructure.
  Do NOT add a UI toggle — that is tracked in issue #55.

Deliverable:
  - packages/core/src/flags.ts — new export `billing_v2: boolean`
  - packages/core/src/__tests__/flags.test.ts — ≥3 new tests covering on/off/default
  - .judge/abc1234/judge.json, stdout.txt, coverage.json
  - Commit message: feat(teambrain): add billing_v2 feature flag to core

Success criteria:
  pnpm test --filter packages/core 2>&1 | grep -E "passed|failed"
  # expected: "Tests: N passed, 0 failed" where N > previous count

  cat .judge/abc1234/coverage.json | jq '.packages["core"].lines.pct'
  # expected: >= 80.0

Evidence checklist:
  [x] .judge/abc1234/stdout.txt      saved
  [x] .judge/abc1234/coverage.json   saved
  [x] .judge/abc1234/judge.json      saved (exit_code:0, lines_pct:83.2)

Anti-mock checklist:
  [x] No it.skip or test.skip in diff
  [x] No TODO: test later in diff
  [x] billing_v2 itself not mocked in its own tests
  [x] No istanbul ignore added
  [x] Coverage delta: +2.1% (was 81.1%, now 83.2%)

Trap-awareness checklist:
  [x] TRAP-REVIEW-002 — confirmed read; verified no it.skip added
  [x] TRAP-OPS-011 — confirmed read; .judge/ saved before commit

Reviewer hand-off:
  Reviewer: @alice (backend)
  Artifacts: PR #77, .judge/abc1234/ directory
  Review deadline: 2026-05-02 14:00 UTC
```

---

## Common loopholes (rejected)

These five patterns make an issued task unacceptable. If you see any in a task description, reject it before assigning to an agent.

**1. Vague scope ("clean up the code", "improve performance")**
No concrete file paths, no measurable target. Agent cannot know what to touch or when to stop. Fix: name exact files and a numeric target (e.g., "reduce p99 latency in `packages/core/src/scorer.ts` from 120ms to <80ms, measured by benchmark in `bench/scorer.bench.ts`").

**2. Mock-pass success criteria ("CI is green", "tests pass")**
CI can be green with zero new tests for new code. "Tests pass" allows `it.skip`. Fix: require the anti-mock checklist + a numeric coverage delta + the exact shell command from §Success criteria.

**3. No evidence checklist**
Agent claims completion verbally; reviewer has nothing to audit. Fix: §Evidence checklist is mandatory; `.judge/<run_id>/judge.json` must exist before the task is considered closed.

**4. No anti-mock list**
Agent skips failing tests with `it.skip` or adds `/* istanbul ignore */` to hit coverage targets. CI passes; actual behavior is untested. Fix: §Anti-mock checklist is mandatory; reviewer greps for skip/ignore patterns.

**5. Context links point to ephemeral sources ("see Slack", "I mentioned it yesterday")**
Link rots within days; future audit is impossible. Fix: §Context links must point to a permanent URL (GitHub issue/PR) or a quoted line from a committed file.
