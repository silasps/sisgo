import Link from 'next/link'
import { SisgoWordmark } from './SisgoWordmark'

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/[0.06] px-5 sm:px-8 py-8">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 opacity-60">
          <SisgoWordmark size={22} />
          <span className="text-xs text-zinc-600">© {new Date().getFullYear()} Todos os direitos reservados.</span>
        </div>
        <div className="flex items-center gap-5 text-xs text-zinc-600">
          <Link href="/bases" className="hover:text-zinc-400 transition-colors">Bases</Link>
          <Link href="/login" className="hover:text-zinc-400 transition-colors">Entrar</Link>
          <Link href="/cadastro" className="hover:text-zinc-400 transition-colors">Criar conta</Link>
        </div>
      </div>
    </footer>
  )
}
