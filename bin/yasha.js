#!/usr/bin/env node

import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const cwd = process.cwd()
const pkgPath = join(cwd, 'package.json')
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'

if (!existsSync(pkgPath)) {
  console.error('Error: no package.json found in current directory')
  process.exit(1)
}

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

const depGroups = ['dependencies', 'devDependencies']

for (const group of depGroups) {
  if (!pkg[group]) continue
  for (const name of Object.keys(pkg[group])) {
    try {
      const latest = execFileSync(npmCmd, ['view', name, 'version'], { encoding: 'utf8' }).trim()
      pkg[group][name] = latest
    } catch {
      console.warn(`Warning: could not resolve latest version for ${name}, skipping`)
    }
  }
}

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')

const nodeModulesPath = join(cwd, 'node_modules')
if (existsSync(nodeModulesPath)) {
  rmSync(nodeModulesPath, { recursive: true, force: true })
}

const lockPath = join(cwd, 'package-lock.json')
if (existsSync(lockPath)) {
  rmSync(lockPath)
}

execFileSync(npmCmd, ['install'], { stdio: 'inherit', cwd })
