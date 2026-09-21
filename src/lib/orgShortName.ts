// Nome curto de exibição pra frases genéricas que citam a organização (ex.:
// "Escolas da {nome}", "Como conheceu a {nome}"). Usa a primeira palavra do
// nome cadastrado — toda base JOCUM começa o nome com "JOCUM" (ex.: "JOCUM
// Almirante Tamandaré"), então isso já recupera o nome do movimento sem
// precisar checar org_type; pra outras organizações, vira a primeira
// palavra do nome delas mesmas. Só cai no genérico se não houver nome algum.
export function orgShortName(name: string | null | undefined, fallback = 'organização'): string {
  const first = name?.trim().split(/\s+/)[0]
  return first || fallback
}
