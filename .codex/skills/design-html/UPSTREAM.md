# Upstream Provenance

This skill is vendored verbatim from [garrytan/gstack](https://github.com/garrytan/gstack).

| Field | Value |
|---|---|
| Upstream repo | https://github.com/garrytan/gstack |
| Upstream path | `design-html/` |
| Pinned commit | `675717e3200d8f54b7e179a3425a21bdae33414b` (v1.17.0.0, 2026-04-28) |
| Vendored on | 2026-04-29 |
| Upstream license | MIT — see `LICENSE.upstream` |

## Files

| File | Source |
|---|---|
| `SKILL.md` | `design-html/SKILL.md` |
| `SKILL.md.tmpl` | `design-html/SKILL.md.tmpl` (gstack-internal authoring template) |
| `vendor/pretext.js` | `design-html/vendor/pretext.js` (Pretext renderer, ~30 KB) |
| `LICENSE.upstream` | `LICENSE` (gstack repo root) |

## Runtime dependency

`SKILL.md` calls binaries from `~/.codex/skills/gstack/bin/...` (with project-relative
fallback to `.codex/skills/gstack/bin/...`). The required gstack binaries are vendored
under `.codex/skills/gstack/bin/` — see `.codex/skills/gstack/UPSTREAM.md` for details.

`gstack-verify-desktop`, `gstack-verify-mobile`, and `gstack-verify-tablet` are NOT
present in upstream `bin/` — they are runtime aliases created by gstack's installer.
Without them, the "verify rendered HTML" step in `design-html` will silently no-op
(`2>/dev/null || true`); the skill still produces HTML correctly but skips browser
verification.

## Update procedure

```bash
SHA=<new-upstream-sha>
curl -fsSL https://raw.githubusercontent.com/garrytan/gstack/$SHA/design-html/SKILL.md \
  -o .codex/skills/design-html/SKILL.md
curl -fsSL https://raw.githubusercontent.com/garrytan/gstack/$SHA/design-html/SKILL.md.tmpl \
  -o .codex/skills/design-html/SKILL.md.tmpl
curl -fsSL https://raw.githubusercontent.com/garrytan/gstack/$SHA/design-html/vendor/pretext.js \
  -o .codex/skills/design-html/vendor/pretext.js
# then mirror to .codex/skills/design-html/ and update the SHA above
```
