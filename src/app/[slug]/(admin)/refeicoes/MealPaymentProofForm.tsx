'use client'

type MealPaymentProofFormProps = {
  action: (formData: FormData) => void | Promise<void>
  purchaseGroupId: string
  highlighted: boolean
  proofName?: string | null
}

export function MealPaymentProofForm({ action, purchaseGroupId, highlighted, proofName }: MealPaymentProofFormProps) {
  return (
    <form
      action={action}
      onSubmit={event => {
        const ok = window.confirm('Tem certeza que deseja enviar este arquivo como comprovante de pagamento?')
        if (!ok) event.preventDefault()
      }}
      className={highlighted
        ? 'mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3'
        : 'mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3'}
    >
      <input type="hidden" name="purchase_group_id" value={purchaseGroupId} />
      <p className="text-xs font-semibold text-gray-700">
        {highlighted ? 'Colocar comprovante aqui' : 'Enviar comprovante de pagamento'}
      </p>
      <p className="mt-1 text-xs text-gray-500">Aceita imagem ou PDF. Imagens serão convertidas automaticamente para WEBP.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          name="payment_proof"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          required
          className="max-w-full text-xs text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold file:text-gray-700"
        />
        <button className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800">
          Enviar
        </button>
      </div>
      {proofName && (
        <p className="mt-2 text-xs text-green-700">
          Comprovante enviado: {proofName}
        </p>
      )}
    </form>
  )
}
