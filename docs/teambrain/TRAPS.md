```
踩坑 → 复盘 → 写入 TRAPS.md → 下一 agent 读到 → 不再踩
  │        │         │                │              │
  ▼        ▼         ▼                ▼              ▼
 fail   retro    TRAP entry       pre-read        skip it
  │                  │
  └──────────────────┘
     every P0 needs
     a verify hint
```

> **Note**: Schema may be tightened by TRAP_FORMAT.md (parallel teammate). If TRAP_FORMAT.md lands first, this file should be re-curated to match.

---

## How to read this file

Start at P0 — these are the traps that have caused actual production incidents or major team setbacks. Read the wrong-pattern first: if you recognise your current action in it, stop. Check the verify hint before proceeding. P1/P2 are condensed as a quick-scan table; consult them when entering a new phase (release, review, oncall). The 10 standards and 5 failure cases at the bottom are the structural backbone — they explain *why* the traps exist, not just what to avoid.

---

## P0 Traps (deep dives)

### TRAP-GIT-001

- **category**: git
- **trigger**: `git push --force` on a shared branch
- **wrong-pattern**: `git push --force origin main` (or any shared branch without `--force-with-lease`)
- **right-pattern**: `git push --force-with-lease origin <branch>` — aborts if remote has commits you haven't seen
- **evidence link**: Day 0 dump §A trap #1 — "别人 commit 直接被覆盖消失"
- **severity**: P0
- **verify hint**: `git config --get receive.denyNonFastForwards` should return `true` on protected branches; also check `git remote show origin | grep -i "force"` for branch protection status

---

### TRAP-TEST-001

- **category**: review / testing
- **trigger**: Merging code with `// TODO: add tests later` or any "以后再补测试" comment
- **wrong-pattern**: PR merged with `// TODO: test` or commit message containing "will add tests" / "no test needed" ⚠️ MOCK LOOPHOLE — skip-if-no-test patterns must be blocked
- **right-pattern**: DoD gate: `grep -r "TODO.*test\|later.*test\|add.*test" --include="*.ts" src/` returns zero results before merge; CI enforces coverage delta ≥ 0 on every PR
- **evidence link**: Day 0 dump §B trap #20 — "'以后再补测试'成习惯 → DoD 必须含测试，无测试不算完成"; Failure case #2 — 800万+ order loss from skipped testing
- **severity**: P0
- **verify hint**: `git log --oneline -20 | grep -i "no test\|todo test\|will test"` should be empty; check CI config for `--coverage-threshold`

---

### TRAP-TEST-002

- **category**: testing
- **trigger**: Mocking every collaborator so the test suite passes even when the real integration is broken
- **wrong-pattern**: `jest.mock('../database')`, `jest.mock('../api-client')` wrapping the entire module under test — mock 套娃 (mock turtles all the way down) ⚠️ MOCK LOOPHOLE
- **right-pattern**: Mock only at system boundaries (network, filesystem). Core logic uses real collaborators in integration tests. `grep -r "jest.mock\|sinon.stub" --include="*.test.ts" | wc -l` should be < 30% of test file count
- **evidence link**: Day 0 dump §B trap #15 — "真实调用链一改全挂 → Mock 最小化，核心逻辑用真协作对象做集成测试"
- **severity**: P0
- **verify hint**: `grep -rn "jest.mock\|vi.mock" packages/ --include="*.test.ts" | wc -l` vs total test count; any ratio > 0.5 is a smell requiring reviewer sign-off

---

### TRAP-OPS-001

- **category**: ops
- **trigger**: Releasing directly to 100% traffic without a staged rollout
- **wrong-pattern**: Deploy script with no canary step, or `kubectl set image` directly applied to all replicas at once; `ROLLOUT_PERCENT=100` as first and only step
- **right-pattern**: Staged rollout: 5% → 15% → 50% → 100%, each step with human confirmation gate and error-rate check. Rollback script must be in CI before deploy runs.
- **evidence link**: Day 0 dump §C trap #21 — "灰度无梯度 — 流量突增 bug 集中爆"; trap #22 — "回滚脚本没进 CI — 灾难时刻敲错命令"
- **severity**: P0
- **verify hint**: `grep -r "ROLLOUT_PERCENT\|canary\|rollback" .github/workflows/ --include="*.yml" | grep -v "^#"` must show staged percentages and rollback job

---

### TRAP-COOP-001

