import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const db = createAdminClient()
  const { data } = await db.from('short_links').select('target_url').eq('code', code).maybeSingle()
  if (!data) return NextResponse.redirect(new URL('/', request.url))
  return NextResponse.redirect(new URL(data.target_url, request.url))
}
