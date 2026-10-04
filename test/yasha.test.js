import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const yashaPath = resolve(new URL('.', import.meta.url).pathname, '../bin/yasha.js')

const mockNpmScript = `#!/usr/bin/env bash
if [[ "$1" == "view" ]]; then
  echo "9.9.9"
elif [[ "$1" == "install" ]]; then
  echo "mock npm install"
fi
`

function makeTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'yasha-test-'))
  writeFileSync(join(dir, 'npm'), mockNpmScript, { mode: 0o755 })
  return dir
}

function runYasha(cwd, mockDir) {
  return execFileSync('node', [yashaPath], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${mockDir}:${process.env.PATH}` }
  })
}

test('updates dependencies and devDependencies to latest', () => {
  const mockDir = makeTempDir()
  const dir = mkdtempSync(join(tmpdir(), 'yasha-test-'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: 'test-pkg',
    dependencies: { express: '^4.0.0' },
    devDependencies: { jest: '^27.0.0' }
  }, null, 2))

  runYasha(dir, mockDir)

  const result = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  assert.equal(result.dependencies.express, '9.9.9')
  assert.equal(result.devDependencies.jest, '9.9.9')
})

test('removes node_modules and package-lock.json before installing', () => {
  const mockDir = makeTempDir()
  const dir = mkdtempSync(join(tmpdir(), 'yasha-test-'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: 'test-pkg',
    dependencies: { express: '^4.0.0' }
  }, null, 2))

  mkdirSync(join(dir, 'node_modules'))
  writeFileSync(join(dir, 'package-lock.json'), '{}')

  runYasha(dir, mockDir)

  assert.equal(existsSync(join(dir, 'package-lock.json')), false)
  assert.equal(existsSync(join(dir, 'node_modules')), false)
})

test('exits with error when no package.json found', () => {
  const mockDir = makeTempDir()
  const dir = mkdtempSync(join(tmpdir(), 'yasha-test-'))
  assert.throws(
    () => execFileSync('node', [yashaPath], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${mockDir}:${process.env.PATH}` }
    }),
    (err) => {
      assert.match(err.stderr, /no package\.json found/)
      return true
    }
  )
})

test('preserves other package.json fields', () => {
  const mockDir = makeTempDir()
  const dir = mkdtempSync(join(tmpdir(), 'yasha-test-'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: 'my-app',
    version: '2.0.0',
    description: 'hello',
    dependencies: { lodash: '4.0.0' }
  }, null, 2))

  runYasha(dir, mockDir)

  const result = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  assert.equal(result.name, 'my-app')
  assert.equal(result.version, '2.0.0')
  assert.equal(result.description, 'hello')
  assert.equal(result.dependencies.lodash, '9.9.9')
})

test('updates peerDependencies, optionalDependencies, resolutions, and overrides', () => {
  const mockDir = makeTempDir()
  const dir = mkdtempSync(join(tmpdir(), 'yasha-test-'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: 'test-overrides',
    dependencies: { '@xenova/transformers': '2.17.2' },
    peerDependencies: { react: '^18.0.0' },
    optionalDependencies: { 'sharp': '^0.33.0' },
    overrides: {
      protobufjs: '^7.6.3',
      sharp: '^0.35.4'
    },
    resolutions: {
      d3: '^7.0.0'
    }
  }, null, 2))

  runYasha(dir, mockDir)

  const result = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  assert.equal(result.dependencies['@xenova/transformers'], '9.9.9')
  assert.equal(result.peerDependencies.react, '9.9.9')
  assert.equal(result.optionalDependencies.sharp, '9.9.9')
  assert.equal(result.overrides.protobufjs, '9.9.9')
  assert.equal(result.overrides.sharp, '9.9.9')
  assert.equal(result.resolutions.d3, '9.9.9')
})

test('updates nested overrides and pnpm.overrides', () => {
  const mockDir = makeTempDir()
  const dir = mkdtempSync(join(tmpdir(), 'yasha-test-'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: 'test-nested',
    overrides: {
      'parent > child': '^1.0.0',
      parent: {
        child2: '^2.0.0'
      }
    },
    pnpm: {
      overrides: {
        protobufjs: '^7.6.3'
      }
    }
  }, null, 2))

  runYasha(dir, mockDir)

  const result = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  assert.equal(result.overrides['parent > child'], '9.9.9')
  assert.equal(result.overrides.parent.child2, '9.9.9')
  assert.equal(result.pnpm.overrides.protobufjs, '9.9.9')
})