- **category**: coop
- **trigger**: On-call handoff delivered verbally with no written runbook update
- **wrong-pattern**: Slack message "hey you're on call now, just watch the dashboard" with no doc update ⚠️ verbal-only rule — no ground-truth trail
- **right-pattern**: Structured handoff doc updated before shift change containing: alert thresholds, most recent root causes (≤7 days), emergency contacts. Template: `docs/oncall/handoff-YYYY-MM-DD.md`
- **evidence link**: Day 0 dump §D trap #40 — "On-call 交接只口头说一句 → 交接文档结构化：阈值 / 最近根因 / 应急联系人"
- **severity**: P0
- **verify hint**: `ls -lt docs/oncall/handoff-*.md | head -1` — most recent file must be within 24h of current on-call shift start; `wc -l` on that file must be ≥ 10 lines

---

## P1 / P2 Condensed

| id | category | wrong | right | severity |
|----|----------|-------|-------|----------|
| TRAP-GIT-002 | git | commit message: "fix bug" / "update" | imperative: `feat(scope): description` | P1 |
| TRAP-GIT-003 | git | PR with no description, raw link dump | PR body: what / why / how-to-verify | P1 |
| TRAP-GIT-004 | git | giant commit mixing unrelated changes | atomic commits, one logical concern per commit | P1 |
| TRAP-GIT-005 | git | long-lived feature branch, never rebased | `git rebase main` daily or every 2 days | P1 |
| TRAP-GIT-006 | git | hotfix directly on main without PR | hotfix branch → PR + review → cherry-pick to prod | P1 |
| TRAP-GIT-007 | git | `git merge` without `--no-ff` on history branches | use `--no-ff` to preserve merge nodes; rebase for linear history | P2 |
| TRAP-GIT-008 | git | `.gitignore` edit has no effect (file already staged) | `git rm -r --cached . && git add .` | P2 |
| TRAP-GIT-009 | git | no protected branch rules | set branch protection: require PR + review + status checks | P1 |
| TRAP-GIT-010 | git | `git stash` without `-m` name | `git stash push -m "context-description"` | P2 |
| TRAP-TEST-003 | review | coverage % looks fine, new code 0% delta | per-PR incremental coverage gate in CI | P1 |
| TRAP-TEST-004 | review | TDD red/green reversed — tests written after code | strict red → green → refactor; PR blocked if no failing test first | P1 |
| TRAP-TEST-005 | review | code review only catches style issues | linter owns style; review gates on correctness / security / maintainability | P1 |
| TRAP-TEST-006 | review | hardcoded test data breaks on field rename | use factory / fixture pattern for test data | P1 |
| TRAP-TEST-007 | review | nobody checks test logic quality | reviewer has duty to challenge test assertions | P1 |
| TRAP-TEST-008 | review | `/* istanbul ignore */` to hit coverage % ⚠️ | CI limit on ignore directives; each must link a ticket | P1 |
| TRAP-TEST-009 | review | E2E tests run on every unit test loop | pyramid: unit → integration → E2E only for critical paths | P2 |
| TRAP-OPS-002 | ops | no rollback script in CI | rollback script checked into CI, tested same as deploy script | P1 |
| TRAP-OPS-003 | ops | monitoring only P99 latency | P50 / P90 / P99 all configured; SLO based on P50 | P1 |
| TRAP-OPS-004 | ops | health check depends on downstream services | health check tests only process liveness, not downstream | P1 |
| TRAP-OPS-005 | ops | experiment flags and feature flags share state | isolate experiment vars from feature flags, separate namespaces | P1 |
| TRAP-OPS-006 | ops | rollback skips schema compatibility check | schema changes must be backward compatible; validate before rollback | P1 |
| TRAP-OPS-007 | ops | oncall dashboard has 20+ charts | oncall board: only QPS / Error / Latency — 3 charts max | P2 |
| TRAP-OPS-008 | ops | tracing disabled during canary to reduce cost | sampling rate ≥10%; never disable tracing entirely during rollout | P1 |
| TRAP-OPS-009 | ops | deploy scheduled during peak traffic | deploys always in low-traffic window | P1 |
| TRAP-OPS-010 | ops | no data backfill plan for new schema fields | schema changes must ship with backfill script | P1 |
| TRAP-OPS-011 | ops | task closed without saving `.judge/` evidence artifacts | every task must save `stdout.txt`, `coverage.json`, `judge.json` to `.judge/<run_id>/` before committing; verbal "evidence" is rejected | P0 |
| TRAP-COOP-002 | coop | estimate = best case only | three-point estimate × 1.3: `(best + 4×likely + worst) / 6 × 1.3` | P1 |
| TRAP-COOP-003 | coop | design doc with no "why X over Y" rationale | every design doc must have an alternatives-considered section | P1 |
| TRAP-COOP-004 | coop | runbook only covers the happy path | runbook footer: "historical incidents" section mandatory | P1 |
| TRAP-COOP-005 | coop | new team member gets link dump, no pair session | day 1: in-person task walkthrough; week 2+: 15-min daily pairing | P1 |
| TRAP-COOP-006 | coop | estimate has no buffer padding | external deadline = internal estimate + 2-week buffer | P1 |
| TRAP-COOP-007 | coop | doc review comment: "this is wrong" with no direction | review comment must include: priority (P0/P1) + suggested fix direction | P2 |
| TRAP-COOP-008 | coop | task assigned by "whoever is free" | assign via skill matrix; critical path tasks assigned by competency | P2 |
| TRAP-COOP-009 | coop | meeting agenda without owner/due per item | every agenda item must close with: conclusion + owner + due date | P2 |
| TRAP-COOP-010 | coop | new contributor PR merged without walkthrough | before merge: 15-min "why did I write it this way" session | P2 |

