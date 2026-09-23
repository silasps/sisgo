// Senha padrão previsível pro primeiro acesso: primeiro nome (minúsculo,
// sem acento) + "123" — ex. "Silas Pereira" -> "silas123". Não precisa ser
// forte porque o primeiro login força a troca (ver `must_change_password`).
export function generateDefaultPassword(fullName: string): string {
  const firstName = fullName.trim().split(/\s+/)[0] ?? ''
  const normalized = firstName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
  return `${normalized || 'pessoa'}123`
}
