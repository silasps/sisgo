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
    <div className="min-h-screen bg-dark-950 text-white flex flex-col">
      <div className="h-1 bg-brand-500 w-full" />

      {/* Navbar */}
      <nav className="flex items-center justify-between px-5 sm:px-10 py-4 max-w-6xl mx-auto w-full">
        <Image
          src="/images/logo-white.png"
          alt="SISGO"
          width={110}
          height={38}
          className="object-contain"
          priority
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/login" className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors font-medium">
            Entrar
          </Link>
          <Link href="/login?tab=cadastro" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors">
            Criar conta
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-5 sm:px-10 py-16 sm:py-24 max-w-6xl mx-auto w-full">
        <div className="max-w-3xl">
          <span className="inline-block text-brand-400 text-xs font-bold tracking-widest uppercase mb-5 border border-brand-500/30 bg-brand-500/10 px-3 py-1 rounded-full">
            SISGO · Sistema de Gestão de Bases
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight">
            Gestão completa para{' '}
            <span className="text-brand-400">bases missionárias</span>
          </h1>
          <p className="mt-6 text-gray-400 text-lg sm:text-xl leading-relaxed max-w-2xl">
            Desenvolvido pela JOCUM para JOCUM. Centralize pessoas, obreiros, alunos,
            escolas, ministérios, finanças e muito mais — tudo em um único sistema.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-10">
            <a href="#bases" className="px-7 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors text-sm text-center">
              Conhecer as bases
            </a>
            <Link href="/login?tab=cadastro" className="px-7 py-3 border border-white/20 hover:bg-white/5 text-white font-semibold rounded-xl transition-colors text-sm text-center">
              Criar conta gratuita →
            </Link>
          </div>
        </div>
      </section>

      {/* Missão */}
      <section className="border-t border-white/10 px-5 sm:px-10 py-14 sm:py-20">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-brand-400 text-xs font-bold uppercase tracking-widest mb-3">Nossa missão</p>
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              Servindo quem serve
            </h2>
            <p className="text-gray-400 leading-relaxed">
              A JOCUM (Jovens Com Uma Missão) está presente em centenas de países com bases
              missionárias que formam e enviam obreiros ao redor do mundo. O SISGO nasceu para
              eliminar a burocracia dessas bases — permitindo que líderes se concentrem no que
              realmente importa: as pessoas e a missão.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {STATS.map(s => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <p className="text-3xl font-bold text-brand-400">{s.value}</p>
                <p className="text-sm text-gray-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section className="border-t border-white/10 px-5 sm:px-10 py-14 sm:py-20 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-brand-400 text-xs font-bold uppercase tracking-widest mb-3">Como funciona</p>
          <h2 className="text-center text-2xl sm:text-3xl font-bold mb-12">Simples do início ao fim</h2>
          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
            {STEPS.map((s, i) => (
              <div key={s.title} className="flex flex-col items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400 font-bold text-sm flex-shrink-0">
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{s.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Módulos */}
      <section className="border-t border-white/10 px-5 sm:px-10 py-14 sm:py-20">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-brand-400 text-xs font-bold uppercase tracking-widest mb-3">O que gerenciamos</p>
          <h2 className="text-center text-2xl sm:text-3xl font-bold mb-12">Tudo o que a sua base precisa</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {MODULES.map(m => (
              <div key={m.label} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/8 hover:border-brand-500/30 transition-all">
                <p className="text-3xl mb-3">{m.icon}</p>
                <p className="font-semibold text-sm text-white">{m.label}</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bases ativas */}
      {orgs && orgs.length > 0 && (
        <section id="bases" className="border-t border-white/10 px-5 sm:px-10 py-14 sm:py-20 bg-white/[0.02]">
          <div className="max-w-6xl mx-auto">
            <p className="text-center text-brand-400 text-xs font-bold uppercase tracking-widest mb-3">Bases no sistema</p>
            <h2 className="text-center text-2xl sm:text-3xl font-bold mb-4">Conheça nossas bases</h2>
            <p className="text-center text-gray-400 text-sm mb-10 max-w-xl mx-auto">
              Clique em uma base para ver as escolas disponíveis e fazer sua pré-inscrição.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {orgs.map(org => (
                <a
                  key={org.id}
                  href={`/${org.slug}`}
                  className="group bg-white/5 border border-white/10 rounded-2xl p-5 hover:shadow-md hover:-translate-y-1 hover:border-brand-500/40 transition-all duration-200"
                >
                  <div className="flex items-center gap-3 mb-3">
                    {org.logo_url ? (
                      <img src={org.logo_url} alt={org.name} className="w-10 h-10 rounded-lg object-cover bg-white/10" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold text-sm flex-shrink-0">
                        {org.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-white text-sm truncate group-hover:text-brand-400 transition-colors">{org.name}</p>
                      {(org.city || org.state) && (
                        <p className="text-xs text-gray-500 truncate">{[org.city, org.state].filter(Boolean).join(', ')}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-brand-400 font-semibold group-hover:underline">Abrir →</p>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Final */}
      <section className="border-t border-white/10 px-5 sm:px-10 py-16 sm:py-24 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Pronto para fazer parte?</h2>
          <p className="text-gray-400 mb-8">
            Crie sua conta, explore as bases e faça sua pré-inscrição. É rápido e gratuito.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/login?tab=cadastro" className="px-8 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors text-sm">
              Criar conta gratuita
            </Link>
            <Link href="/login" className="px-8 py-3 border border-white/20 hover:bg-white/5 text-white font-semibold rounded-xl transition-colors text-sm">
              Já tenho acesso
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-5 sm:px-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-600">
          <span>© {new Date().getFullYear()} SISGO · JOCUM · Todos os direitos reservados</span>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-gray-400 transition-colors">Entrar</Link>
            <Link href="/bases" className="hover:text-gray-400 transition-colors">Bases</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

const STATS = [
  { value: 'Multi', label: 'base — uma única plataforma' },
  { value: '100%', label: 'focado no contexto missionário' },
  { value: 'Real', label: 'time — dados sempre atualizados' },
  { value: 'JOCUM', label: 'feito por e para JOCUM' },
]

const STEPS = [
  {
    title: 'Crie sua conta',
    desc: 'Cadastre-se com e-mail ou entre com o Google em segundos. Nenhuma informação de pagamento necessária.',
  },
  {
    title: 'Escolha uma base',
    desc: 'Explore as bases missionárias da JOCUM cadastradas no sistema e veja as escolas disponíveis.',
  },
  {
    title: 'Faça sua inscrição',
    desc: 'Candidate-se como aluno de ETED, obreiro voluntário ou associado diretamente pelo sistema.',
  },
]

const MODULES = [
  { icon: '👥', label: 'Pessoas', desc: 'Cadastro completo de toda a comunidade da base' },
  { icon: '⛪', label: 'Obreiros', desc: 'Gestão de staff, voluntários e associados' },
  { icon: '🎓', label: 'Alunos & ETEDs', desc: 'Inscrições, turmas, presenças e certificados' },
  { icon: '🎵', label: 'Ministérios', desc: 'Organização de ministérios e equipes' },
  { icon: '🍽️', label: 'Cozinha', desc: 'Cardápio, estoque, refeições e pagamentos' },
  { icon: '🏠', label: 'Reservas', desc: 'Quartos, instalações e formulário customizado' },
  { icon: '💰', label: 'Financeiro', desc: 'Cobranças, contas a pagar e relatórios' },
  { icon: '📅', label: 'Calendário', desc: 'Eventos e agenda unificada da base' },
]
