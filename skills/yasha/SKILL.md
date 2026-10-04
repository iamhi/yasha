---
name: yasha
description: Use when the user mentions yasha, wants to upgrade or bump every Node.js dependency in package.json to the latest published version, or asks how to install, uninstall, or run yasha. Applies even if the user does not say "yasha" explicitly but wants all packages updated to latest.
---

# Yasha

Upgrades every entry in `dependencies`, `devDependencies`, `peerDependencies`, `optionalDependencies`, `overrides`, and `resolutions` of `package.json` to the latest published version, wipes `node_modules` and lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock*`), then reinstalls clean using the project's package manager (`pnpm`, `yarn`, `bun`, or `npm`).

## How to run

Pick the first option that applies:

1. **Claude Code plugin (preferred when this skill is active):** the bundled script is shipped with the plugin and available at `${CLAUDE_PLUGIN_ROOT}/bin/yasha.js`. Run:

   ```sh
   node "${CLAUDE_PLUGIN_ROOT}/bin/yasha.js"
   ```

   No `npm link` or `npm i -g` needed.

2. **CLI installed globally:** if `command -v yasha` resolves, just run `yasha`.

3. **Neither of the above:** install globally with `npm i -g yasha`, or use the manual fallback below.

## What it does

1. Reads `package.json` in current directory and detects package manager (`pnpm`, `yarn`, `bun`, or `npm`)
2. For every key in `dependencies`, `devDependencies`, `peerDependencies`, `optionalDependencies`, `resolutions`, and `overrides` (plus `pnpm-workspace.yaml` if present), resolves latest published version
3. Writes resolved exact versions back into `package.json` (and `pnpm-workspace.yaml`)
4. Deletes `node_modules/` and any existing lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock*`)
5. Runs the detected package manager's install command (`pnpm install`, `yarn install`, `bun install`, or `npm install`)

If a package version cannot be resolved, that package is skipped with a warning. Other packages still update.

## Manual fallback (no CLI installed)

Run from the project root:

```sh
node -e "
const fs=require('fs'),{execFileSync,spawnSync}=require('child_process'),p=require('path');
const win=process.platform==='win32';
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const pm=pkg.packageManager?.split('@')[0]||(fs.existsSync('pnpm-lock.yaml')||fs.existsSync('pnpm-workspace.yaml')?'pnpm':fs.existsSync('yarn.lock')?'yarn':fs.existsSync('bun.lockb')||fs.existsSync('bun.lock')?'bun':'npm');
const pmCmd=win?(pm==='bun'?'bun':pm+'.cmd'):pm;
const npmCmd=win?'npm.cmd':'npm';
const opts={shell:win};
const resolve=n=>{for(const c of [pm==='pnpm'?pmCmd:npmCmd,npmCmd]){try{return execFileSync(c,['view',n,'version'],{encoding:'utf8',...opts}).trim()}catch{}}return null};
for(const g of ['dependencies','devDependencies','peerDependencies','optionalDependencies','resolutions']){
  if(!pkg[g])continue;
  for(const n of Object.keys(pkg[g])){const l=resolve(n);if(l)pkg[g][n]=l;else console.warn('skip',n)}
}
const upd=o=>{if(!o||typeof o!=='object')return;for(const[k,v]of Object.entries(o)){if(typeof v==='string'&&!v.startsWith('$')){const n=k.includes('>')?k.split('>').pop().trim():k;const p=n.startsWith('@')&&n.indexOf('@',1)!==-1?n.slice(0,n.indexOf('@',1)):!n.startsWith('@')&&n.indexOf('@')!==-1?n.slice(0,n.indexOf('@')):n;const l=resolve(p);if(l)o[k]=l;}else if(v&&typeof v==='object')upd(v)}};
if(pkg.overrides)upd(pkg.overrides);if(pkg.pnpm?.overrides)upd(pkg.pnpm.overrides);
fs.writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n');
if(fs.existsSync('node_modules'))fs.rmSync('node_modules',{recursive:true,force:true});
for(const l of ['package-lock.json','pnpm-lock.yaml','yarn.lock','bun.lock','bun.lockb'])if(fs.existsSync(l))fs.rmSync(l,{force:true});
const r=spawnSync(pmCmd,['install'],{stdio:'inherit',shell:win});
if(r.status!==0)process.exit(r.status??1);
"
```

## Preconditions

- `package.json` exists in the current working directory
- `npm` available on `PATH`
- Network access to the npm registry

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Running `yasha` where there is no `package.json` | `cd` into the project root first |
| Expecting semver range preservation | Yasha writes exact latest versions, not ranges |
| Running without `npm` on `PATH` | Install Node.js / ensure `npm` resolves |
