import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RevealBackground } from '@/components/RevealBackground'
import {
  GraduationCap, Users, Wallet, UtensilsCrossed, Home,
  Music, CalendarDays,
} from 'lucide-react'

type Props = { searchParams: Promise<{ code?: string }> }

function SisgoSymbol({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Esfera */}
      <circle cx="50" cy="50" r="44" stroke="#F5F1E8" strokeWidth="2.5" fill="none" opacity="0.25" />
      {/* Anel orbital */}
      <ellipse cx="50" cy="50" rx="42" ry="16" stroke="#F5F1E8" strokeWidth="2" fill="none" opacity="0.15" strokeDasharray="5 7" />
      {/* S — arco superior */}
      <path d="M32 50 Q32 22 50 22 Q68 22 72 38" stroke="#F5F1E8" strokeWidth="8" strokeLinecap="round" fill="none" />
      {/* S — arco inferior */}
      <path d="M68 50 Q68 78 50 78 Q32 78 28 62" stroke="#1D6B67" strokeWidth="8" strokeLinecap="round" fill="none" />
      {/* Ponte central */}
      <path d="M32 50 L68 50" stroke="#F5F1E8" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.35" />
    </svg>
  )
}

function SisgoWordmark({ size = 32 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <SisgoSymbol size={size} />
      <span
        className="font-semibold tracking-[0.12em]"
        style={{ color: '#F5F1E8', fontSize: size * 0.55 }}
      >
        SISGO
      </span>
    </div>
  )
}

