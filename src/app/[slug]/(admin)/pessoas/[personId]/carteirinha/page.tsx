import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { IdCard } from '@/components/carteirinha/IdCard'
import { CardActions } from './CardActions'
import { formatCardRole, getRequestOrigin, buildCardVerifyPath } from '@/lib/carteirinha'

type Props = { params: Promise<{ slug: string; personId: string }> }

export default async function CarteirinhaAdminPage({ params }: Props) {
  const { slug, personId } = await params
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, logo_url, accent_color, id_card_enabled')
    .eq('slug', slug)
    .single()
  if (!org) notFound()

  const db = createAdminClient()

  const [{ data: person }, { data: studentProfile }, { data: staffProfile }, { data: token }] = await Promise.all([
    db.from('people').select('id, full_name, photo_url').eq('id', personId).eq('organization_id', org.id).single(),
    db.from('student_profiles').select('active').eq('person_id', personId).eq('organization_id', org.id).eq('active', true).maybeSingle(),
    db.from('staff_profiles').select('active, role_title').eq('person_id', personId).eq('organization_id', org.id).eq('active', true).order('joined_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('person_public_tokens').select('token').eq('person_id', personId).is('revoked_at', null).maybeSingle(),
  ])
  if (!person) notFound()

  if (!org.id_card_enabled) {
    return (
      <main className="p-4 md:p-6 max-w-lg">
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <p className="text-gray-500 font-medium text-sm">Carteirinha desativada para esta base</p>
          <p className="text-gray-400 text-xs mt-1">Um líder de base pode ativar em Configurações.</p>
        </div>
      </main>
    )
  }

  const isStudent = !!studentProfile?.active
  const isStaff = !!staffProfile?.active
  const role = formatCardRole(isStudent, isStaff, staffProfile?.role_title ?? null)
  const active = isStudent || isStaff

  let qrDataUrl: string | null = null
  if (token?.token) {
    const origin = await getRequestOrigin()
    const verifyUrl = `${origin}${buildCardVerifyPath(slug, token.token)}`
    qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 240 })
  }

  return (
    <main className="p-4 md:p-6 space-y-6 max-w-lg">
      {qrDataUrl ? (
        <>
          <IdCard
            personName={person.full_name}
            photoUrl={person.photo_url}
            orgName={org.name}
            orgLogoUrl={org.logo_url}
            role={role}
            active={active}
            qrDataUrl={qrDataUrl}
          />
          <Link
            href={`/${slug}/pessoas/${personId}/carteirinha/imprimir`}
            className="inline-block text-sm text-brand-500 hover:text-brand-700 font-medium hover:underline"
          >
            Imprimir / gerar PDF →
          </Link>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
          <p className="text-gray-500 text-sm font-medium">Nenhuma carteirinha gerada ainda</p>
          <p className="text-gray-400 text-xs mt-1">Gere abaixo para criar o QR de verificação pública.</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Gerenciar carteirinha</h2>
        <CardActions orgId={org.id} personId={personId} slug={slug} hasToken={!!token?.token} photoUrl={person.photo_url} />
      </div>
    </main>
  )
}
