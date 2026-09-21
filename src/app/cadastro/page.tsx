import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SisgoSymbol } from '@/components/marketing/SisgoWordmark'
import { CadastroWizard } from './CadastroWizard'

type Props = { searchParams: Promise<{ plan?: string }> }

export default async function CadastroPage({ searchParams }: Props) {
  const { plan: preselectPlanSlug } = await searchParams
  const supabase = await createClient()

  const [{ data: { user } }, { data: plans }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('plans')
      .select('id, slug, name, price_cents, max_people')
      .eq('is_active', true)
      .order('sort_order'),
  ])

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-900">
            <SisgoSymbol size={24} />
            <span className="font-semibold tracking-wide text-sm">SISGO</span>
          </Link>
          <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            Já tenho conta
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Crie a conta da sua organização</h1>
        <p className="text-sm text-gray-500 mb-8">
          Sua organização fica ativa imediatamente, com trial de 30 dias — sem cartão de crédito.
        </p>
      </div>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 md:p-8">
          <CadastroWizard
            plans={plans ?? []}
            hasSession={!!user}
            sessionEmail={user?.email}
            preselectPlanSlug={preselectPlanSlug}
          />
        </div>
      </main>
    </div>
  )
}
