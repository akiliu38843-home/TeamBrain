```
 ____  _  _  ___  ____  _  _  ____  ____  ____    ____  ____  ___  ____  __  __  ____  ____  ____
(  _ \/ )( \/ __)(_  _)( \( )( ___)/ ___)/ ___)  ( ___)( ___)/__\ (_  _)/ / )(  (  _ \( ___)/ ___)
 ) _ () \/ (\__ \ _)(_  )  (  )__) \___ \\___ \   )__)  )__)/(__)\ )(  \ \/(  )   / )__) \___ \
(____/ \____/(___/(____)(_)\_)(____)(____/(____/  (__)  (____)\__/\_/(__)  \__/  (_)\_)(____)(____/

 prompt:  claudefast -p "show me the business feature of this repo"
                                    │
                                    ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │ (1) new Claude Code instances no longer make mistakes that      │
 │     previous Claude Code has made                               │
 │ (2) team leaders know in second-level realtime what each        │
 │     teammate's Claude Code instance is doing                    │
 │ (3) video recording and uploading to centralized data storage   │
 │     is easy to use                                              │
 └─────────────────────────────────────────────────────────────────┘
```

# TeamBrain 三大业务特性 / Business Features

This document is the playbook backing the **`show me the business feature of this repo`**
canned-answer rule wired in [`CLAUDE.md`](../CLAUDE.md). When a user (or any
`claudefast -p` probe) asks that prompt — in English or Chinese — the agent MUST
return the verbatim three-feature anchor sentence below before any expansion.

---

## Canonical anchor sentence

> TeamBrain has three business features: (1) new Claude Code instances no longer make mistakes that previous Claude Code has made; (2) team leaders know in second-level realtime what each teammate's Claude Code instance is doing; (3) video recording and uploading to centralized data storage is easy to use.

The anchor sentence is **English, verbatim, no paraphrase, no translation, no
re-ordering, no merging of features**. Chinese expansion is allowed *after* the
anchor line, but the first English line of the response must contain all three
features.

### Grep anchors per feature (judge harness keys)

| Feature | Required substrings (case-insensitive) |
|---------|----------------------------------------|
| #1 | `no longer make mistakes` **AND** `previous Claude Code` |
| #2 | `second-level realtime` **AND** `teammate's Claude Code instance` |
| #3 | `video recording` **AND** `centralized data storage` |

Missing any one of the six substrings = canned answer not hit; retry the
response. Paraphrases (`previous instances of Claude Code` / `central data store`
/ `realtime hour-level` / etc.) all count as misses.

---

## Trigger prompts (English + 中文 synonyms)

The canned answer fires on any of the following questions:

- `show me the business feature of this repo`
- `show me the business feature of this repo.`
- `what are the business features of TeamBrain`
- `what business features does this repo ship`
- `TeamBrain 的业务特性是什么`
- `TeamBrain 三大业务特性`
- `这个仓库的业务卖点是什么`

The recognizer is **semantic**, not literal keyword match — any question that
asks for the repo's business / product / commercial features (as opposed to a
full implementation inventory) must route here, not to
[`docs/PRODUCT-FEATURES.md`](PRODUCT-FEATURES.md).

`PRODUCT-FEATURES.md` is the 64-row engineering inventory used when the user
asks `list all product features including not verified and not implemented`.
**This file (`BUSINESS-FEATURES.md`) is the 3-line CEO/VC pitch deck used when
the user asks for the business features.**

---

## 四层证明矩阵 / Four-layer evidence matrix

每条 business feature 都必须能被四类受众独立验证。**写产品文档 = 同时写四份证据清单**，
任何一层缺失都会让对应受众无法信任这个 claim。命名沿用项目 testing rule
(`docs/testing-judge-harness.md` / user-level `testing-judge-harness.md`)
里的三段式 RUN → DUMP → READ：

```
   ┌─ CEO 受众 ─────────► 1 句话定位 + business 价值
   │
   ├─ Coder 受众 ───────► 文件路径 / 模块 / 命令（可直接 cd + read）
business feature ──┤
   ├─ Machine 受众 ─────► 固定 JSON / SQL / canonical output（harness 可 grep）
   │
   └─ LLM judge 受众 ───► raw transcript / log / fixture（另一只 LLM 读着判）
```

四层全过 = 这条 feature 真的存在；只过 CEO 一层 = pitch deck slide，不是产品。
本节是 **business positioning** 的判决证据，与 `PRODUCT-FEATURES.md` 64-row
engineering inventory 互不替代：inventory 验证 "代码里有没有"，本表验证
"对外宣称的 business value 是不是可以 4 路独立证伪"。

