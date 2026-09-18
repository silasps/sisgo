import { createAdminClient } from '@/lib/supabase/admin'

// Reaproveita a foto que a pessoa já enviou na inscrição (bucket privado de
// documentos) como avatar inicial da conta recém-criada (bucket público
// `avatars`, o mesmo usado em Configurações da conta) — poupa a pessoa de
// subir a mesma foto de novo. Best-effort: qualquer falha aqui não deve
// impedir a criação da conta em si, por isso retorna null em vez de lançar.
export async function copyApplicationPhotoToAvatar(
  sourceBucket: string,
  sourcePath: string,
  userId: string,
): Promise<string | null> {
  const sb = createAdminClient()

  const { data: blob, error: downloadError } = await sb.storage.from(sourceBucket).download(sourcePath)
  if (downloadError || !blob) return null

  const ext = sourcePath.split('.').pop() ?? 'jpg'
  const destPath = `${userId}-${Date.now()}.${ext}`
  const { error: uploadError } = await sb.storage.from('avatars').upload(destPath, blob, {
    contentType: blob.type || 'image/jpeg',
    upsert: false,
  })
  if (uploadError) return null

  const { data } = sb.storage.from('avatars').getPublicUrl(destPath)
  return data.publicUrl
}
