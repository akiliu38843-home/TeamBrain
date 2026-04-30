```
   H2-6 skeleton   →   H6-12 reviewer pass   →   H12-24 Real Task #1
   ┌──────────┐         ┌──────────────┐         ┌──────────┐
   │ 8 commits│         │  CONVERGENCE │         │  blocked │
   │ landed   │ ──────▶ │   P0/P1/P2   │ ──────▶ │  until   │
   │ atomic   │         │   findings   │         │  cleanup │
   └──────────┘         └──────┬───────┘         └──────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │ cleanup queue│
                        │  for human   │
                        │  + writers   │
                        └──────────────┘
```

# CONVERGENCE.md — H6-12 Reviewer Pass

Independent Opus reviewer audit of the 8 atomic skeleton commits landed by sonnet writers in H2-6. This file is the only artifact written during H6-12; the 8 reviewed files are NOT modified here — fixes go onto the cleanup queue and are executed by the listed owners or a human pass before H12-24.

---

## Verdict

**`CLEANUP-REQUIRED`**

P0 count: **6** — schema drift between TRAPS.md and TRAP_FORMAT.md is total. Every P0 trap row uses different field names than the spec; every P1/P2 row drops two of seven required columns; recipe-ID regex is violated by examples in TASK_TEMPLATE. A linter built from TRAP_FORMAT.md `lint-trap.sh` would reject 100% of TRAPS.md entries today. Real Task #1 cannot start on this skeleton without a cleanup pass — verify hooks would either be unrunnable or fall back to verbal review.

---

## Findings by severity

### P0 — must fix before H12-24

#### F-P0-1 — TRAPS.md P0 deep-dive uses hyphenated/space field names; spec mandates underscores
- **file**: `docs/teambrain/TRAPS.md:28-32, 40-44, 52-56, 64-68, 76-80`
- **quote**: `- **wrong-pattern**: ...` / `- **right-pattern**: ...` / `- **evidence link**: ...` / `- **verify hint**: ...`
- **spec**: `docs/teambrain/TRAP_FORMAT.md:29-35` requires `wrong_pattern`, `right_pattern`, `verify_command`, `evidence_link` (underscores, no spaces).
- **impact**: Every TRAP_FORMAT lint script (`yq ".$field"`, line 95-101 of TRAP_FORMAT.md) would report `FAIL: required field 'wrong_pattern' is missing or empty` for all 5 P0 entries. Schema is mechanically unenforceable.
- **fix**: Either (a) re-curate TRAPS.md P0 entries to use underscored field names matching TRAP_FORMAT.md exactly, or (b) extend TRAP_FORMAT.md to declare hyphenated/spaced labels as valid aliases with an explicit normalizer.
- **owner**: traps-curator (option a is faster; pure rename of 5 × 5 = 25 labels).

