import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import { IdCard } from '@/components/carteirinha/IdCard'
import { formatCardRole, getRequestOrigin, buildCardVerifyPath } from '@/lib/carteirinha'
import { PrintControls } from './PrintControls'

type Props = { params: Promise<{ slug: string; personId: string }> }

export default async function CarteirinhaImprimirPage({ params }: Props) {
  const { slug, personId } = await params
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, logo_url, accent_color, id_card_enabled')
    .eq('slug', slug)
    .single()
  if (!org || !org.id_card_enabled) notFound()

  const db = createAdminClient()

  const [{ data: person }, { data: studentProfile }, { data: staffProfile }, { data: token }] = await Promise.all([
    db.from('people').select('id, full_name, photo_url').eq('id', personId).eq('organization_id', org.id).single(),
    db.from('student_profiles').select('active').eq('person_id', personId).eq('organization_id', org.id).eq('active', true).maybeSingle(),
    db.from('staff_profiles').select('active, role_title').eq('person_id', personId).eq('organization_id', org.id).eq('active', true).order('joined_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('person_public_tokens').select('token').eq('person_id', personId).is('revoked_at', null).maybeSingle(),
  ])
  if (!person) notFound()
  if (!token?.token) redirect(`/${slug}/pessoas/${personId}/carteirinha`)

  const isStudent = !!studentProfile?.active
  const isStaff = !!staffProfile?.active
  const role = formatCardRole(isStudent, isStaff, staffProfile?.role_title ?? null)
  const active = isStudent || isStaff

  const origin = await getRequestOrigin()
  const verifyUrl = `${origin}${buildCardVerifyPath(slug, token.token)}`
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 240 })

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 print:p-0 print:bg-white">
      <style dangerouslySetInnerHTML={{ __html: '@media print { @page { size: 85.6mm 54mm; margin: 0; } body { margin: 0; } }' }} />

      <PrintControls backHref={`/${slug}/pessoas/${personId}/carteirinha`} />

      <div className="mx-auto print:mx-0" style={{ width: '85.6mm' }}>
        <IdCard
          personName={person.full_name}
          photoUrl={person.photo_url}
          orgName={org.name}
          orgLogoUrl={org.logo_url}
          role={role}
          active={active}
          qrDataUrl={qrDataUrl}
          className="w-full print:rounded-none print:shadow-none"
        />
      </div>
    </div>
  )
}
