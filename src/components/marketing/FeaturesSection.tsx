import { FEATURES_BIG, FEATURES_MID, FEATURES_SMALL } from '@/lib/marketing-content'

export function FeaturesSection() {
  return (
    <section id="funcionalidades" className="relative px-5 sm:px-8 py-20 sm:py-28 max-w-6xl mx-auto w-full">
      <div className="text-center mb-14">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-3">Funcionalidades</p>
        <h2 className="text-3xl sm:text-4xl font-bold">Tudo que sua organização precisa</h2>
        <p className="text-zinc-400 mt-4 max-w-xl mx-auto text-sm sm:text-base">
          Cada módulo foi desenhado para o dia a dia de organizações missionárias reais.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        {FEATURES_BIG.map(f => (
          <div key={f.title} className="glass-card relative overflow-hidden rounded-2xl p-7 hover:border-brand-500/30 transition-all duration-300 group">
            <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/20 flex items-center justify-center mb-5">
              <f.icon className="size-5 text-brand-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2 group-hover:text-brand-400 transition-colors">{f.title}</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
            <div className="pointer-events-none absolute bottom-0 right-0 w-40 h-40 bg-brand-500/5 rounded-full blur-3xl group-hover:bg-brand-500/10 transition-all duration-500" />
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-4">
        {FEATURES_MID.map(f => (
          <div key={f.title} className="glass-card rounded-2xl p-6 hover:border-brand-500/30 transition-all duration-300 group">
            <f.icon className="size-6 text-brand-400 mb-4" />
            <h3 className="font-semibold mb-1.5 group-hover:text-brand-400 transition-colors">{f.title}</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {FEATURES_SMALL.map(f => (
          <div key={f.title} className="glass-card rounded-2xl p-6 hover:border-brand-500/30 transition-all duration-300 flex items-start gap-4 group">
            <div className="w-9 h-9 rounded-lg bg-brand-500/10 border border-brand-500/15 flex items-center justify-center flex-shrink-0">
              <f.icon className="size-4 text-brand-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-1 group-hover:text-brand-400 transition-colors">{f.title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
