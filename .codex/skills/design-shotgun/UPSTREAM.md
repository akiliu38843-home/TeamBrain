# Upstream Provenance

This skill is vendored verbatim from [garrytan/gstack](https://github.com/garrytan/gstack).

| Field | Value |
|---|---|
| Upstream repo | https://github.com/garrytan/gstack |
| Upstream path | `design-shotgun/` |
| Pinned commit | `675717e3200d8f54b7e179a3425a21bdae33414b` (v1.17.0.0, 2026-04-28) |
| Vendored on | 2026-04-29 |
| Upstream license | MIT — see `LICENSE.upstream` |

## Files

| File | Source |
|---|---|
| `SKILL.md` | `design-shotgun/SKILL.md` |
| `SKILL.md.tmpl` | `design-shotgun/SKILL.md.tmpl` (gstack-internal authoring template) |
| `LICENSE.upstream` | `LICENSE` (gstack repo root) |

## Runtime dependency

`SKILL.md` calls binaries from `~/.codex/skills/gstack/bin/...` (with project-relative
fallback to `.codex/skills/gstack/bin/...`). The required gstack binaries are vendored
under `.codex/skills/gstack/bin/` — see `.codex/skills/gstack/UPSTREAM.md` for details.

A handful of gstack-* commands referenced inline (`gstack-context`, `gstack-upgrade`,
`gstack-verify-*`, etc.) are not present in upstream `bin/` — they are runtime aliases
created by gstack's installer. Calls to them silently no-op (`2>/dev/null || true`),
so the skill degrades gracefully without them.

## Update procedure

```bash
SHA=<new-upstream-sha>
curl -fsSL https://raw.githubusercontent.com/garrytan/gstack/$SHA/design-shotgun/SKILL.md \
  -o .codex/skills/design-shotgun/SKILL.md
curl -fsSL https://raw.githubusercontent.com/garrytan/gstack/$SHA/design-shotgun/SKILL.md.tmpl \
  -o .codex/skills/design-shotgun/SKILL.md.tmpl
# then mirror to .codex/skills/design-shotgun/ and update the SHA above
```
