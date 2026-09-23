#!/usr/bin/env -S npx tsx
// Import one-off do lote de 156 obreiros ativos (JOCUM Almirante Tamandaré),
// vindo de duas planilhas do Drive já cruzadas/limpas numa conversa anterior
// (ver plano em ~/.claude/plans). Reaproveita a lógica real do wizard de
// import de pessoas (src/lib/import-pessoas/createPerson.ts) em vez de
// duplicar — roda via `npx tsx` pra poder importar os módulos TS do projeto
// (os aliases @/* são resolvidos pelo tsconfig.json).
//
// Uso:
//   npx tsx scripts/import-obreiros-lote-2026-09/run.ts            (dry run)
//   npx tsx scripts/import-obreiros-lote-2026-09/run.ts --confirm  (grava)
//
// Dados de entrada: scratchpad/import-obreiros/pessoas.json (gerado a partir
// das planilhas). Cada pessoa tem papel fixo 'obreiro' e ministério sempre
// preenchido (nenhuma das 156 está sem ministério).
//
// Log incremental em scratchpad/import-obreiros/log.json — se o script for
// interrompido no meio, rodar de novo com --confirm pula quem já está
// marcado 'ok' no log (não há como deduplicar pelo banco quem não tem
// email).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')

// tsx não carrega .env.local automaticamente como o Next faz — carrega à mão.
for (const line of fs.readFileSync(path.join(REPO_ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const { createAdminClient } = await import('@/lib/supabase/admin')
const { createImportedPerson } = await import('@/lib/import-pessoas/createPerson')

const ORG_SLUG = 'jocum-almirante-tamandare'
const PESSOAS_JSON = '/private/tmp/claude-501/-Users-kankao-sisgo/4133abd3-eae7-479a-93ba-6684c748294d/scratchpad/import-obreiros/pessoas.json'
const LOG_JSON = '/private/tmp/claude-501/-Users-kankao-sisgo/4133abd3-eae7-479a-93ba-6684c748294d/scratchpad/import-obreiros/log.json'
const NOME_COM_RG = 'Ademilson dos Santos Silva'

const CONFIRM = process.argv.includes('--confirm')

type PessoaEntrada = {
  nome: string
  email: string | null
  telefone: string | null
  sexo: 'M' | 'F' | null
  dataNascimento: string | null
  cargo: string | null
  ministerio: string | null
  documento: { type: 'cpf' | 'rg' | 'outro'; number: string } | null
}

function norm(s: string) {
  return s.trim().toLowerCase().normalize('NFKC')
}

function loadLog(): Record<string, { status: string; message: string }> {
  if (!fs.existsSync(LOG_JSON)) return {}
  return JSON.parse(fs.readFileSync(LOG_JSON, 'utf8'))
}

function saveLog(log: Record<string, { status: string; message: string }>) {
  fs.writeFileSync(LOG_JSON, JSON.stringify(log, null, 2))
}

async function main() {
  const db = createAdminClient()
  const pessoas: PessoaEntrada[] = JSON.parse(fs.readFileSync(PESSOAS_JSON, 'utf8'))

  const { data: org, error: orgError } = await db.from('organizations').select('id, name').eq('slug', ORG_SLUG).single()
  if (orgError || !org) throw new Error(`Organização "${ORG_SLUG}" não encontrada: ${orgError?.message}`)

  console.log(`\n=== ${CONFIRM ? 'CONFIRM — vai gravar no banco' : 'DRY RUN — nada será gravado'} ===`)
  console.log(`Organização: ${org.name} (${org.id})`)
  console.log(`Pessoas no arquivo de entrada: ${pessoas.length}\n`)

  // ── Fase 1: ministérios ──────────────────────────────────────────
  const nomesMinisterio = [...new Set(pessoas.map(p => p.ministerio).filter((m): m is string => !!m))].sort()
  const { data: ministeriosExistentes } = await db.from('ministries').select('id, name').eq('organization_id', org.id)
  const ministryByName = new Map((ministeriosExistentes ?? []).map(m => [norm(m.name), m.id as string]))

  let novosMinisterios = 0
  for (const nome of nomesMinisterio) {
    if (ministryByName.has(norm(nome))) continue
    novosMinisterios++
    if (CONFIRM) {
      const { data: created, error } = await db.from('ministries').insert({ organization_id: org.id, name: nome, active: true }).select('id').single()
      if (error || !created) throw new Error(`Falha ao criar ministério "${nome}": ${error?.message}`)
      ministryByName.set(norm(nome), created.id)
      console.log(`  + ministério criado: ${nome}`)
    } else {
      console.log(`  [dry-run] criaria ministério: ${nome}`)
    }
  }
  console.log(`Ministérios: ${nomesMinisterio.length} necessários, ${novosMinisterios} novos, ${nomesMinisterio.length - novosMinisterios} já existiam.\n`)

  if (!CONFIRM) {
    console.log('Dry run não avança pra criação de pessoas — rode com --confirm quando os números acima estiverem corretos.')
    return
  }

  // ── Fase 2: pessoas ───────────────────────────────────────────────
  const { data: { users } } = await db.auth.admin.listUsers({ perPage: 1000 })
  const authUsersByEmail = new Map(users.filter(u => u.email).map(u => [u.email!.toLowerCase(), u.id]))

  const log = loadLog()
  let criados = 0
  let comLogin = 0
  let semLogin = 0
  let erros = 0

  for (const p of pessoas) {
    const key = norm(p.nome)
    if (log[key]?.status === 'criado') {
      console.log(`  = já processado antes, pulando: ${p.nome}`)
      continue
    }

    const ministryId = p.ministerio ? ministryByName.get(norm(p.ministerio)) : undefined
    if (p.ministerio && !ministryId) {
      erros++
      console.error(`  ERRO: ministério "${p.ministerio}" não resolvido para ${p.nome} (não deveria acontecer após a fase 1).`)
      continue
    }

    const row = {
      nome: p.nome,
      email: p.email ?? '',
      telefone: p.telefone,
      cpf: p.documento?.type === 'cpf' ? p.documento.number : null,
      dataNascimento: p.dataNascimento,
      sexo: p.sexo,
      estadoCivil: null,
      papel: 'obreiro' as const,
      turmaId: null,
      destinoObreiro: ministryId ? { tipo: 'ministerio' as const, id: ministryId, label: `Ministério: ${p.ministerio}` } : null,
      cargo: p.cargo,
    }

    const result = await createImportedPerson({ organizationId: org.id, slug: ORG_SLUG, turmas: [], destinosObreiro: [] }, row, 0, org.name, authUsersByEmail, false)

    log[key] = { status: result.status, message: result.message }
    saveLog(log)

    if (result.status === 'erro') {
      erros++
      console.error(`  ERRO (${p.nome}): ${result.message}`)
    } else {
      criados++
      if (p.email) comLogin++
      else semLogin++
      console.log(`  ✓ ${p.nome} — ${result.message}`)
    }
  }

  // Pessoa com RG em vez de CPF — createPerson.ts só suporta 'cpf' hoje,
  // então cai fora do insert automático; completa na mão.
  if (log[norm(NOME_COM_RG)]?.status === 'ok') {
    const { data: pessoaRg } = await db.from('people').select('id').eq('organization_id', org.id).eq('full_name', NOME_COM_RG).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (pessoaRg) {
      const { data: docExistente } = await db.from('person_documents').select('id').eq('person_id', pessoaRg.id).eq('type', 'rg').maybeSingle()
      if (!docExistente) {
        await db.from('person_documents').insert({ person_id: pessoaRg.id, type: 'rg', number: '73702315268' })
        console.log(`  + documento RG adicionado manualmente para ${NOME_COM_RG}`)
      }
    }
  }

  console.log(`\n=== Resumo ===`)
  console.log(`Criados: ${criados} (com login: ${comLogin}, sem login: ${semLogin})`)
  console.log(`Erros: ${erros}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
