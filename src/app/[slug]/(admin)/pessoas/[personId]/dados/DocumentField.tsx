'use client'

import { useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FileText, Upload, Loader2 } from 'lucide-react'

type Props = {
  label: string
  fileName: string
  url: string | null
  section: string
  fieldKey: string
  replaceAction: (formData: FormData) => Promise<{ error: string } | { ok: true }>
}

export function DocumentField({ label, fileName, url, section, fieldKey, replaceAction }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('section', section)
    fd.append('key', fieldKey)
    fd.append('file', file)
    startTransition(async () => {
      const res = await replaceAction(fd)
      if ('error' in res) { toast.error(res.error); return }
      toast.success('Documento substituído.')
      router.refresh()
    })
  }

  return (
    <div className="text-sm">
      <p className="text-xs text-gray-400">{label}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-brand-600 hover:underline">
            <FileText size={13} /> {fileName}
          </a>
        ) : (
          <span className="text-gray-400">{fileName}</span>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isPending}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-600 transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          Substituir
        </button>
        <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleFileChange} />
      </div>
    </div>
  )
}
