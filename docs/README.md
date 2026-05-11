# TeamAgent Docs

This directory is a map of TeamAgent's product, architecture, and milestone
history. Most source documents are intentionally kept as dated records; use
the indexes below to choose what to read first.

## Start Here

### Product & positioning

| Goal | Read |
| --- | --- |
| Understand the product quickly | [系统展示.md](系统展示.md) |
| See the three business features pitched to non-builders | [BUSINESS-FEATURES.md](BUSINESS-FEATURES.md) |
| See the full 64-row engineering feature inventory (verified + not-yet) | [PRODUCT-FEATURES.md](PRODUCT-FEATURES.md) |
| Look up per-feature canned answers (auto-capture, real-time intercept, calibrator, team-share, multi-tool) | [features/INDEX.md](features/INDEX.md) |
| Author / extend a feature canned answer (6-section template, status enum, line budget) | [features/CONVENTIONS.md](features/CONVENTIONS.md) |
| Understand the agentic-coding contract (boundaries, expectations) | [AGENTIC-CODING-POLICY.md](AGENTIC-CODING-POLICY.md) |

### Architecture & mechanics

| Goal | Read |
| --- | --- |
| Understand the architecture shape | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Look up implementation details | [SYSTEM.md](SYSTEM.md) |
| Map the project's runtime tools | [PROJECT-TOOLS.md](PROJECT-TOOLS.md) |
| Understand domain terminology and glossary | [CONTEXT.md](CONTEXT.md) |
| Understand project knowledge propagation | [knowledge/INDEX.md](knowledge/INDEX.md) |

### Workflow — issue → PR → merge

| Goal | Read |
| --- | --- |
| Read the canonical issue → PR → merge workflow (FIXEDFLOW) | [FIXEDFLOW.md](FIXEDFLOW.md) |
| Know what to do after claiming an issue | [HOW-TO-CLAIM-ISSUE.md](HOW-TO-CLAIM-ISSUE.md) |
| Triage a grilled large issue and split into smaller ones | [TRIAGE-AND-SPLIT.md](TRIAGE-AND-SPLIT.md) |
| Plan a PR — what to write, what to ship, how to verify, which probes to run | [HOWTO-PLAN-PR.md](HOWTO-PLAN-PR.md) |
| Pace commits, PRs, and merges (atomic-commits → squash-merge) | [COMMIT-FLOW.md](COMMIT-FLOW.md) |
| Fix issues discovered after the PR is open (PR-PLAN, never follow-up issue) | [PR-PLAN.md](PR-PLAN.md) |
| Run the after-`/review`-PASS post-PR cleanup (squash + worktree exit + main pull) | [POSTPR.md](POSTPR.md) |
| Run multiple agents in parallel using the N+1+(2N) teamwork pattern | [TEAMWORK.md](TEAMWORK.md) |
| Locate the `plan.md` / `research.md` / `report.md` project-level rules | [PLAN-RESEARCH-REPORT.md](PLAN-RESEARCH-REPORT.md) |
| Write post-mortems (schema + sister-doc rules) | [POSTMORTEM.md](POSTMORTEM.md) |
| Look up the isolated worktree provider (`.codex/worktrees/issue-<N>/` + `claude -w`) | [ISOLATED-WORKTREE.md](ISOLATED-WORKTREE.md) |

### Verification & testing

