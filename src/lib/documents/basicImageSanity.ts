import sharp from 'sharp'

export type SanityResult = { valid: boolean; reason?: string }

// Checagem 100% local (sem custo, sem API externa) via sharp — NÃO entende
// o conteúdo da imagem (não distingue um RG de uma foto qualquer), só
// descarta os casos mais óbvios: arquivo corrompido, imagem minúscula
// demais (ícone, sticker, print recortado) ou proporção absurda pra um
// documento/foto de rosto. Roda sempre, independente de
// classifyDocument (validação por IA) estar ligada — é a primeira
// barreira, sem custo, enquanto a segunda estiver desligada.
export async function basicImageSanity(fileBuffer: Buffer, mimeType: string): Promise<SanityResult> {
  if (mimeType === 'application/pdf') return { valid: true }

  let meta: sharp.Metadata
  try {
    meta = await sharp(fileBuffer).metadata()
  } catch {
    return { valid: false, reason: 'Não foi possível ler essa imagem. Tente outro arquivo.' }
  }

  const { width, height } = meta
  if (!width || !height) {
    return { valid: false, reason: 'Não foi possível ler essa imagem. Tente outro arquivo.' }
  }
  if (width < 300 || height < 300) {
    return { valid: false, reason: 'Essa imagem é muito pequena — envie uma foto em boa resolução do documento pedido.' }
  }
  const ratio = Math.max(width, height) / Math.min(width, height)
  if (ratio > 4) {
    return { valid: false, reason: 'Essa imagem não parece um documento (proporção incomum). Envie uma foto do documento inteiro.' }
  }

  return { valid: true }
}
