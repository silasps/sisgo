import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { User, Briefcase, GraduationCap, BookOpen, Music } from 'lucide-react'

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

  async function toggleActive() {
    'use server'
    const admin = createAdminClient()
    await admin.from('organizations').update({ active: !base.active, updated_at: new Date().toISOString() }).eq('id', orgId)
    redirect(`/superadmin/bases/${orgId}`)
  }

  async function updateBase(formData: FormData) {
    'use server'
    const admin = createAdminClient()
    await admin.from('organizations').update({
      name:    String(formData.get('name') ?? '').trim() || base.name,
      city:    String(formData.get('city') ?? '').trim() || null,
      state:   String(formData.get('state') ?? '').trim() || null,
      country: String(formData.get('country') ?? '').trim() || 'BR',
      email:   String(formData.get('email') ?? '').trim() || null,
      phone:   String(formData.get('phone') ?? '').trim() || null,
      website: String(formData.get('website') ?? '').trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', orgId)
    redirect(`/superadmin/bases/${orgId}`)
  }

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
              className="text-sm text-gray-300 hover:text-white whitespace-nowrap"
            >
              ← Voltar
            </Link>
          </div>
        }
      />
      <main className="p-4 md:p-6 space-y-6 max-w-4xl">

        {/* Status banner + toggle */}
        <div className={`rounded-xl px-5 py-3 flex items-center gap-3 ${
          base.active ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
        }`}>
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${base.active ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span className={`text-sm font-medium ${base.active ? 'text-green-700' : 'text-gray-600'}`}>
            {base.active ? 'Base ativa' : 'Base inativa'}
          </span>
          <span className="text-sm text-gray-400 ml-auto hidden sm:block">
            Criada em {new Date(base.created_at).toLocaleDateString('pt-BR')}
          </span>
          <form action={toggleActive}>
            <button
              type="submit"
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap ${
                base.active
                  ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                  : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
              }`}
            >
              {base.active ? 'Desativar base' : 'Ativar base'}
            </button>
          </form>
        </div>

        {/* Editar informações */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-5">Informações</h2>
          <form action={updateBase} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <EditField label="Nome" name="name" defaultValue={base.name} required />
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Slug</label>
                <input
                  readOnly
                  value={base.slug}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 bg-gray-50 font-mono cursor-not-allowed"
                />
                <p className="text-[11px] text-gray-400 mt-1">O slug não pode ser alterado — ele faz parte da URL da base.</p>
              </div>
              <EditField label="Cidade" name="city" defaultValue={base.city ?? ''} />
              <EditField label="Estado" name="state" defaultValue={base.state ?? ''} />
              <EditField label="País" name="country" defaultValue={base.country ?? 'BR'} />
              <EditField label="E-mail" name="email" type="email" defaultValue={base.email ?? ''} />
              <EditField label="Telefone" name="phone" defaultValue={base.phone ?? ''} />
              <EditField label="Website" name="website" type="url" defaultValue={base.website ?? ''} />
            </div>
            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                className="px-5 py-2 bg-brand-500 text-white text-sm font-semibold rounded-lg hover:bg-brand-600 transition-colors"
              >
                Salvar alterações
              </button>
              <Link
                href={`/${base.slug}/dashboard`}
                className="text-sm text-brand-500 hover:text-brand-600 font-medium"
                target="_blank"
              >
                Acessar base →
              </Link>
            </div>
          </form>
        </div>

        {/* Estatísticas */}
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Resumo</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 animate-stagger">
            <Link href={`/superadmin/bases/${orgId}/usuarios`} className="block">
              <MiniStat label="Usuários" value={userCount ?? 0} icon={User} clickable />
            </Link>
            <MiniStat label="Obreiros" value={staffCount ?? 0} icon={Briefcase} />
            <MiniStat label="Alunos" value={studentCount ?? 0} icon={GraduationCap} />
            <MiniStat label="Escolas" value={schoolCount ?? 0} icon={BookOpen} />
            <MiniStat label="Ministérios" value={ministryCount ?? 0} icon={Music} />
          </div>
        </div>
      </main>
    </>
  )
}

function EditField({ label, name, defaultValue, type = 'text', required }: {
  label: string
  name: string
  defaultValue: string
  type?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
      />
    </div>
  )
}

function MiniStat({ label, value, icon: Icon, clickable }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; clickable?: boolean }) {
  return (
    <div className={`bg-white rounded-xl border p-4 text-center transition-colors ${
      clickable ? 'border-brand-200 hover:bg-brand-50 cursor-pointer' : 'border-gray-200'
    }`}>
      <div className="flex justify-center mb-1"><Icon className="size-5 text-brand-500" /></div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}
