import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-gray-50 px-4">
      <section className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-brand-600">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-gray-900">Página não encontrada</h1>
        <p className="mt-2 text-sm text-gray-500">
          O endereço pode ter mudado ou você pode não ter acesso a esta área.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
        >
          Voltar ao início
        </Link>
      </section>
    </main>
  )
}
