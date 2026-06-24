import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getRolePreview } from '@/lib/role-preview'
import { asLooseClient } from '@/lib/supabase/loose-client'
import { userHasAnyRole, GENERAL_FINANCE_ROLES } from '@/lib/auth/permissions'
import { updateMealPaymentSettings } from '../../cozinha/actions'
import { MealPaymentSettingsForm } from '../MealPaymentSettingsForm'

type Props = { params: Promise<{ slug: string }> }

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

export default async function PaymentSettingsPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const sbAdmin = createAdminClient()
  const looseAdmin = asLooseClient(sbAdmin)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase
    .from('organizations')
    .select('id, role_accumulations')
    .eq('slug', slug)
    .single()
  const orgId = org?.id ?? ''
  if (!orgId) notFound()

  const { data: orgUsers } = await supabase
    .from('organization_users')
    .select('organization_id, roles(name), extra_roles')
    .eq('user_id', user.id)
    .eq('active', true)
  const userOrgRows = (orgUsers ?? []) as unknown as Array<{
    organization_id: string | null
    roles: { name: string } | null
    extra_roles?: string[] | null
  }>
  const superadminRow = userOrgRows.find(row => row.roles?.name === 'superadmin')
  const supervisorRow = userOrgRows.find(row => row.roles?.name === 'supervisor_bases')
  const currentOrgRow = userOrgRows.find(row => row.organization_id === orgId)
  const realRole = superadminRow?.roles?.name ?? currentOrgRow?.roles?.name ?? supervisorRow?.roles?.name ?? ''
  const { data: supervisedIdsData } = supervisorRow
    ? await looseAdmin.rpc('supervised_base_ids', { target_user_id: user.id })
    : { data: [] }
  const supervisedIds = new Set(((supervisedIdsData ?? []) as Array<{ organization_id: string }>).map(row => row.organization_id))
  const canSuperviseCurrentOrg = supervisedIds.has(orgId)
  const preview = await getRolePreview(realRole)
  const role = realRole === 'supervisor_bases' && canSuperviseCurrentOrg
    ? 'lider_base'
    : preview?.role ?? realRole
  const orgAccumulations = (org?.role_accumulations as Record<string, string[]> | null) ?? {}
  const extraRoles = (currentOrgRow?.extra_roles as string[] | null) ?? []
  const allRoles = [role, ...(orgAccumulations[role] ?? []), ...extraRoles]
  if (realRole !== 'superadmin' && !currentOrgRow && !canSuperviseCurrentOrg) redirect('/login')
  if (!userHasAnyRole(allRoles, GENERAL_FINANCE_ROLES)) notFound()

  const requestHeaders = await headers()
  const host = requestHeaders.get('host') ?? 'localhost:3000'
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'http'
  const currentBaseUrl = `${protocol}://${host}`

  const { data: mealSettings } = await sbAdmin
    .from('kitchen_meal_settings')
    .select('payment_mode, payment_methods, payment_instructions, payment_provider, payment_provider_settings')
    .eq('organization_id', orgId)
    .maybeSingle()

  const rawMethods = Array.isArray(mealSettings?.payment_methods)
    ? mealSettings.payment_methods
    : [mealSettings?.payment_mode ?? 'manual']
  const paymentMethods = rawMethods.filter((method): method is string => typeof method === 'string')
  const paymentProvider = asString(mealSettings?.payment_provider)
  const providerSettings = asRecord(mealSettings?.payment_provider_settings)
  const gatewayConfigured = Boolean(['asaas', 'mercado_pago', 'pagseguro'].includes(paymentProvider) && providerSettings.gateway_configured === true)
  const gatewayRequested = paymentMethods.includes('gateway') || providerSettings.gateway_requested === true
  const gatewayPublicBaseUrl = asString(providerSettings.public_base_url, currentBaseUrl)
  const gatewayWebhookUrl = `${(gatewayPublicBaseUrl || currentBaseUrl).replace(/\/+$/, '')}/api/payments/kitchen-meals/webhook`

  const handleUpdateMealPaymentSettings = async (formData: FormData) => {
    'use server'
    await updateMealPaymentSettings({
      organizationId: orgId,
      paymentMethods: formData.getAll('payment_methods').map(String),
      paymentInstructions: String(formData.get('payment_instructions') ?? '').trim() || null,
      paymentProvider: String(formData.get('payment_provider') ?? '').trim() || null,
      gatewaySettings: {
        cnpj: String(formData.get('gateway_cnpj') ?? '').trim() || null,
        legalName: String(formData.get('gateway_legal_name') ?? '').trim() || null,
        pixKeyType: String(formData.get('gateway_pix_key_type') ?? '').trim() || null,
        pixKey: String(formData.get('gateway_pix_key') ?? '').trim() || null,
        environment: String(formData.get('gateway_environment') ?? '').trim() || null,
        providerAccountId: String(formData.get('gateway_provider_account_id') ?? '').trim() || null,
        defaultCustomerId: String(formData.get('gateway_default_customer_id') ?? '').trim() || null,
        publicBaseUrl: String(formData.get('gateway_public_base_url') ?? '').trim() || null,
        accessToken: String(formData.get('gateway_access_token') ?? '').trim() || null,
        webhookToken: String(formData.get('gateway_webhook_token') ?? '').trim() || null,
      },
      updatedBy: user.id,
    })
    redirect(`/${slug}/financeiro/configuracoes-pagamento`)
  }

  return (
    <>
      <Header title="Configurações de pagamento" />
      <main className="p-4 md:p-6 space-y-5">
        <Link href={`/${slug}/financeiro`} className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900">
          <ArrowLeft size={16} aria-hidden />
          Voltar ao financeiro
        </Link>

        <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-800">Pagamento das refeições</h2>
            <p className="text-xs text-gray-400">A secretaria define quais métodos a base aceita para liberar pedidos e automatizar o Pix.</p>
          </div>
          <MealPaymentSettingsForm
            action={handleUpdateMealPaymentSettings}
            paymentMethods={paymentMethods}
            paymentInstructions={asString(mealSettings?.payment_instructions)}
            paymentProvider={paymentProvider}
            gatewayConfigured={gatewayConfigured}
            gatewayRequested={gatewayRequested}
            gatewayWebhookToken={asString(providerSettings.webhook_token)}
            gatewayWebhookUrl={gatewayWebhookUrl}
            currentBaseUrl={currentBaseUrl}
            gatewayPublicBaseUrl={gatewayPublicBaseUrl}
            gatewayCnpj={asString(providerSettings.cnpj)}
            gatewayLegalName={asString(providerSettings.legal_name)}
            gatewayPixKeyType={asString(providerSettings.pix_key_type, 'cnpj')}
            gatewayPixKey={asString(providerSettings.pix_key)}
            gatewayEnvironment={asString(providerSettings.environment, 'sandbox')}
            gatewayProviderAccountId={asString(providerSettings.provider_account_id)}
            gatewayDefaultCustomerId={asString(providerSettings.default_customer_id)}
            accessTokenConfigured={providerSettings.access_token_configured === true || typeof providerSettings.access_token === 'string'}
          />
        </section>
      </main>
    </>
  )
}
