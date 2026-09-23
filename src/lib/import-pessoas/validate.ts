import { createAdminClient } from '@/lib/supabase/admin'
import type { ImportContext, ImportRawRow, ImportValidatedRow } from './types'

const SEXO_MAP: Record<string, 'M' | 'F' | 'outro'> = {
  m: 'M', masculino: 'M',
  f: 'F', feminino: 'F',
  outro: 'outro',
}

const ESTADO_CIVIL_MAP: Record<string, 'solteiro' | 'casado' | 'divorciado' | 'viuvo' | 'outro'> = {
  solteiro: 'solteiro',
  casado: 'casado',
  divorciado: 'divorciado',
  'viúvo': 'viuvo',
  viuvo: 'viuvo',
  outro: 'outro',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function parseDateBR(value: string): string | null {
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, d, mo, y] = m
  const day = Number(d)
  const month = Number(mo)
  if (day < 1 || day > 31 || month < 1 || month > 12) return null
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

export async function validateImportRows(rows: ImportRawRow[], ctx: ImportContext): Promise<ImportValidatedRow[]> {
  const db = createAdminClient()

  const emails = [...new Set(rows.map(r => r.email).filter(Boolean))]
  const { data: existingContacts } = emails.length
    ? await db.from('person_contacts')
      .select('value, people!inner(organization_id)')
      .eq('type', 'email')
      .in('value', emails)
      .eq('people.organization_id', ctx.organizationId)
    : { data: [] }
  const existingEmails = new Set((existingContacts ?? []).map(c => c.value.toLowerCase()))

  const seenInFile = new Set<string>()

  return rows.map((raw): ImportValidatedRow => {
    const errors: string[] = []
    const warnings: string[] = []

    if (!raw.nome) errors.push('Nome completo é obrigatório.')

    const papelNorm = raw.papel.trim().toLowerCase()
    const papel = papelNorm === 'aluno' ? 'aluno' : papelNorm === 'obreiro' ? 'obreiro' : null
    if (!papel) errors.push('Papel deve ser "Aluno" ou "Obreiro".')

    // Obreiro pode ser cadastrado sem email ainda (fica sem login até
    // alguém completar o dado depois) — aluno continua exigindo, porque o
    // fluxo de matrícula já pressupõe login imediato.
    if (!raw.email) {
      if (papel === 'aluno') errors.push('Email é obrigatório.')
    } else if (!EMAIL_RE.test(raw.email)) {
      errors.push(`Email "${raw.email}" não parece válido.`)
    } else if (existingEmails.has(raw.email)) {
      errors.push('Já existe uma pessoa com este email nesta organização.')
    } else if (seenInFile.has(raw.email)) {
      errors.push('Email duplicado nesta planilha.')
    }
    if (raw.email) seenInFile.add(raw.email)

    let turmaId: string | null = null
    let destinoObreiro: ImportContext['turmas'][number] | null = null

    if (papel === 'aluno') {
      if (!raw.turma) {
        errors.push('Turma é obrigatória para Aluno.')
      } else {
        const match = ctx.turmas.find(t => t.label.toLowerCase() === raw.turma.trim().toLowerCase())
        if (!match) errors.push(`Turma "${raw.turma}" não encontrada — escolha um valor da lista da coluna.`)
        else turmaId = match.id
      }
    } else if (papel === 'obreiro') {
      if (!raw.destinoObreiro) {
        errors.push('Ministério ou Escola é obrigatório para Obreiro.')
      } else {
        const match = ctx.destinosObreiro.find(d => d.label.toLowerCase() === raw.destinoObreiro.trim().toLowerCase())
        if (!match) errors.push(`"${raw.destinoObreiro}" não encontrado — escolha um valor da lista da coluna.`)
        else destinoObreiro = match
      }
    }

    let sexo: 'M' | 'F' | 'outro' | null = null
    if (raw.sexo) {
      sexo = SEXO_MAP[raw.sexo.trim().toLowerCase()] ?? null
      if (!sexo) warnings.push(`Sexo "${raw.sexo}" não reconhecido — ficará em branco.`)
    }

    let estadoCivil: 'solteiro' | 'casado' | 'divorciado' | 'viuvo' | 'outro' | null = null
    if (raw.estadoCivil) {
      estadoCivil = ESTADO_CIVIL_MAP[raw.estadoCivil.trim().toLowerCase()] ?? null
      if (!estadoCivil) warnings.push(`Estado civil "${raw.estadoCivil}" não reconhecido — ficará em branco.`)
    }

    let dataNascimento: string | null = null
    if (raw.dataNascimento) {
      dataNascimento = parseDateBR(raw.dataNascimento)
      if (!dataNascimento) warnings.push(`Data de nascimento "${raw.dataNascimento}" não reconhecida (use dd/mm/aaaa) — ficará em branco.`)
    }

    const status = errors.length ? 'erro' : 'ok'

    return {
      raw,
      status,
      errors,
      warnings,
      parsed: status === 'ok' && papel ? {
        nome: raw.nome,
        email: raw.email,
        telefone: raw.telefone || null,
        cpf: raw.cpf ? onlyDigits(raw.cpf) : null,
        dataNascimento,
        sexo,
        estadoCivil,
        papel,
        turmaId,
        destinoObreiro,
        cargo: raw.cargo || null,
      } : undefined,
    }
  })
}
