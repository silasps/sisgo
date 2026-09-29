export type ConversationSummary = {
  type: 'dm'
  id: string
  otherUserId: string
  otherName: string
  otherAvatarUrl: string | null
  lastMessagePreview: string | null
  lastMessageAt: string | null
  unread: boolean
}

// "Grupo" = mural de ministério/escola já existente (ministry_messages/
// school_messages) listado junto com as DMs — não migra dado, só aparece
// na mesma tela (ver plano em .claude/plans/ethereal-baking-pudding.md).
export type GroupSummary = {
  type: 'group'
  id: string
  kind: 'ministerio' | 'escola'
  name: string
  lastMessagePreview: string | null
  lastMessageAt: string | null
  unread: boolean
}

export type ChatListItem = ConversationSummary | GroupSummary

export type MessageReaction = { emoji: string; userIds: string[] }

export type ChatMessage = {
  id: string
  authorId: string
  content: string
  createdAt: string
  editedAt: string | null
  reactions: MessageReaction[]
}

export type ChatPerson = { userId: string; personId: string; fullName: string; kind: 'obreiro' | 'aluno' }
