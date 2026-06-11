#!/usr/bin/env node
// Importa inscrições de um formulário externo (Google Forms exportado
// como .xlsx ou .csv) para o sisgo: cria registros em
// `school_interest_forms` (pré-inscrição) + `school_applications`
// (formulário preenchido), já linkados, prontos para aparecer na tela
// de Inscrições.
//
// Uso:
//   node scripts/import-applications/run.mjs <arquivo.xlsx> --org=<slug> [opções]
//
// Opções:
//   --org=<slug>         (obrigatório) slug da organização, ex: jocum-almirante-tamandare
//   --school=<nome|id>   nome (parcial, case-insensitive) ou id da escola. Se omitido e
  //                         houver só uma escola de inscrição na org, usa essa.
//   --turma=<nome|id>    nome (parcial) ou id da turma. Se omitido, usa a única turma
//                         ativa + com inscrições abertas da escola escolhida.
//   --confirm            sem essa flag, roda em modo "dry run": só mostra o que
//                         seria importado, sem gravar nada no banco.
//
// Exemplo:
//   node scripts/import-applications/run.mjs ~/Downloads/respostas.xlsx --org=jocum-almirante-tamandare
//   node scripts/import-applications/run.mjs ~/Downloads/respostas.xlsx --org=jocum-almirante-tamandare --confirm

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { readTable } from './lib/read-table.mjs'
import * as dts from './mappings/dts.mjs'

const MAPPINGS = [dts]

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '../..')

// ── Args ──────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { _: [], confirm: false }
  for (const arg of argv) {
    if (arg === '--confirm') { args.confirm = true; continue }
    const m = arg.match(/^--([^=]+)=(.*)$/)
    if (m) { args[m[1]] = m[2]; continue }
    args._.push(arg)
  }
  return args
}

// ── .env.local ────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(PROJECT_ROOT, '.env.local')
  if (!fs.existsSync(envPath)) {
    throw new Error(`.env.local não encontrado em ${envPath}`)
  }
  const env = {}
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim()
  }
  return env
}

// ── Detecção de mapeamento ───────────────────────────────────────────────

