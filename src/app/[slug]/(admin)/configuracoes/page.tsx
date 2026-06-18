import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { notFound, redirect } from 'next/navigation'
import { BrandingForm } from './BrandingForm'
import { updateAreaCashScopes, updateRoleAccumulations } from './actions'
import { asLooseClient } from '@/lib/supabase/loose-client'
import { schoolTypeShortLabel } from '@/lib/schools'

type Props = { params: Promise<{ slug: string }> }

const BRANDING_ROLES = ['superadmin', 'lider_base']
const CASH_SCOPE_ROLES = ['superadmin', 'lider_base']
const ACCUMULATION_ROLES = ['superadmin', 'lider_base']

const ACCUMULATION_OPTIONS = [
  { role: 'dh',           label: 'DH',           canAccumulate: ['secretaria', 'hospitalidade', 'cozinha'] },
  { role: 'secretaria',   label: 'Secretaria',    canAccumulate: ['hospitalidade', 'cozinha'] },
  { role: 'lider_eted',   label: 'Líder ETED',    canAccumulate: ['secretaria', 'hospitalidade', 'cozinha'] },
  { role: 'hospitalidade', label: 'Hospitalidade', canAccumulate: ['cozinha'] },
] as const

const EXTRA_ROLE_LABELS: Record<string, string> = {
  secretaria: 'Secretaria',
  hospitalidade: 'Hospitalidade',
  cozinha: 'Cozinha',
}

