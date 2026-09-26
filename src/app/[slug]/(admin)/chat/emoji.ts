// Sem lib nova (emoji-mart etc. seria dependência a mais só pra isso) — um
// grid curado fixo cobre o que interessa nesse contexto institucional.
export const EMOJI_PICKER = [
  '👍', '🙏', '❤️', '😂', '😮', '😢', '🎉', '🔥',
  '✅', '❌', '❓', '❗', '👏', '🙌', '💪', '😅',
  '😊', '😍', '🥳', '😴', '🤔', '👀', '📌', '⏰',
  '📅', '📖', '✝️', '🕊️', '⭐', '💡', '🚀', '🙏🏽',
]

// Reações rápidas ("joinha" etc.) numa mensagem já enviada — conjunto
// menor e fixo, valida também no servidor (toggleReaction em actions.ts).
export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '🙏', '✅']

// Mensagem que é só 1-3 emoji vira "figurinha" (grande, sozinha na bolha) —
// mesmo truque que Telegram/WhatsApp/Slack já fazem, sem precisar de
// imagem/asset/upload nenhum: o conteúdo continua sendo só texto.
const STICKER_RE = /^\p{Extended_Pictographic}️?(?:\s*\p{Extended_Pictographic}️?){0,2}$/u

export function isStickerContent(content: string): boolean {
  return STICKER_RE.test(content.trim())
}
