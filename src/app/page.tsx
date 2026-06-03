import Link from 'next/link'
import Image from 'next/image'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-dark-950 text-white flex flex-col">
      {/* Faixa laranja no topo */}
      <div className="h-1 bg-brand-500 w-full" />

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-5 max-w-6xl mx-auto w-full">
        <Image
          src="/images/logo-white.png"
          alt="JOCUM A.T."
          width={120}
          height={42}
          className="object-contain"
          priority
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
        <Link
          href="/login"
          className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Entrar
        </Link>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        <span className="text-brand-400 text-xs font-semibold tracking-widest uppercase mb-4">
          SISGO · Sistema de Gestão
        </span>
        <h1 className="text-4xl md:text-6xl font-bold leading-tight max-w-3xl">
          Gestão completa para{' '}
          <span className="text-brand-400">bases missionárias</span>
        </h1>
        <p className="mt-6 text-gray-400 text-lg max-w-xl leading-relaxed">
          Organize pessoas, obreiros, alunos, escolas e ministérios em um só lugar.
          Multi-base, seguro e pensado para o contexto missionário.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-10">
          <Link
            href="/login?tab=cadastro"
            className="px-7 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            Criar conta gratuita
          </Link>
          <Link
            href="/login"
            className="px-7 py-3 border border-white/20 hover:bg-white/5 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            Já tenho acesso →
          </Link>
        </div>
      </section>

      {/* Módulos */}
      <section className="border-t border-white/10 py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-xs text-gray-500 uppercase tracking-widest mb-10 font-semibold">
            Módulos disponíveis
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {MODULES.map(m => (
              <div key={m.label} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center hover:bg-white/8 transition-colors">
                <p className="text-2xl mb-2">{m.icon}</p>
                <p className="text-xs text-gray-300 font-medium">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 text-center text-xs text-gray-600 px-6">
        SISGO · JOCUM Almirante Tamandaré · Todos os direitos reservados
      </footer>
    </div>
  )
}

const MODULES = [
  { icon: '👥', label: 'Pessoas' },
  { icon: '⛪', label: 'Obreiros' },
  { icon: '🎓', label: 'Alunos' },
  { icon: '📚', label: 'Escolas' },
  { icon: '🎵', label: 'Ministérios' },
  { icon: '🏛', label: 'Multi-base' },
]