export default async function ConfiguracoesPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, slug, email, city, state, logo_url, accent_color, role_accumulations')
    .eq('slug', slug)
    .single()

  if (!org) notFound()

  const { data: orgUser } = await supabase
    .from('organization_users')
    .select('roles(name, label)')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  const roles     = orgUser?.roles as unknown as { name: string; label: string } | null
  const roleName  = roles?.name  ?? ''
  const roleLabel = roles?.label ?? ''

  const canBrand = BRANDING_ROLES.includes(roleName)
  const canConfigureCashScopes = CASH_SCOPE_ROLES.includes(roleName)
  const canConfigureAccumulations = ACCUMULATION_ROLES.includes(roleName)
  const currentAccumulations = (org?.role_accumulations as Record<string, string[]> | null) ?? {}

  const [{ data: schools }, { data: ministries }, { data: cashScopes }] = canConfigureCashScopes
    ? await Promise.all([
      supabase.from('schools').select('id, name, acronym, school_type, active').eq('organization_id', org.id).eq('active', true).order('name'),
      supabase.from('ministries').select('id, name, active').eq('organization_id', org.id).eq('active', true).order('name'),
      asLooseClient(supabase).from('finance_cash_scopes').select('id, entity_type, school_id, ministry_id, enabled').eq('organization_id', org.id),
    ])
    : [{ data: [] }, { data: [] }, { data: [] }]

  const enabledScopes = new Set(((cashScopes ?? []) as Array<{
    entity_type: string
    school_id: string | null
    ministry_id: string | null
    enabled: boolean
  }>)
    .filter(scope => scope.enabled)
    .map(scope => scope.entity_type === 'school' ? `school:${scope.school_id}` : `ministry:${scope.ministry_id}`))

  return (
    <>
      <Header title="Configurações" mobileHeight="dashboard" />
      <main className="p-4 md:p-6 space-y-8 max-w-4xl">

        <Section title="Minha conta">
          <Row label="E-mail" value={user.email} />
          <Row label="Papel"  value={roleLabel} />
        </Section>

        <Section title="Base">
          <Row label="Nome"        value={org.name} />
          <Row label="Slug"        value={org.slug} />
          <Row label="E-mail"      value={org.email} />
          <Row label="Localização" value={[org.city, org.state].filter(Boolean).join(', ')} />
        </Section>

        {canBrand ? (
          <BrandingForm
            orgId={org.id}
            orgSlug={slug}
            orgName={org.name}
            currentLogoUrl={(org as { logo_url?: string | null }).logo_url ?? null}
            currentAccentColor={(org as { accent_color?: string }).accent_color ?? 'laranja'}
          />
        ) : (
          <div className="rounded-xl border border-dark-800 bg-dark-900 p-6 opacity-60">
            <p className="text-sm font-semibold text-white uppercase tracking-widest mb-1">Identidade Visual</p>
            <p className="text-xs text-gray-500">Apenas o líder da base pode personalizar a logo e a cor de destaque.</p>
          </div>
        )}

        {canConfigureCashScopes && (
          <Section title="Caixas próprios por área">
            <form action={updateAreaCashScopes.bind(null, org.id, slug)} className="space-y-5">
              <p className="text-sm text-gray-500">
                Ative caixa próprio para uma escola ou ministério quando aquela área deve controlar entradas e saídas separadas do caixa geral da base.
                Para escolas, a configuração é feita por escola cadastrada, não por turma.
              </p>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Escolas</h3>
                  <div className="space-y-2">
                    {(schools ?? []).length === 0 ? (
                      <p className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-400">Nenhuma escola cadastrada.</p>
                    ) : (schools ?? []).map(school => (
                      <CashScopeOption
                        key={school.id}
                        name="cash_scopes"
                        value={`school:${school.id}`}
                        checked={enabledScopes.has(`school:${school.id}`)}
                        title={school.name}
                        subtitle={`${school.acronym ? `${school.acronym} · ` : ''}${schoolTypeShortLabel(school.school_type)}`}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Ministérios</h3>
                  <div className="space-y-2">
                    {(ministries ?? []).length === 0 ? (
                      <p className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-400">Nenhum ministério cadastrado.</p>
                    ) : (ministries ?? []).map(ministry => (
                      <CashScopeOption
                        key={ministry.id}
                        name="cash_scopes"
                        value={`ministry:${ministry.id}`}
                        checked={enabledScopes.has(`ministry:${ministry.id}`)}
                        title={ministry.name}
                        subtitle="Caixa ministerial separado"
                      />
                    ))}
                  </div>
                </div>
              </div>

              <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
                Salvar caixas próprios
              </button>
            </form>
          </Section>
        )}

        {canConfigureAccumulations && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-1">Acúmulo de funções</h2>
            <p className="text-sm text-gray-500 mb-5">
              Configure quais funções adicionais uma pessoa cobre nesta base. O acúmulo vale para todos com aquela função.
            </p>
            <form action={updateRoleAccumulations.bind(null, org.id, slug)} className="space-y-5">
              {ACCUMULATION_OPTIONS.map(option => (
                <div key={option.role} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-800 mb-3">
                    <span className="text-brand-600">{option.label}</span> acumula também:
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {option.canAccumulate.map(extra => (
                      <label key={extra} className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40">
                        <input
                          type="checkbox"
                          name={`acc_${option.role}_${extra}`}
                          defaultChecked={(currentAccumulations[option.role] ?? []).includes(extra)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400"
                        />
                        <span className="text-sm text-gray-700">{EXTRA_ROLE_LABELS[extra]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
                Salvar acúmulo de funções
              </button>
            </form>
          </div>
        )}

      </main>
    </>
  )
}

function CashScopeOption({
  name,
  value,
  checked,
  title,
  subtitle,
}: {
  name: string
  value: string
  checked: boolean
  title: string
  subtitle: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:border-brand-200 hover:bg-brand-50/40">
      <input name={name} value={value} type="checkbox" defaultChecked={checked} className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-900">{title}</span>
        <span className="block text-xs text-gray-400">{subtitle}</span>
      </span>
    </label>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900 mb-4">{title}</h2>
      <dl className="space-y-3">{children}</dl>
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-gray-500 shrink-0">{label}</dt>
      <dd className="font-medium text-gray-900 text-right break-all min-w-0">{value || '—'}</dd>
    </div>
  )
}
