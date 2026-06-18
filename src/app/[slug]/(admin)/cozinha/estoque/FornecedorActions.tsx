'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { InternationalPhoneField } from '@/components/ui/InternationalPhoneField'
import { Plus } from 'lucide-react'

type Props = {
  createAction: (formData: FormData) => Promise<void>
}

function Field({ label, className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      <input {...props} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
    </label>
  )
}

export function FornecedorActions({ createAction }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group bg-brand-50 border border-brand-200 rounded-xl p-4 text-left cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 w-full sm:w-auto"
      >
        <Plus className="size-5 text-brand-600 mb-2" />
        <p className="text-sm font-semibold text-gray-800 group-hover:text-brand-600 transition-colors">Novo fornecedor</p>
        <p className="text-xs text-gray-500 mt-0.5">Cadastrar empresa ou pessoa</p>
        <p className="text-xs text-brand-400 mt-1.5 font-medium">Abrir &rarr;</p>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Novo fornecedor"
        subtitle="Cadastrar empresa ou pessoa fornecedora"
        hideFooter
      >
        <form action={createAction} className="space-y-3 p-5">
          <Field name="name" label="Nome *" required placeholder="Ex: Distribuidora Silva" />
          <Field name="description" label="Descrição" placeholder="O que fornece?" />
          <Field name="contact_email" label="E-mail" type="email" />
          <div>
            <span className="mb-1 block text-xs font-medium text-gray-600">Telefone</span>
            <InternationalPhoneField countryName="contact_country_code" phoneName="contact_phone" defaultCountryIso="BR" defaultPhone="" />
          </div>
          <Field name="cnpj" label="CNPJ" placeholder="00.000.000/0000-00" />
          <Field name="address" label="Endereço" placeholder="Rua, cidade..." />
          <Field name="notes" label="Notas" placeholder="Observações..." />
          <div className="flex gap-2 pt-2">
            <button type="submit" className="flex-1 rounded-lg bg-brand-500 hover:bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors">
              Cadastrar fornecedor
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
