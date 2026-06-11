import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { notFound } from 'next/navigation'
import Link from 'next/link'

type Props = { params: Promise<{ id: string }> }

export default async function BaseDetailPage({ params }: Props) {
  const { id } = await params
  const orgId = id
  const supabase = await createClient()

  const { data: base } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', id)
    .single()

  if (!base) notFound()

  const [
    { count: staffCount },
    { count: studentCount },
    { count: ministryCount },
    { count: schoolCount },
    { count: userCount },
  ] = await Promise.all([
    supabase.from('staff_profiles').select('*', { count: 'exact', head: true }).eq('organization_id', id).eq('active', true),
    supabase.from('student_profiles').select('*', { count: 'exact', head: true }).eq('organization_id', id).eq('active', true),
    supabase.from('ministries').select('*', { count: 'exact', head: true }).eq('organization_id', id).eq('active', true),
    supabase.from('schools').select('*', { count: 'exact', head: true }).eq('organization_id', id).eq('active', true),
    supabase.from('organization_users').select('*', { count: 'exact', head: true }).eq('organization_id', id).eq('active', true),
  ])

  return (
    <>
      <Header
        title={base.name}
        actions={
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href={`/superadmin/bases/${orgId}/usuarios`}
              className="px-3 sm:px-4 py-2 bg-brand-500 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors whitespace-nowrap"
            >
              <span className="hidden sm:inline">Gerenciar </span>usuários
            </Link>
            <Link
              href="/superadmin/bases"
              className="text-sm text-gray-500 hover:text-gray-700 whitespace-nowrap"
            >
              ← Voltar
            </Link>
          </div>
        }
      />
      <main className="p-4 md:p-6 space-y-6 max-w-4xl">

        {/* Status banner */}
        <div className={`rounded-xl px-5 py-3 flex items-center gap-3 ${
          base.active ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
        }`}>
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${base.active ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span className={`text-sm font-medium ${base.active ? 'text-green-700' : 'text-gray-600'}`}>
            {base.active ? 'Base ativa' : 'Base inativa'}
          </span>
          <span className="text-sm text-gray-400 ml-auto">
            Criada em {new Date(base.created_at).toLocaleDateString('pt-BR')}
          </span>
        </div>

        {/* Dados */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Informações</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <Info label="Slug" value={base.slug} />
            <Info label="País" value={base.country} />
            <Info label="Cidade" value={base.city} />
            <Info label="Estado" value={base.state} />
            <Info label="E-mail" value={base.email} />
            <Info label="Telefone" value={base.phone} />
            <Info label="Website" value={base.website} />
          </dl>
        </div>

        {/* Estatísticas */}
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Resumo</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Link href={`/superadmin/bases/${orgId}/usuarios`} className="block">
              <MiniStat label="Usuários" value={userCount ?? 0} icon="👤" clickable />
            </Link>
            <MiniStat label="Obreiros" value={staffCount ?? 0} icon="⛪" />
            <MiniStat label="Alunos" value={studentCount ?? 0} icon="🎓" />
            <MiniStat label="Escolas" value={schoolCount ?? 0} icon="📚" />
            <MiniStat label="Ministérios" value={ministryCount ?? 0} icon="🎵" />
          </div>
        </div>
      </main>
    </>
  )
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">{label}</dt>
      <dd className="font-medium text-gray-900">{value ?? '—'}</dd>
    </div>
  )
}

function MiniStat({ label, value, icon, clickable }: { label: string; value: number; icon: string; clickable?: boolean }) {
  return (
    <div className={`bg-white rounded-xl border p-4 text-center transition-colors ${
      clickable ? 'border-brand-200 hover:bg-brand-50 cursor-pointer' : 'border-gray-200'
    }`}>
      <p className="text-lg mb-1">{icon}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}
