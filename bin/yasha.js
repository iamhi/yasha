#!/usr/bin/env node

import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { join } from 'node:path'

const cwd = process.cwd()
const pkgPath = join(cwd, 'package.json')
const isWindows = process.platform === 'win32'
const npmCmd = isWindows ? 'npm.cmd' : 'npm'
const execOpts = { shell: isWindows }

if (!existsSync(pkgPath)) {
  console.error('Error: no package.json found in current directory')
  process.exit(1)
}

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

const depGroups = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
  'resolutions'
]

function detectPackageManager(dir, packageJson) {
  if (typeof packageJson?.packageManager === 'string') {
    const pmName = packageJson.packageManager.split('@')[0]
    if (['pnpm', 'yarn', 'bun', 'npm'].includes(pmName)) {
      return pmName
    }
  }

  if (existsSync(join(dir, 'pnpm-lock.yaml')) || existsSync(join(dir, 'pnpm-workspace.yaml'))) {
    return 'pnpm'
  }
  if (existsSync(join(dir, 'yarn.lock'))) {
    return 'yarn'
  }
  if (existsSync(join(dir, 'bun.lockb')) || existsSync(join(dir, 'bun.lock'))) {
    return 'bun'
  }
  if (existsSync(join(dir, 'package-lock.json'))) {
    return 'npm'
  }

  return 'npm'
}

function getPmCommand(pm, win) {
  if (win) {
    return pm === 'bun' ? 'bun' : `${pm}.cmd`
  }
  return pm
}

function extractPackageName(key) {
  const targetPart = key.includes('>') ? key.split('>').pop().trim() : key
  if (targetPart.startsWith('@')) {
    const secondAt = targetPart.indexOf('@', 1)
    return secondAt !== -1 ? targetPart.slice(0, secondAt) : targetPart
  }
  const firstAt = targetPart.indexOf('@')
  return firstAt !== -1 ? targetPart.slice(0, firstAt) : targetPart
}

const pm = detectPackageManager(cwd, pkg)
const pmCmd = getPmCommand(pm, isWindows)

function resolveLatest(name) {
  const candidates = []
  if (pm === 'pnpm') candidates.push(pmCmd)
  if (!candidates.includes(npmCmd)) candidates.push(npmCmd)
  if (!candidates.includes(pmCmd)) candidates.push(pmCmd)

  for (const cmd of candidates) {
    try {
      const latest = execFileSync(cmd, ['view', name, 'version'], { encoding: 'utf8', ...execOpts }).trim()
      if (latest) return latest
    } catch {
      // try next candidate
    }
  }
  return null
}

function updateOverrideMap(target) {
  if (!target || typeof target !== 'object') return
  for (const [key, val] of Object.entries(target)) {
    if (typeof val === 'string') {
      if (val.startsWith('$')) continue
      const pkgName = extractPackageName(key)
      const latest = resolveLatest(pkgName)
      if (latest) {
        target[key] = latest
      } else {
        console.warn(`Warning: could not resolve latest version for ${pkgName}, skipping`)
      }
    } else if (val && typeof val === 'object') {
      updateOverrideMap(val)
    }
  }
}

function updatePnpmWorkspaceFile(workspacePath) {
  if (!existsSync(workspacePath)) return
  const content = readFileSync(workspacePath, 'utf8')
  const lines = content.split(/\r?\n/)
  let inOverrides = false
  let overridesIndent = null
  let modified = false

  const newLines = lines.map(line => {
    const sectionMatch = line.match(/^(\s*)(overrides|catalog|catalogs):\s*$/)
    if (sectionMatch) {
      inOverrides = true
      overridesIndent = null
      return line
    }

    if (inOverrides) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return line

      const lineIndentMatch = line.match(/^(\s+)(.*)$/)
      if (!lineIndentMatch) {
        inOverrides = false
        overridesIndent = null
        return line
      }

      const indent = lineIndentMatch[1]
      if (overridesIndent === null) {
        overridesIndent = indent.length
      } else if (indent.length < overridesIndent) {
        inOverrides = false
        overridesIndent = null
        return line
      }

      const rest = line.slice(indent.length)
      let colonIdx = -1
      let inQuote = null
      for (let i = 0; i < rest.length; i++) {
        const ch = rest[i]
        if ((ch === '"' || ch === "'") && (i === 0 || rest[i - 1] !== '\\')) {
          if (!inQuote) inQuote = ch
          else if (inQuote === ch) inQuote = null
        } else if (ch === ':' && !inQuote) {
          colonIdx = i
          break
        }
      }

      if (colonIdx !== -1) {
        const rawKey = rest.slice(0, colonIdx).trim()
        const rawVal = rest.slice(colonIdx + 1).trim()
        const keyQuote = (rawKey.startsWith("'") && rawKey.endsWith("'")) || (rawKey.startsWith('"') && rawKey.endsWith('"')) ? rawKey[0] : ''
        const unquotedKey = keyQuote ? rawKey.slice(1, -1) : rawKey
        const pkgName = extractPackageName(unquotedKey)
        const latest = resolveLatest(pkgName)
        if (latest) {
          modified = true
          const valQuote = (rawVal.startsWith("'") && rawVal.endsWith("'")) || (rawVal.startsWith('"') && rawVal.endsWith('"')) ? rawVal[0] : "'"
          return `${indent}${keyQuote}${unquotedKey}${keyQuote}: ${valQuote}${latest}${valQuote}`
        } else {
          console.warn(`Warning: could not resolve latest version for ${pkgName}, skipping`)
        }
      }
    }

    return line
  })

  if (modified) {
    writeFileSync(workspacePath, newLines.join('\n'), 'utf8')
  }
}

for (const group of depGroups) {
  if (!pkg[group]) continue
  for (const name of Object.keys(pkg[group])) {
    const latest = resolveLatest(name)
    if (latest) {
      pkg[group][name] = latest
    } else {
      console.warn(`Warning: could not resolve latest version for ${name}, skipping`)
    }
  }
}

if (pkg.overrides) {
  updateOverrideMap(pkg.overrides)
}

if (pkg.pnpm && pkg.pnpm.overrides) {
  updateOverrideMap(pkg.pnpm.overrides)
}

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')

const pnpmWorkspacePath = join(cwd, 'pnpm-workspace.yaml')
if (existsSync(pnpmWorkspacePath)) {
  updatePnpmWorkspaceFile(pnpmWorkspacePath)
}

const nodeModulesPath = join(cwd, 'node_modules')
if (existsSync(nodeModulesPath)) {
  rmSync(nodeModulesPath, { recursive: true, force: true })
}

const lockFiles = [
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lock',
  'bun.lockb'
]

for (const lockFile of lockFiles) {
  const lockPath = join(cwd, lockFile)
  if (existsSync(lockPath)) {
    rmSync(lockPath, { force: true })
  }
}

const installResult = spawnSync(pmCmd, ['install'], { stdio: 'inherit', cwd, shell: isWindows })
if (installResult.error) {
  console.error(`Error running ${pmCmd}: ${installResult.error.message}`)
  process.exit(1)
}
if (installResult.status !== 0) {
  process.exit(installResult.status ?? 1)
}
