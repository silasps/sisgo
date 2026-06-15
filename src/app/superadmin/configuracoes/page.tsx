import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { BrandingForm } from './BrandingForm'

export default async function SuperAdminConfiguracoesPage() {
  const db = createAdminClient()
  const { data: settings } = await db
    .from('system_settings')
    .select('key, value')
    .in('key', ['superadmin_logo_url', 'superadmin_accent_color'])

  const map = Object.fromEntries((settings ?? []).map(r => [r.key, r.value]))

  return (
    <>
      <Header title="Configurações" />
      <main className="p-4 md:p-6">
        <BrandingForm
          currentLogoUrl={map['superadmin_logo_url'] ?? null}
          currentAccentColor={map['superadmin_accent_color'] ?? 'laranja'}
        />
      </main>
    </>
  )
}
