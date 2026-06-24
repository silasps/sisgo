import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { isManagementRole, isOperationalManager } from '@/lib/auth/permissions'
import { MuralClient } from './MuralClient'

type Props = {
  params: Promise<{ slug: string; id: string }>
}

export default async function MuralPage({ params }: Props) {
  const { slug, id } = await params
  const supabase = await createClient()
  const sbAdmin = createAdminClient()

  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id').eq('slug', slug).single(),
  ])
  if (!user || !org) notFound()
  const orgId = org.id

  const { role } = await getCurrentOrganizationRole(supabase, user.id, orgId)
  const canDelete = isOperationalManager(role)

  const { data: profile } = await sbAdmin
    .from('staff_profiles')
    .select('person_id, people(full_name)')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .single()
  const authorName = (profile?.people as unknown as { full_name: string } | null)?.full_name ?? user.email ?? 'Anônimo'

  const [{ data: messagesRaw }, { data: membersRaw }] = await Promise.all([
    sbAdmin.from('ministry_messages')
      .select('id, author_name, author_id, content, mentions, color, font, text_color, created_at')
      .eq('ministry_id', id)
      .order('created_at', { ascending: true })
      .limit(200),
    sbAdmin.from('ministry_members')
      .select('person_id, people(full_name)')
      .eq('ministry_id', id)
      .eq('active', true),
  ])

  const messages = (messagesRaw ?? []).map(m => ({
    ...m,
    mentions: (m.mentions as string[] | null) ?? [],
    font: (m as unknown as { font: number }).font ?? 0,
    text_color: (m as unknown as { text_color: number }).text_color ?? 0,
  }))

  const members = (membersRaw ?? []).map(m => ({
    person_id: m.person_id,
    name: (m.people as unknown as { full_name: string } | null)?.full_name ?? '—',
  }))

  let nextColor = 0
  if (messages.length > 0) {
    nextColor = (messages[messages.length - 1].color + 1) % 6
  }

  async function postMessage(formData: FormData) {
    'use server'
    const content = (formData.get('content') as string).trim()
    if (!content) return

    const mentionMatches = content.match(/@[\w\s]+/g) ?? []
    const mentionedIds: string[] = []
    for (const match of mentionMatches) {
      const name = match.slice(1).trim().toLowerCase()
      const member = members.find(m => m.name.toLowerCase().startsWith(name))
      if (member) mentionedIds.push(member.person_id)
    }

    const db = createAdminClient()
    await db.from('ministry_messages').insert({
      organization_id: orgId,
      ministry_id: id,
      author_id: user.id,
      author_name: authorName,
      content,
      mentions: mentionedIds,
      color: nextColor,
      font: Number(formData.get('font') ?? 0),
      text_color: Number(formData.get('text_color') ?? 0),
    })
    redirect(`/${slug}/ministerios/${id}/mural`)
  }

  async function deleteMessage(formData: FormData) {
    'use server'
    const messageId = formData.get('message_id') as string
    if (!messageId) return
    const db = createAdminClient()
    await db.from('ministry_messages')
      .delete()
      .eq('id', messageId)
      .eq('ministry_id', id)
    redirect(`/${slug}/ministerios/${id}/mural`)
  }

  return (
    <MuralClient
      messages={messages}
      members={members}
      currentUserId={user.id}
      canDelete={canDelete}
      postAction={postMessage}
      deleteAction={deleteMessage}
    />
  )
}
