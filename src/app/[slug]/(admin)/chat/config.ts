// Janela pra editar/excluir a própria mensagem — mesmo espírito do WhatsApp
// (dá pra corrigir um erro de digitação ou desmandar algo na hora, mas não
// vira um jeito de reescrever histórico). Compartilhado entre a action
// (que barra de verdade) e a UI (que já esconde os ícones antes de tentar).
export const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000

// No Geral não sai push a cada mensagem (seriam dezenas de notificações);
// só quando alguém marca "@importante" — aí vai pra toda a equipe, inclusive
// quem silenciou o grupo (igual menção no WhatsApp). Palavra inteira, sem
// diferenciar maiúscula: "@Importante" vale, "@importantes"/"x@importante.com" não.
export const IMPORTANT_TAG = '@importante'
export const IMPORTANT_TAG_RE = /(^|[^\p{L}\p{N}_@.])@importante(?![\p{L}\p{N}_])/iu

export function hasImportantTag(content: string): boolean {
  return IMPORTANT_TAG_RE.test(content)
}
