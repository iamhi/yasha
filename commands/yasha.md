---
description: Upgrade every package.json dependency to the latest published version, wipe node_modules and package-lock.json, then reinstall clean.
---

Run yasha against the current working directory.

Steps:

1. Verify `package.json` exists in the cwd. If missing, stop and tell the user.
2. Run the bundled script directly: `node "${CLAUDE_PLUGIN_ROOT}/bin/yasha.js"`. This always works when invoked through the Claude Code plugin — no `npm i -g` or `npm link` required. If `${CLAUDE_PLUGIN_ROOT}` is not set (not running via plugin) and `yasha` is on `PATH` (`command -v yasha`), run `yasha` instead. As a last resort, use the inline fallback in `skills/yasha/SKILL.md`.
3. Report which packages updated, which were skipped, and the final `npm install` outcome.

Do not modify the `package.json` `name`, `version`, `scripts`, or any non-dependency fields. Only `dependencies` and `devDependencies` versions change.
