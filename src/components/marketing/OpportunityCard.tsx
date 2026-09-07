import { BookOpen } from 'lucide-react'
import { schoolTypeShortLabel } from '@/lib/schools'

export type OpportunitySchool = {
  id: string
  slug: string | null
  name: string
  acronym: string | null
  school_type: string | null
  subtitle: string | null
  hero_image_url: string | null
  organizations: { slug: string; name: string; city: string | null; state: string | null; logo_url: string | null; active?: boolean } | null
}

export function OpportunityCard({ school }: { school: OpportunitySchool }) {
  const org = school.organizations
  if (!org) return null

  return (
    <a
      href={`/${org.slug}/escola/${school.slug ?? school.id}`}
      className="group glass-card rounded-2xl overflow-hidden hover:border-brand-500/30 transition-all duration-300"
    >
      <div className="h-40 bg-dark-800 overflow-hidden">
        {school.hero_image_url ? (
          <img
            src={school.hero_image_url}
            alt={school.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-900 to-dark-900">
            <BookOpen className="size-8 text-white/40" />
          </div>
        )}
      </div>
      <div className="p-5">
        <span className="text-xs font-semibold uppercase tracking-wide text-brand-400">
          {schoolTypeShortLabel(school.school_type)}
        </span>
        <h3 className="font-bold text-lg mt-1 group-hover:text-brand-400 transition-colors">
          {school.name}
        </h3>
        {school.subtitle && (
          <p className="text-zinc-400 text-sm mt-1 line-clamp-2">{school.subtitle}</p>
        )}
        <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
          {org.logo_url ? (
            <img src={org.logo_url} alt={org.name} className="w-5 h-5 rounded object-cover bg-white/10" />
          ) : (
            <span className="w-5 h-5 rounded bg-brand-500/15 flex items-center justify-center text-brand-400 font-bold text-[10px]">
              {org.name.charAt(0)}
            </span>
          )}
          <span className="truncate">{org.name}</span>
        </div>
        <span className="mt-3 inline-block text-sm font-semibold text-brand-400 group-hover:underline">
          Saiba mais →
        </span>
      </div>
    </a>
  )
}
