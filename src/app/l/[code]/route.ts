import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const db = createAdminClient()
  const { data } = await db.from('short_links').select('target_url').eq('code', code).maybeSingle()
  if (!data) return NextResponse.redirect(new URL('/', request.url))

  // Repassa query params extras do link curto (ex: ?lang=pt anexado depois
  // de gerar o link) pro destino — sem isso, idioma/parâmetros clicados
  // junto com o link curto se perdiam no redirecionamento.
  const target = new URL(data.target_url, request.url)
  new URL(request.url).searchParams.forEach((value, key) => {
    if (!target.searchParams.has(key)) target.searchParams.set(key, value)
  })
  return NextResponse.redirect(target)
}
