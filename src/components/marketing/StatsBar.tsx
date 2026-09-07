import { STATS } from '@/lib/marketing-content'

export function StatsBar() {
  return (
    <section className="border-y border-white/[0.06] bg-white/[0.02] backdrop-blur-sm px-5 sm:px-8 py-10">
      <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center animate-stagger">
        {STATS.map(s => (
          <div key={s.label}>
            <p className="text-2xl sm:text-3xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-zinc-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
