'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { headers as nextHeaders } from 'next/headers'

// Sem 0/O/1/l/I — evita confusão em quem digita o código a mão a partir de
// um print ou cartaz, mesmo sendo pensado pra ser clicado.
const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz'

function randomCode(length = 7): string {
  let out = ''
  for (let i = 0; i < length; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return out
}

// Cria (ou reaproveita) um link curto /l/<code> pra um caminho público do
// próprio sistema — pra divulgar em WhatsApp/Instagram/site sem o caminho
// completo com slug da base. `targetPath` é relativo (ex: "/jocum/escola/eted").
export async function getOrCreateShortLink(params: {
  organizationId: string
  targetPath: string
  createdBy: string | null
}): Promise<string> {
  const db = createAdminClient()

  const { data: existing } = await db.from('short_links')
    .select('code').eq('organization_id', params.organizationId).eq('target_url', params.targetPath).maybeSingle()

  let code = existing?.code ?? null
  if (!code) {
    for (let attempt = 0; attempt < 5 && !code; attempt++) {
      const candidate = randomCode()
      const { error } = await db.from('short_links').insert({
        organization_id: params.organizationId,
        code: candidate,
        target_url: params.targetPath,
        created_by: params.createdBy,
      })
      if (!error) code = candidate
    }
    if (!code) throw new Error('Não foi possível gerar o link curto.')
  }

  const headersList = await nextHeaders()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  return `${protocol}://${host}/l/${code}`
}
