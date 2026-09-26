import { MessageCircle } from 'lucide-react'

// Só aparece no desktop (o wrapper ChatShell esconde isso no mobile — lá,
// "/chat" já mostra a lista de conversas em tela cheia).
export default function ChatIndexPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-400">
      <MessageCircle size={32} className="opacity-40" />
      <p className="text-sm">Selecione uma conversa pra começar.</p>
    </div>
  )
}
