import Link from 'next/link'
import { ChevronLeft, Users } from 'lucide-react'

/** Cabeçalho de uma "conversa em grupo" (mural de ministério/escola) dentro do Chat — mesmo estilo do header de uma DM (ChatThread.tsx). */
export function GroupChatHeader({ slug, name }: { slug: string; name: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 shrink-0">
      <Link href={`/${slug}/chat`} className="lg:hidden p-1 -ml-1 text-gray-400 hover:text-gray-600" aria-label="Voltar">
        <ChevronLeft size={20} />
      </Link>
      <span className="shrink-0 w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-600">
        <Users size={15} />
      </span>
      <h3 className="text-sm font-semibold text-gray-800 truncate">{name}</h3>
    </div>
  )
}
