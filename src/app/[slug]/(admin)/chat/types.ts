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
