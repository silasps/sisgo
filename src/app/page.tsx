import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name, slug, city, state, logo_url')
    .eq('active', true)
    .order('name')

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col antialiased">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-xl">
        <nav className="max-w-6xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/images/logo-white.png"
              alt="SISGO"
              width={90}
              height={32}
              className="object-contain"
              priority
            />
          </div>
          <div className="hidden sm:flex items-center gap-6 text-sm text-zinc-400">
            <a href="#funcionalidades" className="hover:text-white transition-colors">Funcionalidades</a>
            <a href="#bases" className="hover:text-white transition-colors">Bases</a>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors font-medium">
              Entrar
            </Link>
            <Link href="/login?tab=cadastro" className="px-4 py-1.5 bg-white text-zinc-900 text-sm font-semibold rounded-lg hover:bg-zinc-100 transition-colors">
              Criar conta
            </Link>
          </div>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-5 sm:px-8 pt-20 pb-24 sm:pt-28 sm:pb-32 flex flex-col items-center text-center">
        {/* glow de fundo */}
        <div className="pointer-events-none absolute inset-0 flex items-start justify-center">
          <div className="mt-10 w-[600px] h-[300px] rounded-full bg-brand-500/20 blur-[120px]" />
        </div>

        <div className="relative max-w-4xl">
          <div className="inline-flex items-center gap-2 border border-white/10 bg-white/5 text-xs text-zinc-400 px-3 py-1.5 rounded-full mb-8 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
            Sistema de gestão para organizações missionárias
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.1]">
            Gestão completa.<br />
            <span className="bg-gradient-to-r from-brand-400 to-brand-300 bg-clip-text text-transparent">
              Para qualquer base.
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Centralize pessoas, escolas, obreiros, ministérios, finanças e muito mais
            em uma plataforma moderna — pensada especificamente para o contexto missionário.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10">
            <Link
              href="/login?tab=cadastro"
              className="w-full sm:w-auto px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-all text-sm shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30"
            >
              Começar gratuitamente
            </Link>
            <a
              href="#bases"
              className="w-full sm:w-auto px-6 py-3 border border-white/10 hover:bg-white/5 text-zinc-300 hover:text-white font-medium rounded-xl transition-all text-sm"
            >
              Ver bases cadastradas →
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-y border-white/[0.06] bg-white/[0.02] px-5 sm:px-8 py-10">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {STATS.map(s => (
            <div key={s.label}>
              <p className="text-2xl sm:text-3xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-zinc-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Funcionalidades ── */}
      <section id="funcionalidades" className="px-5 sm:px-8 py-20 sm:py-28 max-w-6xl mx-auto w-full">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-3">Funcionalidades</p>
          <h2 className="text-3xl sm:text-4xl font-bold">Tudo que sua base precisa</h2>
          <p className="text-zinc-400 mt-4 max-w-xl mx-auto text-sm sm:text-base">
            Cada módulo foi desenhado para o dia a dia de bases missionárias reais.
          </p>
        </div>

        {/* Features destaque — 2 cards grandes */}
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          {FEATURES_BIG.map(f => (
            <div key={f.title} className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-7 hover:bg-white/[0.05] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/20 flex items-center justify-center text-xl mb-5">
                {f.icon}
              </div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
              <div className="pointer-events-none absolute bottom-0 right-0 w-32 h-32 bg-brand-500/5 rounded-full blur-2xl" />
            </div>
          ))}
        </div>

        {/* Features grade — 3 cards médios */}
        <div className="grid sm:grid-cols-3 gap-4 mb-4">
          {FEATURES_MID.map(f => (
            <div key={f.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 hover:bg-white/[0.05] transition-colors">
              <p className="text-2xl mb-4">{f.icon}</p>
              <h3 className="font-semibold mb-1.5">{f.title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Features grade — 2 cards */}
        <div className="grid sm:grid-cols-2 gap-4">
          {FEATURES_SMALL.map(f => (
            <div key={f.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 hover:bg-white/[0.05] transition-colors flex items-start gap-4">
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-lg flex-shrink-0">
                {f.icon}
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
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
                    <div className="hidden sm:block flex-1 h-px border-t border-dashed border-white/10" />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {orgs.map(org => (
                <a
                  key={org.id}
                  href={`/${org.slug}`}
                  className="group flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 hover:bg-white/[0.06] hover:border-brand-500/30 transition-all duration-200"
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
        <div className="max-w-3xl mx-auto text-center relative">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-96 h-40 rounded-full bg-brand-500/10 blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="text-3xl sm:text-5xl font-bold mb-5">
              Pronto para modernizar<br className="hidden sm:block" /> sua base?
            </h2>
            <p className="text-zinc-400 mb-10 text-sm sm:text-base">
              Crie sua conta gratuitamente e comece a organizar sua base missionária hoje.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/login?tab=cadastro"
                className="w-full sm:w-auto px-8 py-3.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-all text-sm shadow-lg shadow-brand-500/20"
              >
                Criar conta gratuita
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto px-8 py-3.5 border border-white/10 hover:bg-white/5 text-zinc-300 hover:text-white font-medium rounded-xl transition-all text-sm"
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
          <div className="flex items-center gap-3">
            <Image
              src="/images/logo-white.png"
              alt="SISGO"
              width={70}
              height={25}
              className="object-contain opacity-60"
            />
            <span className="text-xs text-zinc-600">© {new Date().getFullYear()} SISGO. Todos os direitos reservados.</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-zinc-600">
            <Link href="/bases" className="hover:text-zinc-400 transition-colors">Bases</Link>
            <Link href="/login" className="hover:text-zinc-400 transition-colors">Entrar</Link>
            <Link href="/login?tab=cadastro" className="hover:text-zinc-400 transition-colors">Criar conta</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}

const STATS = [
  { value: 'Multi', label: 'base — uma plataforma' },
  { value: '10+', label: 'módulos integrados' },
  { value: '100%', label: 'contexto missionário' },
  { value: 'Real', label: 'time — sempre atualizado' },
]

const FEATURES_BIG = [
  {
    icon: '🎓',
    title: 'Escolas e inscrições',
    desc: 'Gerencie ETEDs e escolas de segundo nível com turmas, presenças, atividades, certificados e todo o fluxo de inscrição — do formulário público até a aprovação do candidato.',
  },
  {
    icon: '👥',
    title: 'Pessoas e obreiros',
    desc: 'Cadastro completo de toda a comunidade da base: alunos, obreiros, voluntários e associados. Perfis com saúde, documentos e histórico centralizado em um só lugar.',
  },
]

const FEATURES_MID = [
  {
    icon: '💰',
    title: 'Financeiro',
    desc: 'Cobranças, contas a pagar, relatórios e controle de caixa por área — tudo com visibilidade por perfil de acesso.',
  },
  {
    icon: '🍽️',
    title: 'Cozinha',
    desc: 'Cardápio, estoque, refeições flexíveis e pagamentos integrados. Do pedido à comprovação, sem papel.',
  },
  {
    icon: '🏠',
    title: 'Reservas',
    desc: 'Quartos e instalações com formulário customizável, aprovações e controle de disponibilidade.',
  },
]

const FEATURES_SMALL = [
  {
    icon: '🎵',
    title: 'Ministérios',
    desc: 'Organize equipes, líderes e membros com solicitações e pendências automatizadas.',
  },
  {
    icon: '📅',
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
