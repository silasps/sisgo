'use client'

export function DeleteTurmaButton({
  classId,
  className: turmaName,
  disabled,
  action,
}: {
  classId: string
  className: string
  disabled: boolean
  action: (formData: FormData) => Promise<void>
}) {
  return (
    <form
      action={action}
      onSubmit={e => {
        if (!confirm(`Excluir a turma "${turmaName}"? Esta ação não pode ser desfeita.`))
          e.preventDefault()
      }}
    >
      <input type="hidden" name="class_id" value={classId} />
      <button
        type="submit"
        disabled={disabled}
        title={disabled ? 'Turma com alunos matriculados — não pode ser excluída' : 'Excluir turma'}
        className="p-1.5 rounded-lg transition-colors text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-300"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>
    </form>
  )
}