| Goal | Read |
| --- | --- |
| Verify or test a feature/fix, including PR review gates | [feature-verification.md](feature-verification.md) |
| Run the autonomous verification loop on a product feature (#1–64) | [verify/RUN-VERIFY-LOOP.md](verify/RUN-VERIFY-LOOP.md) |
| Prepare a verified-only CEO/VC ship-status CSV | [PRESHIP.md](PRESHIP.md) |
| Run inner-loop tests on `wip/**` CI (ADR-0013) | [INNER-LOOP-TESTING.md](INNER-LOOP-TESTING.md) |
| Drive `claudefast` JSON / stream-json probes (FASTPROBE) | [FASTPROBE.md](FASTPROBE.md) |
| Understand the `claudefast` wrapper (MiniMax Anthropic-compatible profile) | [CLAUDEFAST.md](CLAUDEFAST.md) |
| Understand the 12-field self-report Stop hook contract | [STOP-HOOKS.md](STOP-HOOKS.md) |
| Check PR #14 status | [pr-14-status.md](pr-14-status.md) |

### Install, propagation, and runtime UX

| Goal | Read |
| --- | --- |
| Understand how `teamagent init` propagates project configs to users | [INIT-PROPAGATION.md](INIT-PROPAGATION.md) |
| Read the self-update / auto-update flow (release-branch + soft-force prompt) | [SELF-UPDATE.md](SELF-UPDATE.md) |
| Maintain the SessionStart Newsboard banner template | [newsboard.md](newsboard.md) |
| Understand the statusline | [STATUSLINE.md](STATUSLINE.md) |
| Look up the `issues` alias / zsh function | [issues-alias.md](issues-alias.md) |
| Understand the local install / dogfood sandbox layout | [sandbox.md](sandbox.md) |

### Dogfood & bug reporting

| Goal | Read |
| --- | --- |
| Live-preview / dogfood agent edits in two tmux panes | [DOGFOOD.md](DOGFOOD.md) |
| Report a bug — system info + repro + raw logs to GitHub | [BUGREPORT.md](BUGREPORT.md) |
| Launch the real-time dashboard | Run `pnpm teamagent dashboard --watch --open` |

### Milestone & historical

| Goal | Read |
| --- | --- |
| Find foundational specs | [specs/README.md](specs/README.md) |
| Find later milestone specs and plans | [superpowers/README.md](superpowers/README.md) |
| Review historical Phase 1 and superseded docs | [backup/README.md](backup/README.md) |

## Reading Paths

### Product and Positioning

1. [系统展示.md](系统展示.md) for the user-facing product story.
2. [backup/phase2-superseded/2026-04-22-product-roadmap-v3.md](backup/phase2-superseded/2026-04-22-product-roadmap-v3.md) for the (archived) Phase 2 roadmap.
3. [archive/conflict-governance/2026-04-21-team-memory-direction.legacy.md](archive/conflict-governance/2026-04-21-team-memory-direction.legacy.md) for the (archived) team-memory direction memo, superseded by [specs/2026-04-30-experience-governance-redesign.md](specs/2026-04-30-experience-governance-redesign.md).

### Architecture and Mechanics

1. [ARCHITECTURE.md](ARCHITECTURE.md) for the conceptual architecture.
2. [SYSTEM.md](SYSTEM.md) for the deeper technical reference.
3. [notes/2026-04-14-hook-protocol-decisions.md](notes/2026-04-14-hook-protocol-decisions.md) for hook protocol decisions.

### PR Planning

1. [HOWTO-PLAN-PR.md](HOWTO-PLAN-PR.md) for the four-section PR plan
   structure: plan, expected outputs, how-to-verify (judge harness), and
   `claudefast` probes to run before coding.

### Verification

1. [feature-verification.md](feature-verification.md) for the required
   feature/fix verification gate: `claudefast` JSON snapshot, tmux `/export`,
   PR review gate, and commit/PR evidence.
2. [pr-14-status.md](pr-14-status.md) for the current PR #14 local status
   index when GitHub access is blocked.
3. [verify/RUN-VERIFY-LOOP.md](verify/RUN-VERIFY-LOOP.md) for the
   autonomous loop the main agent runs per product feature — composes
   GOAL.md from 5 sources, calls JUDGE, then `--bare` META-JUDGE decides
   STILL_MOVING / STUCK_REPEATING / STUCK_DESIGN_FLAW. See also
   [verify/GOAL-COMPOSER.md](verify/GOAL-COMPOSER.md),
   [verify/JUDGE.md](verify/JUDGE.md), and
   [verify/META-JUDGE.md](verify/META-JUDGE.md).

### Milestone Work

1. [specs/README.md](specs/README.md) for original product and Phase 2 context.
2. [superpowers/specs/README.md](superpowers/specs/README.md) for design documents.
3. [superpowers/plans/README.md](superpowers/plans/README.md) for implementation plans.
4. [dogfood/自举报告.md](dogfood/自举报告.md) for Phase 2 dogfood results.

## Directory Map

| Path | Purpose |
| --- | --- |
| `specs/` | Foundational product specs, backlog, and direction memos. |
| `superpowers/specs/` | Later milestone design specs and roadmaps. |
| `superpowers/plans/` | Task-level implementation plans for later milestones. |
| `gstack/` | Approved `/office-hours` design docs that downstream gstack review skills can discover automatically. |
| `notes/` | Small decision records. |
| `feature-verification.md` | Feature/fix verification gate and evidence requirements. |
| `verify/` | Autonomous verification loop playbook for product features (RUN-VERIFY-LOOP, GOAL-COMPOSER, JUDGE, META-JUDGE; see `verify/INDEX.md`). |
| `features/` | Short per-feature canned answer docs and conventions. |
| `knowledge/` | Project knowledge index and docs propagation notes. |
| `pr-14-status.md` | PR #14 local status index for restricted verification sessions. |
| `research/` | Research notes that informed roadmap decisions. |
| `dogfood/` | Current dogfood reports. |
| `backup/` | Historical and superseded documents retained for traceability. |

## Conventions

- Dated filenames are chronological records, not automatically current.
- Prefer the newest roadmap or design doc when two documents cover the same
  topic.
- Files under `backup/` are historical unless a current doc explicitly points
  back to them.
