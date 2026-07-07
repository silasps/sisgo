import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { notFound, redirect } from 'next/navigation'
import { IdCard } from '@/components/carteirinha/IdCard'
import { formatCardRole, getRequestOrigin, buildCardVerifyPath } from '@/lib/carteirinha'

type Props = { params: Promise<{ slug: string }> }

export default async function MinhaCarteirinhaPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const sbAdmin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, logo_url, accent_color, id_card_enabled')
    .eq('slug', slug)
    .single()
  if (!org) notFound()

  const [{ data: staffProfile }, { data: studentProfile }, { data: associadoProfile }] = await Promise.all([
    sbAdmin.from('staff_profiles').select('person_id, active, role_title').eq('user_id', user.id).eq('organization_id', org.id).maybeSingle(),
    sbAdmin.from('student_profiles').select('person_id, active').eq('user_id', user.id).eq('organization_id', org.id).maybeSingle(),
    sbAdmin.from('associado_profiles').select('person_id').eq('user_id', user.id).eq('organization_id', org.id).maybeSingle(),
  ])

  const personId = staffProfile?.person_id ?? studentProfile?.person_id ?? associadoProfile?.person_id

  if (!personId) {
    return (
      <>
        <Header title="Minha Carteirinha" />
        <main className="p-4 md:p-6">
          <div className="max-w-lg rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <p className="text-gray-500 font-medium">Perfil não encontrado</p>
            <p className="text-sm text-gray-400 mt-1">Seu usuário ainda não está vinculado a um perfil de obreiro ou aluno nesta base.</p>
          </div>
        </main>
      </>
    )
  }

  if (!org.id_card_enabled) {
    return (
      <>
        <Header title="Minha Carteirinha" />
        <main className="p-4 md:p-6">
          <div className="max-w-lg rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <p className="text-gray-500 text-sm">Carteirinha desativada nesta base.</p>
          </div>
        </main>
      </>
    )
  }

  const [{ data: person }, { data: token }] = await Promise.all([
    sbAdmin.from('people').select('full_name, photo_url').eq('id', personId).single(),
    sbAdmin.from('person_public_tokens').select('token').eq('person_id', personId).is('revoked_at', null).maybeSingle(),
  ])
  if (!person) notFound()

  const role = formatCardRole(!!studentProfile?.active, !!staffProfile?.active, staffProfile?.role_title ?? null)
  const active = !!studentProfile?.active || !!staffProfile?.active

  return (
    <>
      <Header title="Minha Carteirinha" />
      <main className="p-4 md:p-6 max-w-sm">
        {token?.token ? (
          <IdCardWithQr
            personName={person.full_name}
            photoUrl={person.photo_url}
            orgName={org.name}
            orgLogoUrl={org.logo_url}
            role={role}
            active={active}
            slug={slug}
            token={token.token}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <p className="text-gray-500 text-sm font-medium">Sua carteirinha ainda não foi gerada</p>
            <p className="text-gray-400 text-xs mt-1">Peça a um gestor da base para gerá-la no seu perfil.</p>
          </div>
        )}
      </main>
    </>
  )
}

async function IdCardWithQr({
  personName, photoUrl, orgName, orgLogoUrl, role, active, slug, token,
}: {
  personName: string; photoUrl: string | null; orgName: string; orgLogoUrl: string | null
  role: string; active: boolean; slug: string; token: string
}) {
  const origin = await getRequestOrigin()
  const verifyUrl = `${origin}${buildCardVerifyPath(slug, token)}`
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 240 })

  return (
    <IdCard
      personName={personName}
      photoUrl={photoUrl}
      orgName={orgName}
      orgLogoUrl={orgLogoUrl}
      role={role}
      active={active}
      qrDataUrl={qrDataUrl}
    />
  )
}
