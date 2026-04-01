import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const yashaPath = resolve('bin/yasha.js')
const mockNpmDir = resolve('test')

function runYasha(cwd) {
  return execFileSync('node', [yashaPath], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${mockNpmDir}:${process.env.PATH}` }
  })
}

test('updates dependencies and devDependencies to latest', () => {
  const dir = mkdtempSync(join(tmpdir(), 'yasha-test-'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: 'test-pkg',
    dependencies: { express: '^4.0.0' },
    devDependencies: { jest: '^27.0.0' }
  }, null, 2))

  runYasha(dir)

  const result = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  assert.equal(result.dependencies.express, '9.9.9')
  assert.equal(result.devDependencies.jest, '9.9.9')
})

test('removes node_modules and package-lock.json before installing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'yasha-test-'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: 'test-pkg',
    dependencies: { express: '^4.0.0' }
  }, null, 2))

  mkdirSync(join(dir, 'node_modules'))
  writeFileSync(join(dir, 'package-lock.json'), '{}')

  runYasha(dir)

  assert.equal(existsSync(join(dir, 'package-lock.json')), false)
})

test('exits with error when no package.json found', () => {
  const dir = mkdtempSync(join(tmpdir(), 'yasha-test-'))
  assert.throws(
    () => execFileSync('node', [yashaPath], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${mockNpmDir}:${process.env.PATH}` }
    }),
    (err) => {
      assert.match(err.stderr, /no package\.json found/)
      return true
    }
  )
})

test('preserves other package.json fields', () => {
  const dir = mkdtempSync(join(tmpdir(), 'yasha-test-'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: 'my-app',
    version: '2.0.0',
    description: 'hello',
    dependencies: { lodash: '4.0.0' }
  }, null, 2))

  runYasha(dir)

  const result = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  assert.equal(result.name, 'my-app')
  assert.equal(result.version, '2.0.0')
  assert.equal(result.description, 'hello')
  assert.equal(result.dependencies.lodash, '9.9.9')
})