test('detects pnpm from lockfile, cleans multi-lockfiles, and executes pnpm install', () => {
  const mockDir = mkdtempSync(join(tmpdir(), 'yasha-test-'))
  const pnpmScript = `#!/usr/bin/env bash
if [[ "$1" == "view" ]]; then
  echo "9.9.9"
elif [[ "$1" == "install" ]]; then
  echo "mock pnpm install"
  touch "installed_by_pnpm"
fi
`
  writeFileSync(join(mockDir, 'pnpm'), pnpmScript, { mode: 0o755 })
  writeFileSync(join(mockDir, 'npm'), mockNpmScript, { mode: 0o755 })

  const dir = mkdtempSync(join(tmpdir(), 'yasha-test-'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: 'pnpm-app',
    dependencies: { 'better-sqlite3': '13.0.3' }
  }, null, 2))
  writeFileSync(join(dir, 'pnpm-lock.yaml'), '# pnpm lock')
  writeFileSync(join(dir, 'package-lock.json'), '{}')
  mkdirSync(join(dir, 'node_modules'))

  runYasha(dir, mockDir)

  assert.equal(existsSync(join(dir, 'pnpm-lock.yaml')), false)
  assert.equal(existsSync(join(dir, 'package-lock.json')), false)
  assert.equal(existsSync(join(dir, 'node_modules')), false)
  assert.equal(existsSync(join(dir, 'installed_by_pnpm')), true)

  const result = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  assert.equal(result.dependencies['better-sqlite3'], '9.9.9')
})

test('updates overrides in pnpm-workspace.yaml', () => {
  const mockDir = mkdtempSync(join(tmpdir(), 'yasha-test-'))
  const pnpmScript = `#!/usr/bin/env bash
if [[ "$1" == "view" ]]; then
  echo "9.9.9"
elif [[ "$1" == "install" ]]; then
  echo "mock pnpm install"
  touch "installed_by_pnpm"
fi
`
  writeFileSync(join(mockDir, 'pnpm'), pnpmScript, { mode: 0o755 })

  const dir = mkdtempSync(join(tmpdir(), 'yasha-test-'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: 'pnpm-workspace-app',
    dependencies: { ignore: '7.0.12' }
  }, null, 2))

  const workspaceYaml = `allowBuilds:
  onnxruntime-node: true
  protobufjs: true
  sharp: true

overrides:
  protobufjs: '>=7.6.3'
  sharp: '>=0.35.4'
`
  writeFileSync(join(dir, 'pnpm-workspace.yaml'), workspaceYaml)

  runYasha(dir, mockDir)

  const updatedYaml = readFileSync(join(dir, 'pnpm-workspace.yaml'), 'utf8')
  assert.match(updatedYaml, /protobufjs:\s*'9\.9\.9'/)
  assert.match(updatedYaml, /sharp:\s*'9\.9\.9'/)
  assert.match(updatedYaml, /allowBuilds:/)
})

test('detects yarn and bun and removes respective lockfiles', () => {
  const mockDir = mkdtempSync(join(tmpdir(), 'yasha-test-'))
  const yarnScript = `#!/usr/bin/env bash
if [[ "$1" == "install" ]]; then
  touch "installed_by_yarn"
fi
`
  const bunScript = `#!/usr/bin/env bash
if [[ "$1" == "install" ]]; then
  touch "installed_by_bun"
fi
`
  writeFileSync(join(mockDir, 'npm'), mockNpmScript, { mode: 0o755 })
  writeFileSync(join(mockDir, 'yarn'), yarnScript, { mode: 0o755 })
  writeFileSync(join(mockDir, 'bun'), bunScript, { mode: 0o755 })

  // Yarn test
  const yarnDir = mkdtempSync(join(tmpdir(), 'yasha-test-'))
  writeFileSync(join(yarnDir, 'package.json'), JSON.stringify({
    name: 'yarn-app',
    dependencies: { lodash: '4.0.0' }
  }, null, 2))
  writeFileSync(join(yarnDir, 'yarn.lock'), '')
  runYasha(yarnDir, mockDir)
  assert.equal(existsSync(join(yarnDir, 'yarn.lock')), false)
  assert.equal(existsSync(join(yarnDir, 'installed_by_yarn')), true)

  // Bun test
  const bunDir = mkdtempSync(join(tmpdir(), 'yasha-test-'))
  writeFileSync(join(bunDir, 'package.json'), JSON.stringify({
    name: 'bun-app',
    dependencies: { lodash: '4.0.0' }
  }, null, 2))
  writeFileSync(join(bunDir, 'bun.lockb'), '')
  runYasha(bunDir, mockDir)
  assert.equal(existsSync(join(bunDir, 'bun.lockb')), false)
  assert.equal(existsSync(join(bunDir, 'installed_by_bun')), true)
})
