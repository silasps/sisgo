import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'

type Props = { params: Promise<{ slug: string }> }

export default async function BaseDashboard({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('slug', slug)
    .single()

  const orgId = org?.id ?? ''

  const [
    { count: peopleCount },
    { count: staffCount },
    { count: studentCount },
    { count: schoolCount },
    { count: ministryCount },
  ] = await Promise.all([
    supabase.from('people').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
    supabase.from('staff_profiles').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('active', true),
    supabase.from('student_profiles').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('active', true),
    supabase.from('schools').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('active', true),
    supabase.from('ministries').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('active', true),
  ])

  return (
    <>
      <Header title="Dashboard" />
      <main className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Pessoas" value={peopleCount ?? 0} icon="👥" />
          <StatCard label="Obreiros" value={staffCount ?? 0} icon="⛪" />
          <StatCard label="Alunos" value={studentCount ?? 0} icon="🎓" />
          <StatCard label="Escolas" value={schoolCount ?? 0} icon="📚" />
          <StatCard label="Ministérios" value={ministryCount ?? 0} icon="🎵" />
        </div>
      </main>
    </>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <span className="text-xl">{icon}</span>
      <div>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  )
}
