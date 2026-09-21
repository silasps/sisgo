import Link from 'next/link'
import { SisgoWordmark } from './SisgoWordmark'

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#060a0a]/70 backdrop-blur-xl">
      <nav className="max-w-6xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
        <Link href="/">
          <SisgoWordmark size={26} />
        </Link>
        <div className="hidden sm:flex items-center gap-6 text-sm text-zinc-400">
          <Link href="/#funcionalidades" className="hover:text-white transition-colors">Funcionalidades</Link>
          <Link href="/pricing" className="hover:text-white transition-colors">Planos</Link>
          <Link href="/oportunidades" className="hover:text-white transition-colors">Oportunidades</Link>
          <Link href="/bases" className="hover:text-white transition-colors">Bases</Link>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login" className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors font-medium">
            Entrar
          </Link>
          <Link
            href="/cadastro"
            className="px-4 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Criar conta
          </Link>
        </div>
      </nav>
    </header>
  )
}
