# Yasha CLI Design

**Date:** 2026-04-01

## Overview

A Node.js CLI tool that updates all `package.json` dependencies to their latest versions, then performs a clean reinstall.

## Usage

```bash
npm link   # once, to install globally
yasha      # run in any project directory
```

## Entry Point

`bin/yasha.js` — single file, `#!/usr/bin/env node` shebang, no build step.

`package.json` declares:

```json
{
  "bin": { "yasha": "./bin/yasha.js" }
}
```

## Flow

1. Read `package.json` from `process.cwd()`. Exit with error if not found.
2. Collect all package names from `dependencies` and `devDependencies`.
3. For each package, run `npm view <pkg> version` to get the latest dist-tag version.
4. Rewrite every version to the exact latest (no `^` or `~` prefix).
5. Write `package.json` back in place, preserving 2-space indentation.
6. Delete `node_modules/` (recursive).
7. Delete `package-lock.json`.
8. Run `npm install`.

## Error Handling

- If `package.json` is not found in `cwd`: print error and exit non-zero.
- If a package is not found on the registry (e.g. private/scoped package): skip it, print a warning, continue with remaining packages.
- Any other unexpected error (npm not on PATH, etc.): print error and exit non-zero.

## Constraints

- Zero runtime dependencies.
- Node.js stdlib only (`fs`, `child_process`, `path`).
- Sequential npm registry lookups (one per package).
