import { STEPS } from '@/lib/marketing-content'

export function HowItWorksSection() {
  return (
    <section className="border-t border-white/[0.06] bg-white/[0.02] px-5 sm:px-8 py-20 sm:py-28">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-3">Como funciona</p>
          <h2 className="text-3xl sm:text-4xl font-bold">Simples de começar</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-6 sm:gap-10">
          {STEPS.map((s, i) => (
            <div key={s.title} className="relative flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full border border-brand-500/40 bg-brand-500/10 flex items-center justify-center text-brand-400 text-xs font-bold flex-shrink-0">
                  {i + 1}
                </div>
                {i < 2 && (
                  <div className="hidden sm:block flex-1 h-px border-t border-dashed border-brand-500/20" />
                )}
              </div>
              <div>
                <h3 className="font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