---

## 10 Team Standards

1. **上下文所有权 (Context Ownership)** — Every PR and design review must name a decision owner; if that person is absent, a named deputy is required. No owner = blocked.
   - Verify: PR description field "Decision Owner: @handle" must be non-empty; CI check or template enforcement.

2. **承诺颗粒度 (Commitment Granularity)** — Minimum estimate unit is half a day. "I'm not sure" is valid; "maybe a few hours" is not.
   - Verify: Sprint tracker estimates must be in increments of 0.5d; anything finer is flagged for re-estimation.

3. **阻塞可视化 (Blocker Visibility)** — Any blocker lasting > 1 day must be escalated. Silent waiting = spreading the risk.
   - Verify: `gh issue list --label "blocked" --created ">$(date -d '1 day ago' +%Y-%m-%d)"` should prompt a daily triage.

4. **契约优于默契 (Written Contract > Tacit Agreement)** — Cross-team interface agreements must be in writing before any code is written. Verbal = not agreed.
   - Verify: PR description contains link to written interface doc or ADR for any cross-team dependency.

5. **增量即交付 (Increment = Delivery)** — A task is complete only when a working demo exists. "Code is written" ≠ done.
   - Verify: PR checklist item "demo link or recorded screencast attached" is checked.

6. **悲观估时法 (Pessimistic Estimation)** — All estimates multiplied by 1.5 before entering planning. Optimistic estimates are rejected.
   - Verify: PR descriptions for feature work list best/likely/worst estimates; ratio likely/best ≥ 1.3.

7. **缺席即默认同意 (Absence = Consent)** — Reviewer absent ≥ 15 minutes in a scheduled review = waived; cannot object post-merge.
   - Verify: Calendar event for review has start-time attendance logged; latecomers noted in review comments.

8. **失败即学习 (Failure = Learning)** — Every production incident and missed estimate triggers a mandatory post-mortem within 48h.
   - Verify: `ls docs/postmortems/` has a file dated within 48h of every Sev-1/Sev-2 incident.

9. **依赖先验性 (Dependency Pre-validation)** — Cross-team dependencies must be confirmed before development starts. Discovery during development = unmanaged risk.
   - Verify: Task description contains "Dependency confirmed by: @handle on YYYY-MM-DD" for any cross-team dep.

10. **退出条件先行 (DoD First)** — Work does not start until DoD is written and agreed by all stakeholders.
    - Verify: Issue/PR template has a "Definition of Done" section; it must be non-empty before status moves to "In Progress".

---

## 5 Typical Failure Cases

| # | Background | Wrong Decision | Blast & Loss | Root Lesson | Would-Have-Prevented |
|---|-----------|----------------|-------------|-------------|----------------------|
| 1 | Core module author departed, no docs | "Code is documentation" | 6× maintenance cost 6 months later, 2 P0 incidents | Knowledge not encoded = zero; turnover accelerates entropy | TRAP-COOP-003 (no "why" rationale in docs) |
| 2 | OKR sprint crunch, testing time cut | "Sacrifice tests for velocity" | Core flow failure post-launch; 800万+ order loss | Quality is not a phase; debt accrues with compound interest | TRAP-TEST-001 (skip tests) |
| 3 | 2 years of tech debt, refactor blocked | "If it works, don't touch it" | Small change triggers circular dependency; 3-day cascade failure | Tech debt is compound interest; later = more expensive | TRAP-TEST-002 (mock 套娃 hiding coupling) |
| 4 | Hiring season, strong individual hired | "We'll train culture fit later" | 6 months in: collaboration friction leads to 2 senior departures | Hiring is reverse selection; mis-hire cost multiplies | TRAP-COOP-008 (assign by availability not skill) |
| 5 | Team familiar with microservices, new system chosen | "Use the tech we know" | Distributed transactions/network/ops far exceeded estimates; 4-month delay | Characterise the problem domain first, then match technology | TRAP-COOP-002 (optimistic estimation only) |
