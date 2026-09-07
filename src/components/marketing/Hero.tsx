import Link from 'next/link'

export function Hero() {
  return (
    <section className="relative overflow-hidden px-5 sm:px-8 pt-24 pb-28 sm:pt-32 sm:pb-36 flex flex-col items-center text-center">
      {/* Ambient orbs */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute rounded-full"
          style={{
            top: '-8%', left: '15%',
            width: '520px', height: '520px',
            background: 'radial-gradient(circle, rgba(29,107,103,0.18) 0%, transparent 70%)',
            filter: 'blur(60px)',
            animation: 'pulse-slow 7s ease-in-out infinite',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            top: '25%', right: '5%',
            width: '320px', height: '320px',
            background: 'radial-gradient(circle, rgba(29,107,103,0.10) 0%, transparent 70%)',
            filter: 'blur(60px)',
            animation: 'pulse-slow 9s ease-in-out infinite 2s',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            bottom: '0', left: '5%',
            width: '400px', height: '260px',
            background: 'radial-gradient(circle, rgba(21,52,59,0.35) 0%, transparent 70%)',
            filter: 'blur(80px)',
            animation: 'pulse-slow 11s ease-in-out infinite 4s',
          }}
        />
      </div>

      {/* Véu escuro atrás do texto — garante leitura sobre a foto, independente do overlay geral do fundo */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{ background: 'radial-gradient(ellipse 85% 65% at 50% 32%, rgba(4,12,10,0.55) 0%, rgba(4,12,10,0.2) 65%, transparent 100%)' }}
      />

      <div className="relative max-w-4xl">
        <div className="inline-flex items-center gap-2 border border-brand-500/25 bg-brand-500/8 text-xs text-brand-400 px-3 py-1.5 rounded-full mb-8 font-medium backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
          Sistema de gestão para organizações missionárias
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.1]">
          Gestão completa.<br />
          <span style={{ color: '#8ADBD7' }}>
            Para qualquer organização.
          </span>
        </h1>

        <p className="mt-5 text-xs sm:text-sm font-medium tracking-[0.18em] uppercase text-brand-400/60">
          Muitas áreas. Uma operação compartilhada.
        </p>

        <p className="mt-5 text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Centralize pessoas, escolas, obreiros, ministérios, finanças e muito mais
          em uma plataforma moderna — pensada para o contexto missionário.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10">
          <Link
            href="/cadastro"
            className="w-full sm:w-auto px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-all text-sm shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30 hover:-translate-y-0.5"
          >
            Começar gratuitamente
          </Link>
          <a
            href="#bases"
            className="w-full sm:w-auto px-6 py-3 border border-white/10 hover:border-brand-500/30 hover:bg-brand-500/5 text-zinc-300 hover:text-white font-medium rounded-xl transition-all text-sm"
          >
            Ver organizações cadastradas →
          </a>
        </div>
      </div>
    </section>
  )
}
