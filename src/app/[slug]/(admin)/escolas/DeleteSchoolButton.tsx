'use client'

import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton'

export function DeleteSchoolButton({
  schoolId,
  schoolName,
  disabled,
  action,
}: {
  schoolId: string
  schoolName: string
  disabled: boolean
  action: (formData: FormData) => Promise<void>
}) {
  if (disabled) {
    return (
      <button
        type="button"
        disabled
        title="Escola com turmas ou inscrições — não pode ser excluída"
        className="p-1.5 rounded-lg text-gray-300 opacity-30 cursor-not-allowed"
      >
        <TrashIcon />
      </button>
    )
  }

  return (
    <form action={action}>
      <input type="hidden" name="school_id" value={schoolId} />
      <ConfirmSubmitButton
        confirmMessage={`Excluir a escola "${schoolName}"? Esta ação não pode ser desfeita.`}
        title="Excluir escola"
        className="p-1.5 rounded-lg transition-colors text-gray-300 hover:text-red-500 hover:bg-red-50"
      >
        <TrashIcon />
      </ConfirmSubmitButton>
    </form>
  )
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  )
}
