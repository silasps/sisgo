#!/usr/bin/env node
// Aplica as migrations de supabase/migrations/ no banco (DATABASE_URL do
// .env.local — hoje o de PRODUÇÃO) e registra cada uma em
// supabase_migrations.schema_migrations, o mesmo histórico que o Supabase usa.
//
// Uso:
//   npm run db:migrate                      → status: lista o que falta (não grava nada)
//   npm run db:migrate -- --apply           → aplica as pendentes, em ordem
//   npm run db:migrate -- --mark-applied=150[,151]
//                                           → só registra como aplicada(s), sem rodar
//   npm run db:migrate -- --baseline=149    → registra todas as pendentes ≤ 149, sem rodar
//                                              (--except=085[,…] deixa algumas de fora)
//
// Regras:
//   • versão = prefixo numérico do arquivo (001, 0561, 149…) — tem que ser
//     único; o script recusa rodar se dois arquivos tiverem o mesmo número.
//   • cada migration roda numa transação JUNTO com o registro no histórico:
//     ou entra inteira e registrada, ou nada muda. Para no primeiro erro.
//   • se os objetos que a migration cria já existem no banco (alguém aplicou
//     à mão sem registrar), o script para e avisa em vez de rodar de novo —
//     confira e use --mark-applied. Por isso: nunca aplique migration à mão.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')
const MIGRATIONS_DIR = path.join(PROJECT_ROOT, 'supabase', 'migrations')

// ── Args / env ─────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const flag = name => argv.find(a => a === `--${name}` || a.startsWith(`--${name}=`))
const flagValue = name => flag(name)?.split('=')[1] ?? null
const APPLY = !!flag('apply')
const MARK = flagValue('mark-applied')?.split(',').map(v => v.trim()).filter(Boolean) ?? []
const BASELINE = flagValue('baseline')
const EXCEPT = new Set(flagValue('except')?.split(',').map(v => v.trim()).filter(Boolean) ?? [])

function loadEnv() {
  const envPath = path.join(PROJECT_ROOT, '.env.local')
  if (!fs.existsSync(envPath)) return {}
  const env = {}
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
  }
  return env
}

const DATABASE_URL = process.env.DATABASE_URL ?? loadEnv().DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL ausente (nem no ambiente, nem em .env.local).')
  process.exit(1)
}

// ── psql ───────────────────────────────────────────────────────────────────

function psql(args, { allowFail = false } = {}) {
  const r = spawnSync('psql', [DATABASE_URL, '-X', '-q', '-v', 'ON_ERROR_STOP=1', ...args], { encoding: 'utf-8' })
  if (r.error) throw new Error(`psql não encontrado/erro ao executar: ${r.error.message}`)
  if (r.status !== 0 && !allowFail) throw new Error(r.stderr.trim() || `psql saiu com código ${r.status}`)
  return r
}

const query = sql => psql(['-At', '-F', '\t', '-c', sql]).stdout.split('\n').filter(Boolean)

const dollarQuote = text => {
  const tag = `$m${crypto.randomBytes(6).toString('hex')}$`
  return `${tag}${text}${tag}`
}

// ── Arquivos ───────────────────────────────────────────────────────────────

const files = fs.readdirSync(MIGRATIONS_DIR)
  .filter(f => f.endsWith('.sql'))
  .map(file => {
    const m = file.match(/^(\d+)_(.+)\.sql$/)
    if (!m) throw new Error(`Nome fora do padrão <número>_<nome>.sql: ${file}`)
    return { file, version: m[1], name: m[2], fullPath: path.join(MIGRATIONS_DIR, file) }
  })
  // Ordem de string na versão: 056 < 0561 < 057 (sub-versões encaixam depois da base).
  .sort((a, b) => (a.version < b.version ? -1 : a.version > b.version ? 1 : 0))

const byVersion = new Map()
for (const f of files) {
  if (byVersion.has(f.version)) {
    console.error(`Versão duplicada ${f.version}: ${byVersion.get(f.version).file} e ${f.file}. Renumere uma delas (ex.: ${f.version}1_...).`)
    process.exit(1)
  }
  byVersion.set(f.version, f)
}

const applied = new Set(query('select version from supabase_migrations.schema_migrations'))
const maxApplied = [...applied].sort().at(-1) ?? ''
const pending = files.filter(f => !applied.has(f.version))

// ── Detecção de "já aplicada à mão" ────────────────────────────────────────
// Só conta objetos CRIADOS pela migration que não sejam redefinições
// (create or replace / drop + create do mesmo nome) — esses já existiam antes
// e não provam nada.

const ID = '"?([A-Za-z_][\\w]*)"?'
const QUALIFIED = `(?:${ID}\\.)?${ID}`

function objectsCreatedBy(rawSql) {
  const sql = rawSql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, ' ') // corpos de função
  const re = (src, flags = 'gi') => new RegExp(src, flags)
  const all = (src) => [...sql.matchAll(re(src))]

  const dropped = new Set(all(`drop\\s+(?:policy|index|trigger|constraint|table|type|function|view)\\s+(?:if\\s+exists\\s+)?(?:"([^"]+)"|${QUALIFIED})`)
    .map(m => (m[1] ?? m[3]).toLowerCase()))

  const checks = []
  for (const m of all(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?${QUALIFIED}`)) checks.push({ kind: 'table', name: m[2] })
  for (const m of all(`create\\s+type\\s+${QUALIFIED}`)) checks.push({ kind: 'type', name: m[2] })
  for (const m of all(`create\\s+(?:unique\\s+)?index\\s+(?:concurrently\\s+)?(?:if\\s+not\\s+exists\\s+)?${ID}\\s+on`)) checks.push({ kind: 'index', name: m[1] })
  for (const m of all(`create\\s+trigger\\s+${ID}`)) checks.push({ kind: 'trigger', name: m[1] })
  for (const m of all(`create\\s+function\\s+${QUALIFIED}`)) checks.push({ kind: 'function', name: m[2] })
  for (const m of all(`create\\s+policy\\s+"([^"]+)"\\s+on\\s+${QUALIFIED}`)) checks.push({ kind: 'policy', name: m[1], table: m[3] })
  for (const m of all(`add\\s+constraint\\s+${ID}`)) checks.push({ kind: 'constraint', name: m[1] })
  for (const m of all(`alter\\s+table\\s+(?:if\\s+exists\\s+)?(?:only\\s+)?${QUALIFIED}([^;]*)`)) {
    for (const c of m[3].matchAll(re(`add\\s+column\\s+(?:if\\s+not\\s+exists\\s+)?${ID}`))) {
      checks.push({ kind: 'column', table: m[2], name: c[1] })
    }
  }
  return checks.filter(c => !dropped.has(c.name.toLowerCase()))
}

