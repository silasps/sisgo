type Org = { id: string; name: string; slug: string; city: string | null; state: string | null; logo_url: string | null }

export function ActiveBasesSection({ orgs }: { orgs: Org[] }) {
  if (!orgs.length) return null

  return (
    <section id="bases" className="border-t border-white/[0.06] px-5 sm:px-8 py-20 sm:py-28">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-3">Organizações no sistema</p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Explore as organizações</h2>
          <p className="text-zinc-400 text-sm max-w-md mx-auto">
            Clique em uma organização para ver as escolas e oportunidades de inscrição.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-stagger">
          {orgs.map(org => (
            <a
              key={org.id}
              href={`/${org.slug}`}
              className="group glass-card flex items-center gap-4 rounded-2xl p-5 hover:border-brand-500/30 transition-all duration-200 hover:-translate-y-0.5"
            >
              {org.logo_url ? (
                <img src={org.logo_url} alt={org.name} className="w-11 h-11 rounded-xl object-cover bg-white/10 flex-shrink-0" />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-brand-500/15 border border-brand-500/20 flex items-center justify-center text-brand-400 font-bold text-base flex-shrink-0">
                  {org.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate group-hover:text-brand-400 transition-colors">{org.name}</p>
                {(org.city || org.state) && (
                  <p className="text-xs text-zinc-500 mt-0.5 truncate">{[org.city, org.state].filter(Boolean).join(', ')}</p>
                )}
              </div>
              <svg className="w-4 h-4 text-zinc-600 group-hover:text-brand-400 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