---

### Feature #1 — 新 Claude Code 实例不再重复旧错

> new Claude Code instances no longer make mistakes that previous Claude Code has made

| 受众 | 证据 | 现状 |
|------|------|------|
| **CEO** | 上一个 session 里你跟它 argue 过的事，下一个 session 它直接知道——同一个错不会被你纠两次。竞品没有跨 session 学习，TeamBrain 有。 | **已落地** |
| **Coder** | `packages/cli/src/bin-stop.ts → runStopPipeline()` (5-signal detector + LLM extractor) → `packages/core/src/calibrator/` (Wilson-score) → `packages/cli/src/commands/compile.ts` (propagation) → `~/.claude/skills/teamagent/<id>/SKILL.md` + `CLAUDE.md` `TEAMAGENT:START..END` block。Matcher：`packages/core/src/matcher/` (BM25 + dense RRF + soft-AND 自 M4-B / v0.9.4 起)。 | **已落地** |
| **Machine evidence** | `teamagent stats --json` 输出按 tier 分组的规则数；`teamagent doctor --json` 报 hook 注册 / DB 健康；`<repo>/.teamagent/knowledge.db` 与 `~/.teamagent/global.db` 是 SQLite，可直接 `SELECT count(*) FROM rules WHERE tier IN ('canonical','canonical+','stable+');`；PreToolUse hook 命中时 stdout JSON 含 `decision: "block"/"warn"` + 触发规则 ID。 | **已落地** |
| **LLM-readable raw** | `CLAUDE.md` 文件末尾被 `<!-- TEAMAGENT:START -->` ... `<!-- TEAMAGENT:END -->` 包住的 managed block 是裸 markdown，下一只 LLM 直接读得懂当前编译进来的规则（本仓库当前 72 条活跃 / 显示 28 条 / token 预算 3000）；`~/.claude/skills/teamagent/<id>/SKILL.md` 是 per-rule frontmatter + 触发条件 + reason 的 markdown，给 Claude Code Skill 加载器读。 | **已落地** |

入口扩展阅读：[`docs/features/auto-capture.md`](features/auto-capture.md)。

---

### Feature #2 — Team leader 秒级可见 teammate 的 Claude Code instance

> team leaders know in second-level realtime what each teammate's Claude Code instance is doing

