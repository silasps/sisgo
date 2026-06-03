import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'

export default async function AdminDashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  let orgId: string | null = null
  if (user) {
    const { data } = await supabase
      .from('organization_users')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('active', true)
      .single()
    orgId = data?.organization_id ?? null
  }

  const [
    { count: peopleCount },
    { count: staffCount },
    { count: studentCount },
    { count: schoolCount },
  ] = await Promise.all([
    supabase.from('people').select('*', { count: 'exact', head: true }).eq('organization_id', orgId ?? ''),
    supabase.from('staff_profiles').select('*', { count: 'exact', head: true }).eq('organization_id', orgId ?? ''),
    supabase.from('student_profiles').select('*', { count: 'exact', head: true }).eq('organization_id', orgId ?? ''),
    supabase.from('schools').select('*', { count: 'exact', head: true }).eq('organization_id', orgId ?? ''),
  ])

  return (
    <>
      <Header title="Dashboard" />
      <main className="p-4 md:p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <StatCard label="Pessoas" value={peopleCount ?? 0} />
          <StatCard label="Obreiros" value={staffCount ?? 0} />
          <StatCard label="Alunos" value={studentCount ?? 0} />
          <StatCard label="Escolas" value={schoolCount ?? 0} />
        </div>
      </main>
    </>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  )
}
