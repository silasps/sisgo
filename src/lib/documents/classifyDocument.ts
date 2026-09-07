export type DocumentKind = 'foto' | 'rg_frente' | 'rg_verso' | 'cpf' | 'passaporte' | 'comprovante_pagamento' | 'certidao_casamento'

const KIND_DESCRIPTIONS: Record<DocumentKind, string> = {
  foto: 'uma foto de rosto/retrato pessoal (tipo 3x4), mostrando o rosto de uma pessoa',
  rg_frente: 'a frente de um RG (Carteira de Identidade) brasileiro',
  rg_verso: 'o verso de um RG (Carteira de Identidade) brasileiro',
  cpf: 'um CPF (Cadastro de Pessoa Física) brasileiro — cartão físico ou documento que mostre o número do CPF',
  passaporte: 'uma página de passaporte com foto e dados pessoais',
  comprovante_pagamento: 'um comprovante de pagamento (recibo bancário, print de PIX, comprovante de transferência)',
  certidao_casamento: 'uma certidão de casamento',
}

export type ClassifyResult = { valid: boolean; reason?: string }

// Validação por IA (Claude com visão) do que a pessoa anexou — desligada por
// padrão pra não gerar custo nenhum: só roda de verdade se
// DOCUMENT_AI_VALIDATION="1" E ANTHROPIC_API_KEY estiverem configurados no
// ambiente. Sem isso, aprova tudo sem checar (mesmo comportamento de antes
// desse recurso existir) — a estrutura fica pronta pra ligar quando quiser,
// sem precisar mexer em código, só nas env vars.
//
// Não valida PDF (a API de imagem não lida com PDF do mesmo jeito) — só
// imagem. Usa Haiku por ser suficiente pra essa classificação simples e
// bem mais barato que os modelos maiores.
export async function classifyDocument(
  fileBuffer: Buffer,
  mimeType: string,
  kind: DocumentKind,
): Promise<ClassifyResult> {
  if (process.env.DOCUMENT_AI_VALIDATION !== '1' || !process.env.ANTHROPIC_API_KEY) {
    return { valid: true }
  }
  if (mimeType === 'application/pdf') return { valid: true }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return { valid: true }

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic()
    const base64 = fileBuffer.toString('base64')

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp', data: base64 } },
          {
            type: 'text',
            text: `Essa imagem deveria ser ${KIND_DESCRIPTIONS[kind]}. Responda só com um JSON, sem nada antes ou depois: {"valid": true ou false, "reason": "motivo curto em português se valid=false"}. Seja bem tolerante — aceite fotos tiradas de celular, um pouco tortas, com iluminação ruim ou reflexo, desde que dê pra reconhecer o tipo de documento pedido. Só marque valid=false se a imagem claramente não tem nada a ver com o que foi pedido (ex.: pediram RG e vieram foto de paisagem, comida, um objeto qualquer, ou outra pessoa/documento completamente diferente).`,
          },
        ],
      }],
    })

    const text = response.content.find(b => b.type === 'text')?.text ?? ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return { valid: true }
    const parsed = JSON.parse(match[0]) as { valid?: boolean; reason?: string }
    return { valid: parsed.valid !== false, reason: parsed.reason }
  } catch {
    // Qualquer erro na chamada (rede, parsing, etc.) não deve travar o
    // envio do candidato — melhor deixar passar do que bloquear por causa
    // de uma falha na validação em si.
    return { valid: true }
  }
}
