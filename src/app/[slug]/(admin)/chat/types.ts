/** 'dm' = conversa 1-a-1; 'geral' = grupão com toda a equipe da base (migration 153). */
export type ConversationKind = 'dm' | 'geral'

export type ConversationSummary = {
  kind: ConversationKind
  id: string
  /** Nome da outra pessoa (dm) ou "Geral". */
  title: string
  /** Foto da outra pessoa (só dm). */
  avatarUrl: string | null
  /** Quantas pessoas estão no grupo (só geral). */
  memberCount: number | null
  lastMessagePreview: string | null
  lastMessageAt: string | null
  unread: boolean
}

export type ChatListItem = ConversationSummary

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
