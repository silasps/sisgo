'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import Link from 'next/link'

function slugify(str: string) {
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

export default function NovaBasePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const fd = new FormData(e.currentTarget)
    const supabase = createClient()

    const { error } = await supabase.from('organizations').insert({
      name: fd.get('name') as string,
      slug: slugify(fd.get('name') as string),
      city: (fd.get('city') as string) || null,
      state: (fd.get('state') as string) || null,
      phone: (fd.get('phone') as string) || null,
      email: (fd.get('email') as string) || null,
      website: (fd.get('website') as string) || null,
    })

    if (error) {
      setError(error.message.includes('slug') ? 'Já existe uma base com esse nome.' : error.message)
      setLoading(false)
      return
    }

    router.push('/superadmin/bases')
    router.refresh()
  }

  return (
    <>
      <Header
        title="Nova Base"
        actions={
          <Link href="/superadmin/bases" className="text-sm text-gray-500 hover:text-gray-700">
            ← Cancelar
          </Link>
        }
      />
      <main className="p-6 max-w-xl">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">

          <div className="p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Dados da base</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome *</label>
              <input
                name="name"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Ex: JOCUM São Paulo"
              />
              {name && (
                <p className="text-xs text-gray-400 mt-1">Slug: <span className="font-mono">{slugify(name)}</span></p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Cidade" name="city" placeholder="Curitiba" />
              <Field label="Estado" name="state" placeholder="PR" maxLength={2} />
            </div>
          </div>

          <div className="p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Contato</h2>
            <Field label="E-mail" name="email" type="email" placeholder="base@exemplo.com" />
            <Field label="Telefone" name="phone" type="tel" placeholder="(41) 99999-9999" />
            <Field label="Website" name="website" placeholder="https://..." />
          </div>

          {error && (
            <div className="px-6 py-4">
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            </div>
          )}

          <div className="px-6 py-4 flex justify-end gap-3">
            <Link
              href="/superadmin/bases"
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-brand-500 text-white rounded-lg text-sm font-semibold hover:bg-brand-600 disabled:opacity-60 transition-colors"
            >
              {loading ? 'Salvando...' : 'Criar base'}
            </button>
          </div>
        </form>
      </main>
    </>
  )
}

function Field({ label, name, type = 'text', placeholder, maxLength }: {
  label: string; name: string; type?: string; placeholder?: string; maxLength?: number
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
    </div>
  )
}
