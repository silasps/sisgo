import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PrintControls } from '../../../../escolas/[id]/turmas/[classId]/certificado/[personId]/PrintControls'
import { TERMINATION_REASON_LABELS } from '@/lib/staff/terminationPolicy'

type Props = { params: Promise<{ slug: string; personId: string; terminationId: string }> }

function formatDateFull(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function TermoDesligamentoPage({ params }: Props) {
  const { slug, personId, terminationId } = await params

  const supabase = await createClient()
  const { data: org } = await supabase.from('organizations').select('id, name').eq('slug', slug).single()
  if (!org) notFound()

  const db = createAdminClient()
  const [{ data: pessoa }, { data: termo }] = await Promise.all([
    db.from('people').select('full_name').eq('id', personId).eq('organization_id', org.id).single(),
    db.from('staff_terminations').select('*').eq('id', terminationId).eq('organization_id', org.id).single(),
  ])
  if (!pessoa || !termo) notFound()

  let terminatedByName = 'Equipe de Desenvolvimento Humano'
  if (termo.terminated_by) {
    const { data: authUser } = await db.auth.admin.getUserById(termo.terminated_by)
    terminatedByName = authUser.user?.user_metadata?.full_name ?? authUser.user?.email ?? terminatedByName
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 print:p-0 print:bg-white">
      <style dangerouslySetInnerHTML={{ __html: '@media print { @page { size: A4; margin: 2cm; } body { margin: 0; } }' }} />
      <PrintControls backHref={`/${slug}/pessoas/${personId}/acesso`} />

      <div className="mx-auto bg-white shadow-xl print:shadow-none w-full max-w-2xl print:max-w-none rounded-2xl print:rounded-none p-10 print:p-0 space-y-6">
        <div className="text-center border-b border-gray-100 pb-5">
          <p className="text-xs font-semibold tracking-[0.2em] text-gray-400 uppercase mb-1">{org.name}</p>
          <h1 className="text-2xl font-black text-gray-800">Termo de Desligamento</h1>
          <p className="text-xs text-gray-400 mt-1">Emitido em {formatDateFull(termo.created_at)}</p>
        </div>

        <p className="text-sm text-gray-700 leading-relaxed">
          Este termo formaliza o desligamento de <strong>{pessoa.full_name}</strong> das atividades de
          voluntariado em <strong>{org.name}</strong>
          {termo.last_unit_label ? <>, onde serviu em <strong>{termo.last_unit_label}</strong></> : null}.
        </p>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2 text-sm">
          <p><span className="text-gray-400">Motivo:</span> {TERMINATION_REASON_LABELS[termo.reason_category] ?? termo.reason_category}</p>
          {termo.reason_text && <p><span className="text-gray-400">Detalhes:</span> {termo.reason_text}</p>}
          <p><span className="text-gray-400">Conversa prévia com a liderança:</span> {termo.had_prior_conversation ? 'Sim' : 'Não'}</p>
          {termo.leader_name && <p><span className="text-gray-400">Líder responsável:</span> {termo.leader_name}</p>}
          <p><span className="text-gray-400">Registrado por:</span> {terminatedByName}</p>
        </div>

        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-xs text-amber-800 leading-relaxed">
          <p className="font-semibold mb-1">Sobre seus dados</p>
          <p>
            O acesso à plataforma foi encerrado nesta data. Seus dados cadastrais continuam retidos, de
            forma restrita, até <strong>{formatDateFull(termo.retained_until)}</strong> — prazo adotado pela
            instituição para eventual necessidade de defesa em processo administrativo ou judicial, conforme
            art. 16 da Lei Geral de Proteção de Dados (Lei 13.709/2018). Após esse prazo, os dados são
            avaliados para remoção ou anonimização.
          </p>
        </div>

        <div className="flex justify-center gap-16 pt-6">
          <div className="text-center">
            <div className="border-t border-gray-400 w-48 mb-2 mx-auto" />
            <p className="text-xs text-gray-500">{pessoa.full_name}</p>
          </div>
          <div className="text-center">
            <div className="border-t border-gray-400 w-48 mb-2 mx-auto" />
            <p className="text-xs text-gray-500">{org.name}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