function detectMapping(headers) {
  for (const mapping of MAPPINGS) {
    if (mapping.signature.every(col => headers.includes(col))) return mapping
  }
  return null
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const filePath = args._[0]

  if (!filePath) {
    console.error('Uso: node scripts/import-applications/run.mjs <arquivo.xlsx> --org=<slug> [--school=...] [--turma=...] [--confirm]')
    process.exit(1)
  }
  if (!args.org) {
    console.error('Faltou o parâmetro --org=<slug-da-organizacao>')
    process.exit(1)
  }
  if (!fs.existsSync(filePath)) {
    console.error(`Arquivo não encontrado: ${filePath}`)
    process.exit(1)
  }

  const env = loadEnv()
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes em .env.local')
  }
  const sb = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

  // ── Lê a planilha ────────────────────────────────────────────────────
  const rows = await readTable(filePath)
  if (!rows.length) {
    console.error('A planilha não tem nenhuma linha de dados.')
    process.exit(1)
  }
  const headers = Object.keys(rows[0])

  const mapping = detectMapping(headers)
  if (!mapping) {
    const previewPath = path.join(__dirname, 'pending-mappings', `unmapped-${Date.now()}.json`)
    fs.mkdirSync(path.dirname(previewPath), { recursive: true })
    fs.writeFileSync(previewPath, JSON.stringify({ headers, sampleRow: rows[0] }, null, 2), 'utf-8')
    console.error(
      'Não reconheci este formulário (cabeçalhos não batem com nenhum mapeamento conhecido).\n' +
      `Salvei os cabeçalhos + uma linha de exemplo em:\n  ${previewPath}\n\n` +
      'Peça para o Claude criar um novo mapeamento em scripts/import-applications/mappings/ ' +
      'com base nesse arquivo (veja o README desta pasta).'
    )
    process.exit(1)
  }
  console.log(`Formulário reconhecido: ${mapping.name}`)
  console.log(`${rows.length} linha(s) encontrada(s).\n`)

  // ── Resolve organização ──────────────────────────────────────────────
  const { data: org, error: orgError } = await sb
    .from('organizations')
    .select('id, name, slug')
    .eq('slug', args.org)
    .single()
  if (orgError || !org) {
    throw new Error(`Organização com slug "${args.org}" não encontrada (${orgError?.message ?? 'sem dados'}).`)
  }

  // ── Resolve escola ────────────────────────────────────────────────────
  let schoolQuery = sb.from('schools').select('id, name, school_type').eq('organization_id', org.id).in('school_type', ['eted', 'segundo_nivel', 'udn', 'seminario', 'curso_online'])
  const { data: schools } = await schoolQuery
  let school
  if (args.school) {
    school = (schools ?? []).find(s => s.id === args.school || s.name.toLowerCase().includes(args.school.toLowerCase()))
    if (!school) throw new Error(`Nenhuma escola encontrada com --school="${args.school}". Opções: ${(schools ?? []).map(s => s.name).join(', ')}`)
  } else if ((schools ?? []).length === 1) {
    school = schools[0]
  } else {
    throw new Error(`Mais de uma escola de inscrição na organização — use --school=<nome ou id>. Opções: ${(schools ?? []).map(s => `${s.name} (${s.id})`).join(', ')}`)
  }

  // ── Resolve turma ─────────────────────────────────────────────────────
  const { data: classes } = await sb
    .from('school_classes')
    .select('id, name, active, registrations_open, starts_at')
    .eq('school_id', school.id)
    .order('starts_at', { ascending: true })

  let schoolClass
  if (args.turma) {
    schoolClass = (classes ?? []).find(c => c.id === args.turma || c.name.toLowerCase().includes(args.turma.toLowerCase()))
    if (!schoolClass) throw new Error(`Nenhuma turma encontrada com --turma="${args.turma}". Opções: ${(classes ?? []).map(c => c.name).join(', ')}`)
  } else {
    const open = (classes ?? []).filter(c => c.active && c.registrations_open)
    if (open.length === 1) {
      schoolClass = open[0]
    } else if (open.length === 0) {
      throw new Error(`Nenhuma turma ativa com inscrições abertas em "${school.name}". Use --turma=<nome ou id>. Todas: ${(classes ?? []).map(c => `${c.name} (ativa=${c.active}, abertas=${c.registrations_open})`).join(', ')}`)
    } else {
      throw new Error(`Mais de uma turma ativa com inscrições abertas em "${school.name}" — use --turma=<nome ou id>. Opções: ${open.map(c => `${c.name} (${c.id})`).join(', ')}`)
    }
  }

  console.log(`Organização: ${org.name} (${org.slug})`)
  console.log(`Escola: ${school.name}`)
  console.log(`Turma: ${schoolClass.name}\n`)

  // ── Mapeia cada linha ─────────────────────────────────────────────────
  const ctx = { escola: school.name, turma: schoolClass.name }
  const mapped = rows.map(row => mapping.mapRow(row, ctx))

  for (const item of mapped) {
    console.log(`── ${item.fullName || '(sem nome)'} <${item.email || 'sem e-mail'}>`)
    if (item.warnings.length) {
      for (const w of item.warnings) console.log(`   ⚠ ${w}`)
    }
    console.log(`   form_data: ${JSON.stringify(item.formData)}`)
    console.log('')
  }

  if (!args.confirm) {
    console.log('Modo DRY RUN — nada foi gravado no banco. Confira os dados/avisos acima.')
    console.log('Se estiver tudo certo, rode novamente com --confirm para gravar.')
    return
  }

  // ── Grava no banco ────────────────────────────────────────────────────
  const results = []
  for (const item of mapped) {
    if (!item.email) {
      results.push({ nome: item.fullName, status: 'ERRO', detalhe: 'sem e-mail, pulado' })
      continue
    }

    const { data: existingApp } = await sb
      .from('school_applications')
      .select('id')
      .eq('class_id', schoolClass.id)
      .eq('form_data->s1->>email', item.email)
      .maybeSingle()

    if (existingApp) {
      results.push({ nome: item.fullName, status: 'IGNORADO', detalhe: `já existe application ${existingApp.id} para este e-mail/turma` })
      continue
    }

    const { data: interestForm, error: ifError } = await sb
      .from('school_interest_forms')
      .insert({
        organization_id: org.id,
        school_id: school.id,
        class_id: schoolClass.id,
        full_name: item.fullName,
        email: item.email,
        phone: item.phone ?? null,
        status: 'formulario_enviado',
      })
      .select('id')
      .single()
    if (ifError) {
      results.push({ nome: item.fullName, status: 'ERRO', detalhe: `school_interest_forms: ${ifError.message}` })
      continue
    }

    const { data: application, error: appError } = await sb
      .from('school_applications')
      .insert({
        organization_id: org.id,
        school_id: school.id,
        class_id: schoolClass.id,
        interest_form_id: interestForm.id,
        status: 'em_analise',
        current_section: 16,
        form_data: item.formData,
      })
      .select('id')
      .single()
    if (appError) {
      results.push({ nome: item.fullName, status: 'ERRO', detalhe: `school_applications: ${appError.message}` })
      continue
    }

    results.push({ nome: item.fullName, status: 'OK', detalhe: `interest_form=${interestForm.id} application=${application.id}` })
  }

  console.log('── Resultado ──')
  for (const r of results) console.log(`${r.status.padEnd(9)} ${r.nome.padEnd(28)} ${r.detalhe}`)
}

main().catch(err => {
  console.error('Erro:', err.message)
  process.exit(1)
})
