import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { notFound } from 'next/navigation'
import Link from 'next/link'

type Props = { params: Promise<{ slug: string }> }

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pendente:           { label: 'Pendente',     color: 'bg-yellow-100 text-yellow-700' },
  formulario_enviado: { label: 'Formulário',   color: 'bg-blue-100 text-blue-700' },
  em_contato:         { label: 'Em contato',   color: 'bg-purple-100 text-purple-700' },
  convertido:         { label: 'Convertido',   color: 'bg-green-100 text-green-700' },
  descartado:         { label: 'Descartado',   color: 'bg-gray-100 text-gray-500' },
}

export default async function InscricoesPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!org) notFound()

  const { data: registrations } = await supabase
    .from('school_interest_forms')
    .select('id, full_name, email, phone, message, status, created_at, responded_at, schools(name), school_classes(name)')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })

  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000

  const isEscalated = (item: { created_at: string; responded_at: string | null; status: string }) => {
    if (item.responded_at || item.status === 'convertido' || item.status === 'descartado') return false
    return Date.now() - new Date(item.created_at).getTime() > THREE_DAYS_MS
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

  const formatTimeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) return 'hoje'
    if (days === 1) return '1 dia atrás'
    return `${days} dias atrás`
  }

  return (
    <>
      <Header
        title="Inscrições"
        actions={
          <Link href={`/${slug}/escolas/programas`} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Gerenciar programas
          </Link>
        }
      />
      <main className="p-4 md:p-6">
        {!registrations?.length ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <p className="text-3xl mb-3">📋</p>
            <p className="text-gray-400 text-sm">Nenhuma pré-inscrição recebida ainda.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {registrations.map(reg => {
              const escalated = isEscalated({ created_at: reg.created_at, responded_at: reg.responded_at, status: reg.status })
              const statusInfo = STATUS_LABELS[reg.status] ?? { label: reg.status, color: 'bg-gray-100 text-gray-500' }
              const school = reg.schools as unknown as { name: string } | null
              const schoolClass = reg.school_classes as unknown as { name: string } | null

              return (
                <div
                  key={reg.id}
                  className={`bg-white rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${
                    escalated ? 'border-red-200 bg-red-50/30' : 'border-gray-200'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{reg.full_name}</p>
                      {escalated && (
                        <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                          Escalado
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{reg.email}{reg.phone ? ` · ${reg.phone}` : ''}</p>
                    {(school || schoolClass) && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {school?.name}{schoolClass?.name ? ` · ${schoolClass.name}` : ''}
                      </p>
                    )}
                    {reg.message && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1 italic">"{reg.message}"</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <span className={`inline-block text-xs font-semibold px-2 py-1 rounded-full ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">{formatTimeAgo(reg.created_at)}</p>
                    </div>
                    <StatusActions registrationId={reg.id} currentStatus={reg.status} slug={slug} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </>
  )
}

function StatusActions({ registrationId, currentStatus, slug }: {
  registrationId: string
  currentStatus: string
  slug: string
}) {
  if (currentStatus === 'convertido' || currentStatus === 'descartado') return null

  return (
    <div className="flex gap-1">
      <UpdateStatusForm registrationId={registrationId} newStatus="em_contato" slug={slug}
        label="Em contato" className="text-xs px-2 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg transition-colors" />
      <UpdateStatusForm registrationId={registrationId} newStatus="convertido" slug={slug}
        label="✓" className="text-xs px-2 py-1 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg transition-colors" />
      <UpdateStatusForm registrationId={registrationId} newStatus="descartado" slug={slug}
        label="✕" className="text-xs px-2 py-1 bg-gray-50 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors" />
    </div>
  )
}

function UpdateStatusForm({ registrationId, newStatus, slug, label, className }: {
  registrationId: string
  newStatus: string
  slug: string
  label: string
  className: string
}) {
  async function update() {
    'use server'
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const supabase = createAdminClient()
    await supabase
      .from('school_interest_forms')
      .update({ status: newStatus, responded_at: new Date().toISOString() })
      .eq('id', registrationId)
    const { redirect } = await import('next/navigation')
    redirect(`/${slug}/inscricoes`)
  }

  return (
    <form action={update}>
      <button type="submit" className={className} title={newStatus}>
        {label}
      </button>
    </form>
  )
}