export default async function LandingPage({ searchParams }: Props) {
  const { code } = await searchParams
  if (code) redirect(`/auth/callback?code=${code}`)
  const supabase = await createClient()
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name, slug, city, state, logo_url')
    .eq('active', true)
    .order('name')

  return (
    <>
      {/* Força background escuro no body para evitar flash branco */}
      <style>{`html,body{background:#040c0b}`}</style>

    <div className="min-h-screen text-white flex flex-col antialiased">

      {/* ── Backgrounds fixos (z-0) ── */}
      <RevealBackground />


      {/* Grain overlay */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[9998]"
        style={{
          opacity: 0.025,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '200px',
        }}
      />

      {/* ── Todo o conteúdo em z-[1] para ficar ACIMA dos backgrounds fixos ── */}
      <div className="relative z-[1] flex flex-col flex-1">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#060a0a]/70 backdrop-blur-xl">
        <nav className="max-w-6xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
          <SisgoWordmark size={26} />
          <div className="hidden sm:flex items-center gap-6 text-sm text-zinc-400">
            <a href="#funcionalidades" className="hover:text-white transition-colors">Funcionalidades</a>
            <a href="#bases" className="hover:text-white transition-colors">Bases</a>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors font-medium">
              Entrar
            </Link>
            <Link
              href="/login?tab=cadastro"
              className="px-4 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Criar conta
            </Link>
          </div>
        </nav>
      </header>

      {/* ── Hero ── */}
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

        <div className="relative max-w-4xl">
          <div className="inline-flex items-center gap-2 border border-brand-500/25 bg-brand-500/8 text-xs text-brand-400 px-3 py-1.5 rounded-full mb-8 font-medium backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
            Sistema de gestão para bases missionárias
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.1]">
            Gestão completa.<br />
            <span style={{ background: 'linear-gradient(135deg, rgb(47,160,155) 0%, #5AC4BF 60%, #8ADBD7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Para qualquer base.
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
              href="/login?tab=cadastro"
              className="w-full sm:w-auto px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-all text-sm shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30 hover:-translate-y-0.5"
            >
              Começar gratuitamente
            </Link>
            <a
              href="#bases"
              className="w-full sm:w-auto px-6 py-3 border border-white/10 hover:border-brand-500/30 hover:bg-brand-500/5 text-zinc-300 hover:text-white font-medium rounded-xl transition-all text-sm"
            >
              Ver bases cadastradas →
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
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

      {/* ── Funcionalidades ── */}
      <section id="funcionalidades" className="relative px-5 sm:px-8 py-20 sm:py-28 max-w-6xl mx-auto w-full">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-3">Funcionalidades</p>
          <h2 className="text-3xl sm:text-4xl font-bold">Tudo que sua base precisa</h2>
          <p className="text-zinc-400 mt-4 max-w-xl mx-auto text-sm sm:text-base">
            Cada módulo foi desenhado para o dia a dia de bases missionárias reais.
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

      {/* ── Como funciona ── */}
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

      {/* ── Bases ativas ── */}
      {orgs && orgs.length > 0 && (
        <section id="bases" className="border-t border-white/[0.06] px-5 sm:px-8 py-20 sm:py-28">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-3">Bases no sistema</p>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Explore as bases</h2>
              <p className="text-zinc-400 text-sm max-w-md mx-auto">
                Clique em uma base para ver as escolas e oportunidades de inscrição.
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
      )}

      {/* ── CTA Final ── */}
      <section className="border-t border-white/[0.06] px-5 sm:px-8 py-20 sm:py-28">
        <div className="max-w-3xl mx-auto relative">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
            <div className="w-[500px] h-56 rounded-full bg-brand-500/10 blur-3xl" />
          </div>
          <div className="relative glass-card rounded-3xl p-10 sm:p-16 text-center border-brand-500/20">
            <h2 className="text-3xl sm:text-5xl font-bold mb-5">
              Pronto para modernizar<br className="hidden sm:block" /> sua base?
            </h2>
            <p className="text-zinc-400 mb-10 text-sm sm:text-base max-w-md mx-auto">
              Crie sua conta gratuitamente e comece a organizar sua base missionária hoje.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/login?tab=cadastro"
                className="w-full sm:w-auto px-8 py-3.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-all text-sm shadow-lg shadow-brand-500/20 hover:-translate-y-0.5"
              >
                Criar conta gratuita
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto px-8 py-3.5 border border-white/10 hover:border-brand-500/30 hover:bg-brand-500/5 text-zinc-300 hover:text-white font-medium rounded-xl transition-all text-sm"
              >
                Já tenho acesso
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] px-5 sm:px-8 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 opacity-60">
            <SisgoWordmark size={22} />
            <span className="text-xs text-zinc-600">© {new Date().getFullYear()} Todos os direitos reservados.</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-zinc-600">
            <Link href="/bases" className="hover:text-zinc-400 transition-colors">Bases</Link>
            <Link href="/login" className="hover:text-zinc-400 transition-colors">Entrar</Link>
            <Link href="/login?tab=cadastro" className="hover:text-zinc-400 transition-colors">Criar conta</Link>
          </div>
        </div>
      </footer>

      </div>{/* fim z-[1] content wrapper */}
    </div>
    </>
  )
}

const STATS = [
  { value: 'Multi', label: 'base — uma plataforma' },
  { value: '10+',  label: 'módulos integrados' },
  { value: '100%', label: 'contexto missionário' },
  { value: 'Real', label: 'time — sempre atualizado' },
]

const FEATURES_BIG = [
  {
    icon: GraduationCap,
    title: 'Escolas e inscrições',
    desc: 'Gerencie ETEDs e escolas de segundo nível com turmas, presenças, atividades, certificados e todo o fluxo de inscrição — do formulário público até a aprovação do candidato.',
  },
  {
    icon: Users,
    title: 'Pessoas e obreiros',
    desc: 'Cadastro completo de toda a comunidade da base: alunos, obreiros, voluntários e associados. Perfis com saúde, documentos e histórico centralizado em um só lugar.',
  },
]

const FEATURES_MID = [
  {
    icon: Wallet,
    title: 'Financeiro',
    desc: 'Cobranças, contas a pagar, relatórios e controle de caixa por área — tudo com visibilidade por perfil de acesso.',
  },
  {
    icon: UtensilsCrossed,
    title: 'Cozinha',
    desc: 'Cardápio, estoque, refeições flexíveis e pagamentos integrados. Do pedido à comprovação, sem papel.',
  },
  {
    icon: Home,
    title: 'Reservas',
    desc: 'Quartos e instalações com formulário customizável, aprovações e controle de disponibilidade.',
  },
]

const FEATURES_SMALL = [
  {
    icon: Music,
    title: 'Ministérios',
    desc: 'Organize equipes, líderes e membros com solicitações e pendências automatizadas.',
  },
  {
    icon: CalendarDays,
    title: 'Calendário e presença',
    desc: 'Eventos, aulas e controle de presença com lançamento de faltas e declarações.',
  },
]

const STEPS = [
  {
    title: 'Crie sua conta',
    desc: 'Cadastre-se com e-mail ou Google em segundos. Sem cartão de crédito, sem burocracia.',
  },
  {
    title: 'Explore as bases',
    desc: 'Navegue pelas bases missionárias cadastradas e conheça as escolas e programas disponíveis.',
  },
  {
    title: 'Faça sua inscrição',
    desc: 'Candidate-se como aluno, obreiro ou voluntário diretamente pelo sistema.',
  },
]