#### F-P0-2 — TRAPS.md P1/P2 table is 5 columns; spec mandates 7
- **file**: `docs/teambrain/TRAPS.md:87`
- **quote**: `| id | category | wrong | right | severity |`
- **spec**: `docs/teambrain/TRAP_FORMAT.md:79` — `Column order: id | category | severity | wrong_pattern | right_pattern | verify_command | evidence_link`. Bulk validator at TRAP_FORMAT.md:139-144 asserts `NF>=8` (7 fields + leading/trailing pipes). Current rows have NF=6 → `FAIL row ...: col 6 empty`.
- **impact**: 30 of 35 P1/P2 entries (TRAP-GIT-002 through TRAP-COOP-010) have **no verify_command** and **no evidence_link**. They are unverifiable and unsourced — exactly the "verbal rule" failure mode the bootstrap §H6-12 rule 3 forbids. Column order is also reordered (severity moved to col 5 from col 3).
- **fix**: Re-emit P1/P2 table with all 7 columns; for each row, populate verify_command (shell one-liner OR `VERIFY_TEMPLATE:<recipe_id>`) and evidence_link (Day 0 dump §A-D trap #N anchor). Many already exist in the trap text — the dump line numbers are in `docs/notes/2026-05-01-day0-team-experience-dump.md`.
- **owner**: traps-curator.

#### F-P0-3 — TRAPS.md `category` values violate TRAP_FORMAT enum
- **file**: `docs/teambrain/TRAPS.md:38, 50`
- **quote**: line 38 `- **category**: review / testing`; line 50 `- **category**: testing`
- **spec**: `docs/teambrain/TRAP_FORMAT.md:30` — `category enum {git, review, ops, coop, security, docs}`. Lint check at TRAP_FORMAT.md:111-115 rejects anything not in this set.
- **impact**: TRAP-TEST-001 and TRAP-TEST-002 fail enum validation. The id prefix `TRAP-TEST-` is also not derivable from any allowed category — implies an undocumented `testing` category exists.
- **fix**: Pick one path: (a) remap to `category: review` and rename ids to `TRAP-REVIEW-001/002`, or (b) extend the enum in TRAP_FORMAT.md to add `testing` and update the id-prefix mapping note.
- **owner**: trap-format-author + traps-curator (cross-file decision).

#### F-P0-4 — TASK_TEMPLATE Success criteria example violates VERIFY recipe regex
- **file**: `docs/teambrain/TASK_TEMPLATE.md:117`
- **quote**: `- A \`VERIFY_TEMPLATE.md\` recipe ID (e.g., \`VERIFY#unit-pass-coverage-80\`).`
- **spec**: `docs/teambrain/VERIFY_TEMPLATE.md:28` — `recipe_id: regex ^VERIFY-[A-Z]+-\d{3}$`. The example uses `#` separator and lowercase tail; matches no recipe.
- **impact**: A reviewer who copies this example into a real task would fail VERIFY harness validation. Per VERIFY_TEMPLATE.md:127 cross-reference: "A task with a success criterion that does not point to a VERIFY recipe is incomplete" — every task built from this template inherits an invalid example.
- **fix**: Replace the example with a regex-conformant id, e.g. `VERIFY-PNPM-001` (already used in VERIFY_TEMPLATE.md:91 sample).
- **owner**: task-template-author.

#### F-P0-5 — TASK_TEMPLATE Trap-awareness uses `TRAP#<slug>` not `TRAP-<CAT>-<NNN>`
- **file**: `docs/teambrain/TASK_TEMPLATE.md:181-183, 253-254`
- **quote**: `[ ] TRAP#git-force-push — confirmed read; will use --force-with-lease` (and 4 others in the example).
- **spec**: `docs/teambrain/TRAP_FORMAT.md:29` — `id regex ^TRAP-[A-Z]+-\d{3}$`. No `TRAP#<slug>` form is defined.
- **impact**: Cross-reference verify hook at TASK_TEMPLATE.md:187 ("Reviewer cross-checks listed IDs against TRAPS.md") fails — the slugs cannot be grepped against TRAPS.md ids. Bootstrap §H6-12 rule 1 (vague rules) — slugs that don't match any concrete trap entry are mechanically unverifiable.
- **fix**: Replace each `TRAP#<slug>` with the actual id from TRAPS.md. Mapping for the 3 used: `TRAP#git-force-push` → `TRAP-GIT-001`; `TRAP#mock-coverage` → `TRAP-TEST-002`; `TRAP#missing-evidence` → no current trap (create one or remove the line).
- **owner**: task-template-author.

#### F-P0-6 — Two commit anchor formats; VERIFY-CLAUDE-005 grep misses Codex commits
- **file**: `docs/teambrain/agent_rules/claude.md:20` vs `docs/teambrain/agent_rules/codex.md:23-24`
- **quote**: claude.md says `TRAPS-READ: confirmed P0 entries seen: <comma-separated trap IDs>` (uppercase, colon+space, prose tail). codex.md says `traps-read: P0=[<trap-ids checked>] relevant=[<trap-ids that apply>]` (lowercase, structured tail).
- **spec**: claude.md:163 — `VERIFY-CLAUDE-005` greps "first commit message in session for `TRAPS-READ:` anchor; missing = fail." That regex is uppercase-only; Codex commits with `traps-read:` would all fail it.
- **impact**: Reviewer harness flags every Codex agent's first commit as missing the anchor, even when the anchor is present in the codex.md format. False-positive rejection of every Codex run.
- **fix**: Pick one canonical anchor — either both files use `traps-read:` lowercase + structured tail, or both use `TRAPS-READ:` uppercase + prose tail. Update VERIFY-CLAUDE-005 grep accordingly. Recommend the lowercase structured form (codex.md style) — it's more parseable.
- **owner**: claude-rules-author + codex-rules-author (cross-file decision).

---

### P1 — fix during H6-12 cleanup

#### F-P1-1 — TRAP-TEST-002 verify hint falls back to "reviewer sign-off"
- **file**: `docs/teambrain/TRAPS.md:56`
- **quote**: `any ratio > 0.5 is a smell requiring reviewer sign-off`
- **rule**: Bootstrap plan §H6-12 reviewer rule 3 — every rule must be ground-truth verifiable, "靠人审" is rejected. TRAP_FORMAT.md:34 also forbids verify_command containing "manual" or "靠人审" (English equivalent: "reviewer sign-off" is verbal review).
- **fix**: Replace the soft fallback with a numeric gate: e.g. `mock_count=$(grep -rcE 'jest\.mock|vi\.mock' packages/ --include='*.test.ts'); test_count=$(find packages -name '*.test.ts' | wc -l); ratio=$(echo "$mock_count / $test_count" | bc -l); [ "${ratio%.*}" -lt 1 ] || exit 1` and define what threshold means automatic fail vs warn.
- **owner**: traps-curator.

#### F-P1-2 — TRAP-OPS-001 verify hint mixes assertion with "must show" prose
- **file**: `docs/teambrain/TRAPS.md:68`
- **quote**: `must show staged percentages and rollback job`
- **issue**: The grep returns lines but the hint asks the reader to eyeball the output. No exit-code gate. Spec at VERIFY_TEMPLATE.md:118 forbids "exit-code-only check"; here we have the inverse — output-without-assertion. Both should be present.
- **fix**: Add a positive assertion, e.g. `grep -E "5%|15%|50%|100%" .github/workflows/*.yml | wc -l` must be ≥ 4, and a separate `grep -l rollback .github/workflows/*.yml` must return ≥ 1 file.
- **owner**: traps-curator.

#### F-P1-3 — TRAP-COOP-001 verify hint depends on filesystem date math without portable command
- **file**: `docs/teambrain/TRAPS.md:80`
- **quote**: `most recent file must be within 24h of current on-call shift start`
- **issue**: "Within 24h" requires `find -mtime -1` or `stat -f %m` (BSD) vs `stat -c %Y` (GNU). The hint uses `ls -lt | head -1` which doesn't assert age, only ordering.
- **fix**: Replace with `find docs/oncall -name 'handoff-*.md' -mtime -1 | head -1 | xargs wc -l | awk '$1 < 10 { exit 1 }'` and document GNU vs BSD `find` portability.
- **owner**: traps-curator.

#### F-P1-4 — TRAP-TEST-001 verify hint regex too narrow (TS only)
- **file**: `docs/teambrain/TRAPS.md:42`
- **quote**: `grep -r "TODO.*test\|later.*test\|add.*test" --include="*.ts" src/`
- **issue**: TeamBrain scope at README.md:18 is "Markdown, prompts, and scripts only". The TS-scoped grep does not match the project. Also `src/` is not a TeamBrain canonical path.
- **fix**: Reframe to scan `docs/teambrain/**/*.md` (or whatever real surface area applies). If the trap is meant to apply downstream when TeamBrain rules are imported into a code repo, mark it as scope-conditional and list the env precondition (e.g., `[ -d src/ ] || exit 0`).
- **owner**: traps-curator.

#### F-P1-5 — STRUCTURE.md tree shows 9 files but registry lists 9 (incl. CONVERGENCE.md not yet written by writers)
- **file**: `docs/teambrain/STRUCTURE.md:12, 45-46`
- **quote**: tree includes `CONVERGENCE.md ← H6-12 reviewer convergence`; registry §`CONVERGENCE.md` says it's "Written by the Opus reviewer agent during H6-12."
- **issue**: Not a defect — STRUCTURE.md correctly anticipates this file. Flagged only because Reviewer mandate cross-check E asks "STRUCTURE.md lists all 8 produced files correctly". STRUCTURE.md lists 9 (8 writer files + CONVERGENCE.md), and the 9th is the file being created right now. PASS — but verify the row gets a real status once this commit lands.
- **fix**: After this CONVERGENCE.md is committed, no STRUCTURE.md change is required. The "Ground-truth verifiable" line at STRUCTURE.md:46 should be re-checked: "every file in the tree above appears as a row with a pass/fail status" — this CONVERGENCE.md provides those statuses below in the consistency matrix.
- **owner**: skeleton-architect (no-op confirm).

#### F-P1-6 — TASK_TEMPLATE example uses `feat(m1):` Milestone naming from CLAUDE.md but TeamBrain has no Milestones
- **file**: `docs/teambrain/TASK_TEMPLATE.md:103, 231`
- **quote**: `Commit message: feat(m1): add billing_v2 feature flag to core`
- **issue**: The `m{N}` Milestone scope is from the host TeamAgent project's CLAUDE.md "Doing tasks → commit message format". TeamBrain itself does not use Milestones — bootstrap plan organizes by Hour, not Milestone.
- **fix**: Either drop the `m{N}` example and use a TeamBrain-native scope like `feat(teambrain):` (consistent with the 8 H2-6 commits), OR call out explicitly that `m{N}` is the host-project scope and `teambrain` is the in-bootstrap scope.
- **owner**: task-template-author.

#### F-P1-7 — agent_rules/claude.md line 5 ASCII flow shows `TRAPS.md → TASK` but does not name TASK_TEMPLATE.md
- **file**: `docs/teambrain/agent_rules/claude.md:4-11`
- **issue**: Cosmetic — flow diagram has `TASK` cell, the body has §1 trap discovery + §2 FASTPROBE but never says "open TASK_TEMPLATE.md and fill it". codex.md:5 has the same pattern.
- **fix**: Add a one-liner "open TASK_TEMPLATE.md and fill ALL 10 sections before any code change" near the trap-discovery §1 in both files.
- **owner**: claude-rules-author + codex-rules-author.

---

### P2 — note for later (do not block H12-24)

#### F-P2-1 — TRAP_FORMAT.md anti-pattern BAD-1 example reuses id `TRAP-OPS-001` already used as a real P0 in TRAPS.md
- **file**: `docs/teambrain/TRAP_FORMAT.md:154` reuses `id: TRAP-OPS-001` which is a real P0 entry in TRAPS.md:62. Future readers may grep for that id and find both. Cosmetic.

#### F-P2-2 — README.md "Where to Find What" table omits CONVERGENCE.md
- **file**: `docs/teambrain/README.md:62-70`
- After CONVERGENCE.md exists, the table should include it. Low priority — STRUCTURE.md already covers it.

#### F-P2-3 — claude.md and codex.md disagree on `--force-with-lease` allowed scope
- claude.md:69 — "Use `--force-with-lease` on your own branch only".
- codex.md:101 — "allowed only on a branch you created in this task".
- "Own branch" vs "branch you created in this task" are subtly different; pick one phrasing.

---

## Cross-file consistency matrix

| Check | Subject | Verdict | Notes |
|-------|---------|---------|-------|
| A | TRAPS.md uses TRAP_FORMAT schema (id regex, required fields) | **FAIL** | F-P0-1, F-P0-2, F-P0-3 |
| B | TASK_TEMPLATE Success criteria points to VERIFY recipe id matching regex | **FAIL** | F-P0-4 (example uses invalid `VERIFY#...` form) |
| C | TRAP_FORMAT verify_command allows VERIFY recipe ids | **PASS** | TRAP_FORMAT.md:34 explicitly allows `VERIFY_TEMPLATE:<recipe_id>` |
| D | agent_rules reference TRAPS / TASK_TEMPLATE / VERIFY canonical paths | **PARTIAL** | claude.md and codex.md both name TRAPS.md and VERIFY_TEMPLATE.md, but neither names TASK_TEMPLATE.md by path (F-P1-7). |
| E | STRUCTURE.md lists 8 produced files correctly | **PASS** | All 8 + reviewer-owned CONVERGENCE.md listed; ownership labels match commit authors. |
| F | ASCII art header on every NEW .md (per AGENTS.md rule 10) | **PASS** | All 8 files lead with an ASCII block in the first 15 lines; TRAP_FORMAT.md and VERIFY_TEMPLATE.md put the title heading on line 1 and the ASCII block immediately after — borderline but accepted. |
| G | README.md 5-min onboarding flow executable end-to-end | **PARTIAL** | Step 4 says "Execute the commands listed in VERIFY_TEMPLATE.md for your task type" — but VERIFY_TEMPLATE.md has only one example recipe and the cross-reference back is via TASK_TEMPLATE only. A new agent following the flow has no concrete recipe to run yet. Not a P0 — Real Task #1 will instantiate one. |
| H | FASTPROBE batch ≤ 2 cap honored in teambrain docs | **PASS** | claude.md:31, 39, 61 explicit; codex.md does not mention FASTPROBE (Codex doesn't use claudefast as a subprocess) — out of scope. |
| I | `code <path>` rule (AGENTS.md rule 13) — no doc tells agent to `code` non-plan/research/report file | **PASS** | claude.md:72 names the rule and lists allowed paths only; no other file invokes `code <path>`. |
| J | Atomic commits — 8 sequential commits, 1 file each | **PASS** | `git log --oneline` 529a6a7..6fa6a2c shows 8 commits, each with a single `feat(teambrain):` subject. Order: STRUCTURE → README → TRAP_FORMAT → VERIFY_TEMPLATE → TRAPS → TASK_TEMPLATE → claude.md → codex.md. |

---

## Reviewer rule audit (§H6-12 rules 1-3)

### Rule 1 — Vague rules ("write good code", "stay clean", "be careful") rejected

| File | Vague lines found | Verdict |
|------|-------------------|---------|
| STRUCTURE.md | none | PASS |
| README.md | none — anti-patterns at line 86-93 are concrete | PASS |
| TRAPS.md | F-P1-1 ("requiring reviewer sign-off"), F-P1-4 (TS-only grep on a Markdown-only project) | **PARTIAL** |
| TRAP_FORMAT.md | none — every field has a Ground-Truth Check column | PASS |
| TASK_TEMPLATE.md | none — every section has a Verify hook | PASS |
| VERIFY_TEMPLATE.md | none — bedrock principle is the rule | PASS |
| agent_rules/claude.md | none — every AP has a Catch line | PASS |
| agent_rules/codex.md | none — every AP has a Why line | PASS |

### Rule 2 — Mock loopholes ("skip if", "allow if no test", "optional if") must carry ⚠️ explicit flag

| File | Loophole-bearing lines | ⚠️ flagged? | Verdict |
|------|------------------------|--------------|---------|
| TRAPS.md:40 | "PR merged with TODO: test ... ⚠️ MOCK LOOPHOLE" | YES | PASS |
| TRAPS.md:52 | "jest.mock... ⚠️ MOCK LOOPHOLE" | YES | PASS |
| TRAPS.md:76 | "verbal-only rule ⚠️" | YES | PASS |
| TRAPS.md:102 | TRAP-TEST-008 row mentions `/* istanbul ignore */` with ⚠️ | YES | PASS |
| TASK_TEMPLATE.md:153-172 | §8 Anti-mock checklist enumerates 5 items | implicit (whole section is the flag) | PASS |
| agent_rules/claude.md:111-115 | AP-3 mock loophole | section header is the flag | PASS |
| **No file uses unflagged "skip if" or "allow if no test" language.** | | | PASS overall |

### Rule 3 — Every rule/trap/task has executable verify command + expected output

| File | Verify presence | Verdict |
|------|-----------------|---------|
| STRUCTURE.md | every §file-by-file has "Ground-truth verifiable" line with a shell command | PASS |
| README.md | Step 4 of onboarding flow points at VERIFY_TEMPLATE.md | PASS (transitive) |
| TRAPS.md P0 | each P0 has a verify hint, but: F-P1-1 falls back to verbal review; F-P1-2 lacks assertion; F-P1-3 lacks portable command | **PARTIAL** |
| TRAPS.md P1/P2 | F-P0-2: 30 of 35 rows have NO verify_command column at all | **FAIL** |
| TRAP_FORMAT.md | full lint script at line 88-133 | PASS |
| TASK_TEMPLATE.md | every section §1-§10 has a "Verify hook" line | PASS |
| VERIFY_TEMPLATE.md | full 3-stage harness at line 39-84 | PASS |
| agent_rules/claude.md | every AP has a Catch line; recipe table at line 158-163 | PASS |
| agent_rules/codex.md | every AP has a Why line; recipe table at line 184-187 | PASS |

---

## Cleanup queue (H6-12 Human pass)

Ordered by dependency — earlier items unblock later items. Each item maps to a finding above and names the writer who originally produced the file. Map of bootstrap §H6-12 "Human" actions: (1) "删除废话" → covered by P1/P2 entries below; (2) "保留硬规则" → all P0 fixes preserve the underlying rule, only fix mechanical enforceability; (3) "补充真实失败案例" → already done in TRAPS.md (Day 0 dump §A-D linked from each P0 — F-P0-2 fix surfaces the same links into the P1/P2 rows).

| # | Finding | Action | Owner | Blocks H12-24? |
|---|---------|--------|-------|----------------|
| 1 | F-P0-1 | Rename TRAPS.md P0 field labels to underscored spec form (5 entries × 5 labels) | traps-curator | YES |
| 2 | F-P0-2 | Re-emit P1/P2 table with 7 columns (id\|category\|severity\|wrong_pattern\|right_pattern\|verify_command\|evidence_link); populate verify_command and evidence_link for all 35 rows | traps-curator | YES |
| 3 | F-P0-3 | Decide `category: testing` enum vs rename to `review`; update TRAP_FORMAT or TRAPS accordingly | trap-format-author + traps-curator | YES |
| 4 | F-P0-4 | Replace `VERIFY#unit-pass-coverage-80` example with `VERIFY-PNPM-001` or another regex-conformant id | task-template-author | YES |
| 5 | F-P0-5 | Replace 5 `TRAP#<slug>` references in TASK_TEMPLATE example with `TRAP-GIT-001` / `TRAP-TEST-002` / decide on a missing-evidence trap | task-template-author | YES |
| 6 | F-P0-6 | Pick one anchor format; update both agent_rules files + VERIFY-CLAUDE-005 grep | claude-rules-author + codex-rules-author | YES |
| 7 | F-P1-1 | Replace "reviewer sign-off" verbal fallback in TRAP-TEST-002 with numeric gate | traps-curator | NO (warn) |
| 8 | F-P1-2 | Add positive assertion to TRAP-OPS-001 verify hint | traps-curator | NO |
| 9 | F-P1-3 | Replace ls-based age check with portable `find -mtime` in TRAP-COOP-001 | traps-curator | NO |
| 10 | F-P1-4 | Reframe TRAP-TEST-001 grep to TeamBrain scope (or mark scope-conditional) | traps-curator | NO |
| 11 | F-P1-6 | Decide TASK_TEMPLATE example commit scope `m{N}` vs `teambrain` | task-template-author | NO |
| 12 | F-P1-7 | Add "open TASK_TEMPLATE.md before any code change" line to both agent_rules files | claude-rules-author + codex-rules-author | NO |
| 13 | F-P2-1, F-P2-2, F-P2-3 | Cosmetic — bundle into one cleanup commit after Real Task #1 | any | NO |

**Definition of CLEANUP-DONE**: items 1-6 fixed. After that, verdict re-evaluates to `READY` and Real Task #1 may start. Items 7-13 are recommended for the same cleanup pass but not blocking.

---

## Sign-off block

| Field | Value |
|-------|-------|
| Reviewer | convergence-reviewer (Opus, teammate on team `teambrain-day1`) |
| Reviewed commits (8 atomic) | 529a6a7, 8519046, 75a95c4, ebc321a, 7e7288c, dad4222, c6a4886, 6fa6a2c |
| Source-of-truth refs | `docs/specs/2026-05-01-teambrain-72h-bootstrap.md` §H6-12, §Success Bar, §Anti-pattern; `docs/notes/2026-05-01-day0-team-experience-dump.md` |
| Reviewer mandate | bootstrap §H6-12 rules 1-3 + cross-cutting checks A-J |
| Files reviewed (not modified) | STRUCTURE.md, README.md, TRAPS.md, TRAP_FORMAT.md, TASK_TEMPLATE.md, VERIFY_TEMPLATE.md, agent_rules/claude.md, agent_rules/codex.md |
| Files written by reviewer | docs/teambrain/CONVERGENCE.md (this file); `docs/specs/2026-05-01-teambrain-72h-bootstrap.md` §DAY 1 H2-6 row updated to ⚠️ |
| Timestamp | 2026-05-01 |
| Verdict | CLEANUP-REQUIRED (P0=6, P1=7, P2=3) |
| Next phase pointer | Hour 12-24 Real Task #1 — BLOCKED until cleanup queue items 1-6 are committed. After cleanup, owner restarts H12-24 per bootstrap plan §Hour 12-24. |

---

```
   ROUND 1                ROUND 2 (this section)
   ┌──────────┐           ┌──────────────┐
   │ P0 = 6   │           │ verify each  │
   │ P1 = 7   │ ────────▶ │  cleanup hit │
   │ P2 = 3   │           │  end-state   │
   └──────────┘           └──────┬───────┘
                                 │
                                 ▼
                          CLEANUP-REQUIRED
                          (1 residual P1)
```

# Second-pass sign-off — Opus reviewer 2

Independent re-audit of the 9 cleanup commits (incl. 3 supplementary that landed after the original 6) routed back to the writers after 1st-pass verdict `CLEANUP-REQUIRED`. End-state diff vs `c6a4886` re-examined; this section appended only — no 1st-pass content rewritten.

## Verdict

**`CLEANUP-REQUIRED`** — 1 residual P1.

P0 remaining: **0** (all 6 resolved). P1 remaining: **1** (F-P1-6 leaked, only TASK_TEMPLATE.md was patched; `agent_rules/codex.md:99` still reads `feat(m{N})`). P2 deferred per 1st-pass instructions.

H12-24 Real Task #1 is **NEAR-READY** — the residual is a single one-line fix; not a structural blocker. Reviewer chooses CLEANUP-REQUIRED over READY because mandate states any P1 leak prevents sign-off. Recommend immediate follow-up commit by codex-rules-author then auto-promote to READY.

## Per-finding resolution table

| Finding | 1st-pass | Cleanup commit(s) | END-STATE verify | Resolved? |
|---------|---------|-------------------|------------------|-----------|
| F-P0-1 (hyphen→underscore) | FAIL | 2e3d936 | `grep -c "wrong-pattern\|right-pattern" TRAPS.md` = 0; underscore variants = 5 each | ✅ Y |
| F-P0-2 (5→7 cols, 35 rows) | FAIL | 2e3d936 | awk lint: PASS rows 35/35, all evidence_link populated | ✅ Y |
| F-P0-3 (testing→review enum) | FAIL | 2e3d936 | `grep "category: testing\|TRAP-TEST-" TRAPS.md` = 0; categories ⊆ {git, review, ops, coop} | ✅ Y |
| F-P0-4 (VERIFY# slug) | FAIL | 49d3fcb, c451f3a | TASK_TEMPLATE.md:117 = `VERIFY-PNPM-001` (regex-match) | ✅ Y |
| F-P0-5 (TRAP# slug) | FAIL | 49d3fcb, c451f3a | TASK_TEMPLATE.md:181-183, 253-254 use `TRAP-GIT-001 / TRAP-REVIEW-002 / TRAP-OPS-011` | ✅ Y |
| F-P0-6 (anchor format) | FAIL | 140e134, a6ffa71, 211e372 | claude.md:20,22,171 + codex.md:24,99 all lowercase `traps-read:`; VERIFY-CLAUDE-005 grep updated | ✅ Y |
| F-P1-1 (sign-off fallback) | PARTIAL | 2318a77, 69170dc | TRAP-REVIEW-002 verify_command uses `awk` ratio > 0.5 → exit 1, no "sign-off" string | ✅ Y |
| F-P1-2 (assertion missing) | PARTIAL | 2318a77, 799430f | TRAP-OPS-001 prints PASS or FAIL via `grep -qE "\b(5\|10)\b" && grep -q "rollback"` | ✅ Y |
| F-P1-3 (portable date math) | PARTIAL | 2318a77, 1d2d9cc | TRAP-COOP-001 uses `find -mtime -1` with portability note; lines ≥ 10 gate | ✅ Y |
| F-P1-4 (TS-only grep) | PARTIAL | 2318a77 | TRAP-REVIEW-001 scopes to `docs/`, conditional on repo type | ✅ Y |
| F-P1-5 (STRUCTURE no-op) | PARTIAL | n/a (confirm) | STRUCTURE.md:46 row reads against this file ✓ | ✅ Y |
| F-P1-6 (m{N}→teambrain) | PARTIAL | 0b22a41 | **TASK_TEMPLATE.md:103, 231 fixed; codex.md:99 STILL `feat(m{N})`** | ❌ **N** |
| F-P1-7 (TASK_TEMPLATE pointer) | PARTIAL | 140e134, fa05230, 211e372 | claude.md §1.5 + codex.md §1.5 both name TASK_TEMPLATE.md by path | ✅ Y |

## New checks K-N

| Check | Result | Notes |
|-------|--------|-------|
| K — TRAP-OPS-011 absorbed in 7-col table | ⚠️ PARTIAL | Row present (`TRAPS.md:113`); verify_command + evidence_link populated. Severity kept at **P0** (not reclassified to P1 as instructed). Defensible: bootstrap constraint is hard-blocking. Flagged advisory only. |
| L — Legacy aliases eradicated | ✅ PASS | `grep -rn "TRAP#\|VERIFY#\|TRAP-TEST-\|TRAPS-READ:\|category: testing"` in 8 reviewed files = 0 hits. All hits are inside CONVERGENCE.md narrative quotes (acceptable). |
| M — Anchor consistency | ✅ PASS | `traps-read:` lowercase identical in claude.md:20 + codex.md:24. VERIFY-CLAUDE-005 (claude.md:171) regex `^traps-read: P0=\[` matches both. |
| N — claude.md end-state cleanliness | ✅ PASS | 173 lines, 1 H1 + 6 numbered H2 (incl. §1.5) + 7 AP H3 — no orphans, no duplicates from the 140e134→a6ffa71→fa05230 sequence. Atomic-commit redundancy is acceptable; end-state is correct. |

## TRAP_FORMAT lint result

`awk -F'|' 'NR>2 && /^\| TRAP-/ && NF>=8 { ... }'` against `docs/teambrain/TRAPS.md` P1/P2 table:

- **PASS rows**: **35 / 35**
- **FAIL rows**: 0
- All 7 columns populated for every row including TRAP-OPS-011.

P0 deep-dives (5) all use underscored field labels (`wrong_pattern`, `right_pattern`, `verify_command`, `evidence_link`); 0 hyphenated variants.

## Cleanup queue (residual)

| # | Finding | Action | Owner | Blocks H12-24? |
|---|---------|--------|-------|----------------|
| 1 | F-P1-6 (codex side) | Replace `feat(m{N})` at `agent_rules/codex.md:99` with `feat(teambrain)`; align with claude.md convention. One-line edit. | codex-rules-author | NO (warn-level) |
| 2 | Check K advisory | Optional: reclassify TRAP-OPS-011 severity from P0 → P1 if owner agrees it is enforcement-not-failure. Keep P0 if treating "no evidence" as P0 incident. | traps-curator | NO |

## Sign-off block (2nd pass)

| Field | Value |
|-------|-------|
| Reviewer | convergence-reviewer-2 (Opus, teammate on team `teambrain-day1`) |
| Reviewed cleanup commits | 2e3d936, 2318a77, 49d3fcb, c451f3a, 0b22a41, 140e134, a6ffa71, fa05230, 211e372 (+ supplementary 799430f, 1d2d9cc, 69170dc) |
| Source-of-truth refs | 1st-pass CONVERGENCE.md sections above; bootstrap §H6-12 rules 1-3; checks A-J (1st pass) + K-N (this pass) |
| Files re-examined (not modified) | TRAPS.md, TRAP_FORMAT.md, TASK_TEMPLATE.md, VERIFY_TEMPLATE.md, README.md, STRUCTURE.md, agent_rules/claude.md, agent_rules/codex.md |
| TRAP_FORMAT lint | 35/35 PASS |
| Checks K, L, M, N | PARTIAL (advisory), PASS, PASS, PASS |
| Timestamp | 2026-05-01 |
| Verdict | **CLEANUP-REQUIRED** (P0=0, P1=1, P2=3 deferred) |
| Next phase pointer | (a) codex-rules-author lands one-line `m{N}→teambrain` fix; (b) reviewer flips to READY without re-audit; (c) Hour 12-24 Real Task #1 may begin. Spec H2-6 row stays ⚠️ until step (a) lands. |

---

## Final READY sign-off (post-residual fix)

The 2nd-pass reviewer pre-approved promotion to `READY` once the one-line residual P1 (codex.md:99) lands, with no 3rd-pass audit required.

| Field | Value |
|-------|-------|
| Residual P1 fix commit | `283f5a4` — `fix(teambrain): codex.md commit-msg example feat(m{N}) → feat(teambrain)` |
| Verification | `grep -c 'feat(m' docs/teambrain/agent_rules/codex.md` = 0 (codex-rules-author confirmed; lead re-verified) |
| Final P0/P1/P2 counts | P0=0 resolved, P1=0 remaining, P2=3 deferred (per 1st-pass guidance, bundle after Real Task #1) |
| Final verdict | **READY** |
| Promoted by | team-lead (per pre-approval from convergence-reviewer-2 sign-off block above) |
| Timestamp | 2026-05-01 |
| Spec update | `docs/specs/2026-05-01-teambrain-72h-bootstrap.md` Day 1 H2-6 / H6-12 rows flipped from ⚠️ CLEANUP-REQUIRED to ✅ DONE in the same atomic-commit pass |
| Hour 12-24 (Real Task #1) | Unblocked from cleanup; remains pending owner-provided real task per bootstrap §Hour 12 – 24 |
| Cleanup-loop summary | Round 1 review → 6 P0 + 7 P1 + 3 P2 found → routed to 4 owners via SendMessage → 11 atomic cleanup commits landed → Round 2 review → 1 residual P1 found → routed to codex-rules-author → 1 atomic fix `283f5a4` → READY. Total cleanup rounds: 2 of 3 cap. |

