import Link from 'next/link'

export function FinalCta() {
  return (
    <section className="border-t border-white/[0.06] px-5 sm:px-8 py-20 sm:py-28">
      <div className="max-w-3xl mx-auto relative">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <div className="w-[500px] h-56 rounded-full bg-brand-500/10 blur-3xl" />
        </div>
        <div className="relative glass-card rounded-3xl p-10 sm:p-16 text-center border-brand-500/20">
          <h2 className="text-3xl sm:text-5xl font-bold mb-5">
            Pronto para modernizar<br className="hidden sm:block" /> sua organização?
          </h2>
          <p className="text-zinc-400 mb-10 text-sm sm:text-base max-w-md mx-auto">
            Crie sua conta gratuitamente e comece a organizar sua missão hoje.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/cadastro"
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
  )
}