let catalog = null
function loadCatalog() {
  const set = sql => new Set(query(sql).map(s => s.toLowerCase()))
  return {
    table: set(`select table_name from information_schema.tables where table_schema not in ('pg_catalog','information_schema')`),
    type: set(`select typname from pg_type`),
    index: set(`select indexname from pg_indexes`),
    trigger: set(`select tgname from pg_trigger where not tgisinternal`),
    function: set(`select proname from pg_proc`),
    policy: set(`select tablename || '.' || policyname from pg_policies`),
    constraint: set(`select conname from pg_constraint`),
    column: set(`select table_name || '.' || column_name from information_schema.columns`),
  }
}

function detect(file) {
  catalog ??= loadCatalog()
  const checks = objectsCreatedBy(fs.readFileSync(file.fullPath, 'utf-8'))
  const key = c => (c.kind === 'policy' || c.kind === 'column' ? `${c.table}.${c.name}` : c.name).toLowerCase()
  const present = checks.filter(c => catalog[c.kind].has(key(c)))
  const missing = checks.filter(c => !catalog[c.kind].has(key(c)))
  const state = checks.length === 0 ? 'sem-ddl' : missing.length === 0 ? 'ja-existe' : present.length === 0 ? 'ausente' : 'parcial'
  return { state, checks, present, missing }
}

const describe = c => `${c.kind} ${c.table ? `${c.table}.` : ''}${c.name}`

// ── Ações ──────────────────────────────────────────────────────────────────

function record(file, { execute }) {
  const content = fs.readFileSync(file.fullPath, 'utf-8')
  const insert = `insert into supabase_migrations.schema_migrations (version, name, statements) values (${dollarQuote(file.version)}, ${dollarQuote(file.name)}, array[${dollarQuote(content)}]);`
  const wrapper = path.join(os.tmpdir(), `sisgo-migrate-${file.version}-${process.pid}.sql`)
  fs.writeFileSync(wrapper, `${execute ? `\\i '${file.fullPath.replace(/'/g, "''")}'\n` : ''}${insert}\n`)
  try {
    psql(['--single-transaction', '-f', wrapper])
  } finally {
    fs.rmSync(wrapper, { force: true })
  }
}

function markApplied(versions) {
  for (const v of versions) {
    const f = byVersion.get(v)
    if (!f) throw new Error(`Versão ${v} não existe em supabase/migrations/`)
    if (applied.has(v)) { console.log(`= ${f.file} já estava registrada`); continue }
    record(f, { execute: false })
    applied.add(v)
    console.log(`✓ ${f.file} registrada como aplicada (sem executar)`)
  }
}

if (MARK.length > 0) {
  markApplied(MARK)
  process.exit(0)
}

if (BASELINE) {
  markApplied(pending.filter(f => f.version <= BASELINE && !EXCEPT.has(f.version)).map(f => f.version))
  process.exit(0)
}

if (pending.length === 0) {
  console.log(`Banco em dia — ${applied.size} migrations registradas (última: ${maxApplied}).`)
  process.exit(0)
}

console.log(`${pending.length} migration(s) pendente(s) (última registrada: ${maxApplied}):`)
for (const f of pending) {
  const d = detect(f)
  const note = {
    'sem-ddl': 'sem objetos detectáveis — será executada',
    ausente: 'objetos ainda não existem — será executada',
    'ja-existe': `JÁ EXISTE no banco (${d.present.map(describe).join(', ')}) — alguém aplicou à mão?`,
    parcial: `PARCIAL — existe: ${d.present.map(describe).join(', ')} | falta: ${d.missing.map(describe).join(', ')}`,
  }[d.state]
  const order = f.version < maxApplied ? ' [fora de ordem: número menor que a última registrada]' : ''
  console.log(`  ${f.file}: ${note}${order}`)
  f.detection = d
}

if (!APPLY) {
  console.log('\nNada foi gravado. Para aplicar: npm run db:migrate -- --apply')
  process.exit(0)
}

for (const f of pending) {
  if (f.detection.state === 'ja-existe' || f.detection.state === 'parcial') {
    console.error(`\n✗ Parei em ${f.file}: ${f.detection.state === 'ja-existe' ? 'os objetos dela já existem' : 'só parte dos objetos existe'}.`)
    console.error('  Confira o banco. Se ela já foi aplicada por completo: npm run db:migrate -- --mark-applied=' + f.version)
    process.exit(1)
  }
  process.stdout.write(`→ ${f.file} … `)
  try {
    record(f, { execute: true })
  } catch (err) {
    console.log('ERRO (nada desta migration foi gravado)')
    console.error(err.message)
    process.exit(1)
  }
  console.log('ok')
}
console.log('\nTodas as pendentes aplicadas e registradas.')
