---
name: yasha
description: Use when the user mentions yasha, wants to upgrade or bump every Node.js dependency in package.json to the latest published version, or asks how to install, uninstall, or run yasha. Applies even if the user does not say "yasha" explicitly but wants all packages updated to latest.
---

# Yasha

Upgrades every entry in `dependencies` and `devDependencies` of `package.json` to the latest published version, wipes `node_modules` and `package-lock.json`, then reinstalls clean.

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

1. Reads `package.json` in current directory
2. For every key in `dependencies` and `devDependencies`, runs `npm view <pkg> version`
3. Writes resolved versions back into `package.json` (exact version, no semver range)
4. Deletes `node_modules/` and `package-lock.json`
5. Runs `npm install`

If a package version cannot be resolved, that package is skipped with a warning. Other packages still update.

## Manual fallback (no CLI installed)

Run from the project root:

```sh
node -e "
const fs=require('fs'),{execFileSync,spawnSync}=require('child_process');
const win=process.platform==='win32';
const npm=win?'npm.cmd':'npm';
const opts={shell:win};
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
for(const g of ['dependencies','devDependencies']){
  if(!pkg[g])continue;
  for(const n of Object.keys(pkg[g])){
    try{pkg[g][n]=execFileSync(npm,['view',n,'version'],{encoding:'utf8',...opts}).trim()}
    catch{console.warn('skip',n)}
  }
}
fs.writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n');
fs.rmSync('node_modules',{recursive:true,force:true});
fs.rmSync('package-lock.json',{force:true});
const r=spawnSync(npm,['install'],{stdio:'inherit',shell:win});
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
