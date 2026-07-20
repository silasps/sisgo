'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Camera, Loader2, KeyRound, Link2, Unlink, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AvatarCropperModal } from '@/components/ui/AvatarCropperModal'

type Identity = { id: string; provider: string; email: string | null }

function avatarPathFromUrl(url: string): string | null {
  const marker = '/object/public/avatars/'
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(url.slice(idx + marker.length))
}

export function AccountSettingsForm({
  slug,
  userId,
  email,
  name,
  avatarUrl,
  identities,
}: {
  slug: string
  userId: string
  email: string
  name: string
  avatarUrl: string | null
  identities: Identity[]
}) {
  return (
    <>
      <ProfileSection userId={userId} email={email} name={name} avatarUrl={avatarUrl} />
      <PasswordSection email={email} hasPassword={identities.some(i => i.provider === 'email')} />
      <ConnectedAccountsSection slug={slug} identities={identities} />
    </>
  )
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      {description && <p className="text-sm text-gray-500 mt-1 mb-4">{description}</p>}
      <div className={description ? '' : 'mt-4'}>{children}</div>
    </div>
  )
}

function ProfileSection({
  userId, email, name, avatarUrl,
}: {
  userId: string
  email: string
  name: string
  avatarUrl: string | null
}) {
  const router = useRouter()
  const [preview, setPreview] = useState<string | null>(avatarUrl)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [fullName, setFullName] = useState(name)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) setPendingFile(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleCropConfirm(webpBlob: Blob) {
    setUploading(true)
    try {
      const previousPath = preview ? avatarPathFromUrl(preview) : null
      const path = `${userId}/${Date.now()}.webp`
      const supabase = createClient()

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, webpBlob, { contentType: 'image/webp', upsert: false })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: data.publicUrl } })
      if (updateError) throw updateError

      if (previousPath) {
        const { error: removeError } = await supabase.storage.from('avatars').remove([previousPath])
        if (removeError) console.error('Falha ao remover avatar antigo do storage:', removeError)
      }

      setPreview(data.publicUrl)
      router.refresh()
      toast.success('Foto de perfil atualizada.')
      setPendingFile(null)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao enviar a foto. Tente novamente.')
    } finally {
      setUploading(false)
    }
  }

  async function handleRemoveAvatar() {
    setRemoving(true)
    const supabase = createClient()
    const path = preview ? avatarPathFromUrl(preview) : null

    const { error } = await supabase.auth.updateUser({ data: { avatar_url: null } })
    if (error) { setRemoving(false); toast.error('Erro ao remover a foto.'); return }

    if (path) {
      const { error: removeError } = await supabase.storage.from('avatars').remove([path])
      if (removeError) console.error('Falha ao remover avatar do storage:', removeError)
    }

    setRemoving(false)
    setPreview(null)
    router.refresh()
    toast.success('Foto removida.')
  }

  function handleSaveName() {
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ data: { full_name: fullName.trim() } })
      if (error) { toast.error('Erro ao salvar o nome.'); return }
      router.refresh()
      toast.success('Nome atualizado.')
    })
  }

  return (
    <Section title="Perfil">
      <div className="flex items-center gap-4 mb-5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="relative w-20 h-20 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 text-xl font-bold uppercase shrink-0 overflow-hidden group"
          aria-label="Trocar foto de perfil"
        >
          {preview ? <img src={preview} alt="" className="w-full h-full object-cover" /> : (name || email).charAt(0)}
          <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            {uploading ? <Loader2 size={18} className="text-white animate-spin" /> : <Camera size={18} className="text-white" />}
          </span>
        </button>
        <div>
          <p className="text-sm font-medium text-gray-900">Foto de perfil</p>
          <p className="text-xs text-gray-400 mt-0.5 mb-2">JPG, PNG ou WebP. Você poderá ajustar o enquadramento antes de salvar.</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
            >
              Alterar foto
            </button>
            {preview && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                disabled={uploading || removing}
                className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-red-600 disabled:opacity-50"
              >
                {removing ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                Remover
              </button>
            )}
          </div>
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />
      </div>

      {pendingFile && (
        <AvatarCropperModal
          file={pendingFile}
          saving={uploading}
          onCancel={() => setPendingFile(null)}
          onConfirm={handleCropConfirm}
        />
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Nome</label>
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            placeholder="Seu nome"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">E-mail</label>
          <input
            type="email"
            value={email}
            disabled
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
          />
        </div>
        <button
          type="button"
          onClick={handleSaveName}
          disabled={isPending || fullName.trim() === name}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40"
        >
          {isPending ? 'Salvando…' : 'Salvar nome'}
        </button>
      </div>
    </Section>
  )
}

function PasswordSection({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (next.length < 6) { toast.error('A nova senha precisa ter pelo menos 6 caracteres.'); return }
    if (next !== confirm) { toast.error('A confirmação não confere com a nova senha.'); return }

    startTransition(async () => {
      const supabase = createClient()

      if (hasPassword) {
        const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password: current })
        if (reauthError) { toast.error('Senha atual incorreta.'); return }
      }

      const { error } = await supabase.auth.updateUser({ password: next })
      if (error) { toast.error('Erro ao atualizar a senha.'); return }

      setCurrent(''); setNext(''); setConfirm('')
      toast.success('Senha atualizada.')
    })
  }

  return (
    <Section title="Senha" description={hasPassword ? 'Altere a senha usada para entrar com e-mail e senha.' : 'Defina uma senha para poder entrar também com e-mail e senha, além do Google.'}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {hasPassword && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Senha atual</label>
            <input
              type="password"
              value={current}
              onChange={e => setCurrent(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Nova senha</label>
          <input
            type="password"
            value={next}
            onChange={e => setNext(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Confirmar nova senha</label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
          {isPending ? 'Salvando…' : (hasPassword ? 'Atualizar senha' : 'Definir senha')}
        </button>
      </form>
    </Section>
  )
}

function ConnectedAccountsSection({ slug, identities }: { slug: string; identities: Identity[] }) {
  const router = useRouter()
  const [busyProvider, setBusyProvider] = useState<string | null>(null)
  const googleIdentity = identities.find(i => i.provider === 'google')
  const canUnlink = identities.length > 1

  async function handleLink() {
    setBusyProvider('google')
    const supabase = createClient()
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/${slug}/conta` },
    })
    if (error) {
      toast.error(
        error.message.toLowerCase().includes('manual linking')
          ? 'Vinculação manual de contas está desativada nas configurações do Supabase.'
          : 'Não foi possível conectar com o Google.'
      )
      setBusyProvider(null)
    }
    // em caso de sucesso o navegador é redirecionado para o Google
  }

  async function handleUnlink() {
    if (!googleIdentity) return
    setBusyProvider('google')
    const supabase = createClient()
    const { data: identitiesData } = await supabase.auth.getUserIdentities()
    const identity = identitiesData?.identities.find(i => i.provider === 'google')
    if (!identity) { setBusyProvider(null); return }

    const { error } = await supabase.auth.unlinkIdentity(identity)
    setBusyProvider(null)
    if (error) { toast.error('Não foi possível desconectar a conta Google.'); return }
    router.refresh()
    toast.success('Conta Google desconectada.')
  }

  return (
    <Section title="Contas conectadas" description="Entre no sisgo também com sua conta Google, sem precisar de senha.">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">Google</p>
            <p className="text-xs text-gray-400 truncate">{googleIdentity?.email ?? 'Não conectado'}</p>
          </div>
        </div>

        {googleIdentity ? (
          <button
            type="button"
            onClick={handleUnlink}
            disabled={busyProvider === 'google' || !canUnlink}
            title={!canUnlink ? 'Defina uma senha antes de desconectar o Google, para não perder o acesso.' : undefined}
            className="flex items-center gap-1.5 shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busyProvider === 'google' ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />}
            Desconectar
          </button>
        ) : (
          <button
            type="button"
            onClick={handleLink}
            disabled={busyProvider === 'google'}
            className="flex items-center gap-1.5 shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            {busyProvider === 'google' ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
            Conectar
          </button>
        )}
      </div>
    </Section>
  )
}
