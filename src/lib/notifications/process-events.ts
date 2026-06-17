import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUsers } from './push'
import { getRecipientUserIds } from './recipients'

type NotificationEvent = {
  id: string
  event_type: string
  payload: {
    table_name: string
    operation: string
    record_id: string
    organization_id: string
    school_id?: string
    person_name?: string
    old_status?: string
    new_status?: string
  }
}

const EVENT_LABELS: Record<string, { title: string; bodyFn: (p: NotificationEvent['payload']) => string }> = {
  interest_form: {
    title: 'Nova pré-inscrição',
    bodyFn: (p) => p.person_name
      ? `${p.person_name} se pré-inscreveu`
      : 'Uma nova pré-inscrição foi recebida',
  },
  student_application: {
    title: 'Inscrição de aluno',
    bodyFn: (p) => p.operation === 'INSERT'
      ? 'Nova inscrição de aluno recebida'
      : `Status alterado para: ${statusLabel(p.new_status)}`,
  },
  staff_application: {
    title: 'Inscrição de obreiro',
    bodyFn: (p) => p.operation === 'INSERT'
      ? 'Nova inscrição de obreiro recebida'
      : `Status alterado para: ${statusLabel(p.new_status)}`,
  },
  ministry_request: {
    title: 'Solicitação de ministério',
    bodyFn: (p) => p.operation === 'INSERT'
      ? 'Nova solicitação de ministério'
      : `Solicitação ${statusLabel(p.new_status)}`,
  },
  service_request: {
    title: 'Solicitação de serviço',
    bodyFn: (p) => p.operation === 'INSERT'
      ? 'Nova solicitação de serviço'
      : `Solicitação ${statusLabel(p.new_status)}`,
  },
}

function statusLabel(status?: string | null): string {
  const map: Record<string, string> = {
    pendente: 'pendente',
    em_analise: 'em análise',
    em_contato: 'em contato',
    aprovado: 'aprovado',
    aprovada: 'aprovada',
    reprovado: 'reprovado',
    convertido: 'convertido',
    descartado: 'descartado',
    rejeitado: 'rejeitado',
    rejeitada: 'rejeitada',
    cancelado: 'cancelado',
    resolvido: 'resolvido',
    enviado: 'enviado',
    formulario_enviado: 'formulário enviado',
  }
  return status ? (map[status] ?? status) : 'desconhecido'
}

export async function processNotificationEvents() {
  const supabase = createAdminClient()

  const { data: events } = await supabase
    .from('notification_events')
    .select('*')
    .is('processed_at', null)
    .order('created_at', { ascending: true })
    .limit(50)

  if (!events || events.length === 0) return { processed: 0 }

  let processed = 0

  for (const event of events as NotificationEvent[]) {
    const label = EVENT_LABELS[event.event_type]
    if (!label) continue

    const payload = event.payload
    const recipients = await getRecipientUserIds(
      event.event_type,
      payload.organization_id,
      payload.school_id,
    )

    if (recipients.length > 0) {
      await sendPushToUsers(recipients, {
        title: label.title,
        body: label.bodyFn(payload),
        data: {
          event_type: event.event_type,
          organization_id: payload.organization_id,
          record_id: payload.record_id,
        },
      })

      // Log sent notifications
      const logs = recipients.map(userId => ({
        event_id: event.id,
        user_id: userId,
        channel: 'push' as const,
        status: 'sent',
        sent_at: new Date().toISOString(),
      }))
      await supabase.from('notification_logs').insert(logs)
    }

    await supabase
      .from('notification_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('id', event.id)

    processed++
  }

  return { processed }
}
