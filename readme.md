# Yasha

Upgrades every dependency in `package.json` (`dependencies`, `devDependencies`, `peerDependencies`, `optionalDependencies`, `overrides`, and `resolutions`) to the latest published version, wipes `node_modules` and lockfiles, then reinstalls clean using the detected package manager (`pnpm`, `yarn`, `bun`, or `npm`).

No migration logic. No semver negotiation. Latest wins.

Ships as both:

- a **CLI** (`yasha` on your `PATH`)
- a **Claude Code plugin** (skill + `/yasha` slash command, so Claude can run it for you)

## What it does

1. Reads `package.json` in the current directory and detects the package manager (`pnpm`, `yarn`, `bun`, or `npm`)
2. Queries the registry for every package in `dependencies`, `devDependencies`, `peerDependencies`, `optionalDependencies`, `overrides`, and `resolutions` (and `pnpm-workspace.yaml` if present)
3. Writes the resolved exact versions back into `package.json` (and `pnpm-workspace.yaml`)
4. Deletes `node_modules` and any existing lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock*`)
5. Runs the detected package manager's install (`pnpm install`, `yarn install`, `bun install`, or `npm install`)

If a version cannot be resolved, that package is skipped with a warning. Other packages still update.

## Install

### As a CLI (npm, global)

```sh
npm install -g yasha
```

Then from any project:

```sh
cd your-project
yasha
```

### As a Claude Code plugin

Add the marketplace, then install:

```
/plugin marketplace add iamhi/yasha
/plugin install yasha@yasha
```

After install, ask Claude things like *"bump all deps to latest"* and the `yasha` skill activates, or run the slash command directly:

```
/yasha
```

### From source (development)

```sh
git clone https://github.com/iamhi/yasha.git
cd yasha
npm link
```

The `yasha` binary is now on your `PATH`.

## Usage

Run from any directory containing a `package.json`:

```sh
yasha
```

## Uninstall

CLI (npm global):

```sh
npm uninstall -g yasha
```

CLI (linked from source):

```sh
cd path/to/yasha
npm unlink
```

Plugin:

```
/plugin uninstall yasha@yasha
```

## Repo layout

```
.claude-plugin/
  plugin.json         plugin manifest
  marketplace.json    lets this repo serve itself as a marketplace
skills/yasha/
  SKILL.md            LLM-facing instructions (auto-activates on relevant prompts)
commands/
  yasha.md            /yasha slash command
bin/
  yasha.js            CLI entrypoint (also the npm bin)
test/
  yasha.test.js       integration tests
package.json
```