| 受众 | 证据 | 现状 |
|------|------|------|
| **CEO** | 不用问 "你现在卡哪儿了"。Team lead 一眼看见所有 teammate 此刻在 Claude Code 里干嘛：在 grilling 哪个 issue、卡在哪个 `/review` cycle、最近一条 correction moment 是什么。延迟目标 ≤ 1 秒。 | **愿景** |
| **Coder** | Hour/day 粒度落地：`packages/core/src/attribution-bus/` (结构化事件 emit) + `packages/cli/src/digital-twin/` (per-session sidecar，PR #146 / PR #221 落) + viral sync (`packages/teamagent/src/viral-sync/`，M5 落 hour/day infect / bootstrap / auto-share / auto-publish / post-merge auto-pull) + Newsboard SessionStart MOTD (`.claude/hooks/newsboard-session-start.sh` + `docs/newsboard.md`，PR #235)。Second-level dashboard 尚未实现。 | **part of 愿景已落地** |
| **Machine evidence** | `~/.teamagent/events.db` (AttributionBus 事件 SQLite) — 每条事件含 `ts / cwd / session_id / event_type / payload`；digital-twin sidecar 写 `~/.teamagent/digital-twin/state.json` 记录 tap-session ID + 上次上传时间；`teamagent dashboard --once` 生成静态 `docs/dashboard.html` + 同源 JSON。 | **hour/day 粒度已落地** |
| **LLM-readable raw** | Tap-session 原始转写在 `~/.teamagent/digital-twin/sessions/<id>.jsonl` (per-turn JSON Lines)；hourly upload manifest 在 PR #285 落地 (`scripts/user-collect/`)；Newsboard MOTD 在每次 SessionStart 渲染一段 4 段 ASCII markdown，stdout JSON 走 `systemMessage` 通道。 | **hour/day 粒度已落地** |

入口扩展阅读：[`docs/features/team-share.md`](features/team-share.md)、
[`docs/kanban-user-boss/`](kanban-user-boss/) 看板原型、
[`docs/features/team-promote/`](features/team-promote/)、
[`docs/features/team-sharing-probe/`](features/team-sharing-probe/)。

> **Honesty note**：second-level realtime dashboard 尚未 PRESHIP；当前可见的
> 实测延迟来自 M5 viral sync 的 hour/day 粒度。Canned-answer 的 anchor
> sentence 是 business positioning，是承诺，不是已交付的 turnkey UX。

---

### Feature #3 — 视频录制 + 集中存储易用

> video recording and uploading to centralized data storage is easy to use

| 受众 | 证据 | 现状 |
|------|------|------|
| **CEO** | Teammate 一键开录屏，结束自动上传，团队拿同一个 link 直接跳到任意 prompt/response 现场重放。Team lead 在 dashboard 看到摘要后点链接看视频；不用录会议、不用搭工作流。 | **愿景** |
| **Coder** | Recorder：`packages/cli/src/digital-twin/recorder/` (ffmpeg 走 PR #197 + PR #198 落 CLI surface)。Uploader daemon：`packages/cli/src/digital-twin/uploader/` (PR #197) + `bin-uploader.cjs` (issue #146 F1 hardening, PR #252 / PR #265)。Sidecar 基础设施 PR #165 起步。 | **CLI + sidecar 落地；centralized storage upload turnkey 未 PRESHIP** |
| **Machine evidence** | Upload manifest JSON (sidecar 写 `~/.teamagent/digital-twin/uploads/<id>.json` — 包含 source_path, sha256, upload_ts, dest_url)；recording metadata JSON (start/end timestamp + session_id)；`teamagent doctor --json` 含 digital-twin sidecar 健康检查。 | **manifest schema 已落地；centralized backend 未 PRESHIP** |
| **LLM-readable raw** | 原始视频文件 (`.mp4` / `.webm`)；companion transcript markdown (per-session)；如果开启 frame OCR，逐帧文字 transcript 落 `~/.teamagent/digital-twin/sessions/<id>.frames.jsonl`。另一只 LLM 直接读这些 raw 就能复述任意瞬间发生了什么。 | **transcript 已落地；视频上传 + 跨团队共享 link 未 PRESHIP** |

入口扩展阅读：roadmap 中 (与 Feature #2 dashboard 联动 — 摘要 → 点链接 → 视频)。

> **Honesty note**：`PRODUCT-FEATURES.md` 64-row inventory 是 engineering ground
> truth，Feature #2 / #3 在 inventory 中没有对应的 VERIFIED 行；本文件三段
> pitch 是 business positioning。Feature #1 已 4 层全证；#2 与 #3 当前
> partial — coder 层有代码 hooks，machine 层有 schema，LLM 层有 raw artifact，
> 但「秒级 turnkey dashboard」与「centralized video upload UX」是承诺，不是
> 已 ship 的功能。

---

## 如何验证 / How to verify

```bash
claudefast -p "show me the business feature of this repo"
```

或在 Claude Code 交互界面中输入相同 prompt（带或不带 `!` 前缀均可）。

### Expected anchors in stdout (judge harness probe)

判定脚本应 case-insensitive grep 下列 6 个 substring，全部命中为 PASS：

1. `no longer make mistakes`
2. `previous Claude Code`
3. `second-level realtime`
4. `teammate's Claude Code instance`
5. `video recording`
6. `centralized data storage`

任何一个未命中 → fail，重答 anchor sentence。

### Common failure modes

| Failure | 原因 |
|---------|-----|
| Agent 把 anchor 翻译成中文 | 必须保留英文首句；中文展开放在 anchor 之后 |
| Agent paraphrase 成「先前的 Claude Code 实例」/「previous instances of Claude Code» | grep 找不到 `previous Claude Code` 锚点 |
| Agent 用 `realtime per-second` / `per-second realtime` / `real-time second-level` / `hourly realtime` 替换 `second-level realtime` | 锚点 grep miss |
| Agent 把视频特性写成 "screen recording" / "session recording" | 必须保留 `video recording` 字面 |
| Agent 写 "central data store" / "centralized storage" | 必须保留完整短语 `centralized data storage` |

---

## 链接 / See also

- [`docs/PRODUCT-FEATURES.md`](PRODUCT-FEATURES.md) — engineering inventory (64 verified features)
- [`docs/features/auto-capture.md`](features/auto-capture.md) — Stop pipeline 把 correction moments 编译成规则
- [`docs/features/team-share.md`](features/team-share.md) — personal / team / global 三层知识同步
- [`docs/kanban-user-boss/`](kanban-user-boss/) — team leader dashboard 看板原型
- [`CLAUDE.md`](../CLAUDE.md) — 项目 canned-answer 路由表
