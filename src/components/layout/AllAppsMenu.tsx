'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutGrid, Search, X } from 'lucide-react'
import { useAllApps, type NavItem } from './all-apps-context'
import { useAccount } from './account-context'
import { ICON_MAP } from './Sidebar'
import { globalSearch, type GlobalSearchResult } from '@/lib/search/global-search'

function normalize(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

// Rótulo de menu é uma lista curta e curada — vale a pena ser tolerante:
// sem acento ("ministerio") e digitação incompleta/com letra pulada
// ("lavad" → "Lavanderia") ainda acham o atalho, igual busca de comando
// de editor (aceita fora de ordem contígua, mas sempre na mesma ordem).
function matchesLabel(label: string, query: string) {
  const nLabel = normalize(label)
  const nQuery = normalize(query)
  if (nLabel.includes(nQuery)) return true
  let i = 0
  for (const ch of nLabel) {
    if (ch === nQuery[i]) i++
    if (i === nQuery.length) return true
  }
  return false
}

// Termo comum que os usuários digitam mas que não aparece no rótulo do menu
// (ex.: "lavadoura"/"lavadora" pra achar "Lavanderia") — mesma lógica pra
// toda área. Se um termo comum não achar o menu certo, é só pedir pra
// adicionar aqui.
const ICON_KEYWORDS: Record<string, string[]> = {
  dashboard: ['home', 'principal'],
  calendario: ['eventos'],
  pendentes: ['pendencia', 'pendencias'],
  comunicacao: ['mural', 'aviso', 'avisos', 'comunicado'],
  pessoas: ['cadastro', 'diretorio', 'membros'],
  presenca: ['chamada', 'frequencia', 'ausencia', 'ausencias', 'falta', 'faltas'],
  obreiros: ['equipe', 'staff', 'funcionarios'],
  escolas: ['cursos', 'turmas'],
  inscricoes: ['candidatura', 'candidaturas', 'candidatos', 'matricula', 'matriculas'],
  ministerios: ['equipes', 'times'],
  reservas: ['reservar', 'agendar'],
  hospedagem: ['quartos', 'camas', 'dormitorio', 'alojamento'],
  quartos: ['camas', 'dormitorio', 'alojamento'],
  lavanderia: ['lavadora', 'lavadoura', 'maquina de lavar', 'roupa'],
  'minha-lavanderia': ['lavadora', 'lavadoura', 'maquina de lavar', 'roupa'],
  refeicoes: ['comida', 'almoco', 'jantar', 'cardapio', 'comer'],
  cozinha: ['comida', 'refeicao'],
  estoque: ['insumos', 'ingredientes'],
  'estoque-manutencao': ['pecas', 'materiais', 'ferramentas'],
  receitas: ['cardapio', 'pratos', 'cozinhar'],
  manutencao: ['manutencao', 'conserto', 'reparo', 'problema'],
  financeiro: ['dinheiro', 'orcamento'],
  caixa: ['dinheiro'],
  contas: ['pagamentos', 'faturas', 'financeiro'],
  carteirinha: ['identidade', 'id', 'cracha', 'documento'],
  configuracoes: ['ajustes', 'preferencias'],
}

function matchesItem(item: { label: string; icon: string }, query: string) {
  if (matchesLabel(item.label, query)) return true
  const keywords = ICON_KEYWORDS[item.icon]
  return keywords ? keywords.some(k => matchesLabel(k, query)) : false
}

/** Botão de gatilho — usado no Header. O painel em si mora em AllAppsPanel,
 * montado uma vez pelo AppShell, pra funcionar mesmo em páginas sem Header
 * (ex.: formulários públicos sem layout próprio). */
export function AllAppsMenu() {
  const { items, openAllApps } = useAllApps()

  if (items.length === 0) return null

  return (
    <button
      onClick={openAllApps}
      className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-white/10 hover:text-white transition-colors shrink-0"
      aria-label="Ver tudo"
    >
      <LayoutGrid size={18} />
    </button>
  )
}

/** O painel de fato (busca + grid). Sempre montado pelo AppShell — reage ao
 * estado compartilhado independente de quem disparou a abertura (o ícone do
 * Header ou o botão "Mais" do BottomNav). */
export function AllAppsPanel() {
  const { items, searchItems, open, closeAllApps } = useAllApps()
  const account = useAccount()
  const [query, setQuery] = useState('')
  const [dataResults, setDataResults] = useState<GlobalSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const pathname = usePathname()
  const requestId = useRef(0)

  useEffect(() => { if (open) closeAllApps() }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!open) { setQuery(''); setDataResults([]) } }, [open])

  const slug = account?.orgSlug
  useEffect(() => {
    const q = query.trim()
    if (!slug || q.length < 2) { setDataResults([]); setSearching(false); return }
    const id = ++requestId.current
    setSearching(true)
    const timer = setTimeout(() => {
      globalSearch(slug, q).then(results => {
        if (requestId.current === id) { setDataResults(results); setSearching(false) }
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [query, slug])

  if (!open || items.length === 0) return null

  // Grade parada (sem digitar nada) usa só o complemento (`items`, não repete
  // atalho já fixo na sidebar); a busca ativa usa `searchItems` — o conjunto
  // completo — porque a caixa promete achar "tudo", incluindo o que já está
  // na sidebar (ex.: "Lavanderia" já fixo em modo Pessoal).
  const searchFlatItems = searchItems.filter((i): i is Exclude<NavItem, { divider: true }> => !('divider' in i))
  const q = query.trim()
  const filtered = q ? searchFlatItems.filter(i => matchesItem(i, q)) : null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-white flex flex-col md:bg-black/30 md:items-start md:justify-center md:pt-20"
      onClick={e => { if (e.target === e.currentTarget) closeAllApps() }}
    >
      <div className="flex flex-col w-full h-full md:h-auto md:max-h-[80vh] md:max-w-2xl md:mx-auto md:rounded-2xl md:shadow-xl bg-white overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 shrink-0">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar em tudo que o sisgo oferece..."
            className="flex-1 min-w-0 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
          />
          <button
            onClick={closeAllApps}
            className="p-1.5 -mr-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {dataResults.length > 0 && <ResultsList results={dataResults} />}
          {searching && dataResults.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-1">Buscando…</p>
          )}
          {filtered ? (
            filtered.length > 0 ? (
              <AppGrid items={filtered} />
            ) : dataResults.length === 0 && !searching ? (
              <p className="text-sm text-gray-400 text-center py-10">Nada encontrado para &ldquo;{query}&rdquo;.</p>
            ) : null
          ) : (
            <SectionedGrid items={items} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function ResultsList({ results }: { results: GlobalSearchResult[] }) {
  const { closeAllApps } = useAllApps()

  const groups = useMemo(() => {
    const out: Array<{ label: string; items: GlobalSearchResult[] }> = []
    for (const item of results) {
      let group = out.find(g => g.label === item.section)
      if (!group) { group = { label: item.section, items: [] }; out.push(group) }
      group.items.push(item)
    }
    return out
  }, [results])

  return (
    <div className="space-y-4">
      {groups.map(group => (
        <div key={group.label}>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5 px-1">{group.label}</h3>
          <div className="space-y-0.5">
            {group.items.map(item => {
              const Icon = ICON_MAP[item.icon]
              return (
                <Link
                  key={`${item.section}-${item.id}`}
                  href={item.href}
                  onClick={closeAllApps}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-brand-50/40 transition-colors"
                >
                  {Icon && (
                    <span className="w-8 h-8 shrink-0 rounded-full bg-gray-50 flex items-center justify-center text-gray-600">
                      <Icon size={15} aria-hidden />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-800 truncate">{item.title}</span>
                    {item.subtitle && <span className="block text-xs text-gray-400 truncate">{item.subtitle}</span>}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function SectionedGrid({ items }: { items: NavItem[] }) {
  const groups = useMemo(() => {
    const out: Array<{ label: string; items: Exclude<NavItem, { divider: true }>[] }> = []
    let current: { label: string; items: Exclude<NavItem, { divider: true }>[] } | null = null
    for (const item of items) {
      if ('divider' in item) {
        current = { label: item.label, items: [] }
        out.push(current)
      } else {
        if (!current) { current = { label: '', items: [] }; out.push(current) }
        current.items.push(item)
      }
    }
    return out
  }, [items])

  return (
    <div className="space-y-6">
      {groups.map((group, idx) => (
        <div key={`${group.label}-${idx}`}>
          {group.label && (
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2 px-1">{group.label}</h3>
          )}
          <AppGrid items={group.items} />
        </div>
      ))}
    </div>
  )
}

function AppGrid({ items }: { items: Exclude<NavItem, { divider: true }>[] }) {
  const { closeAllApps } = useAllApps()

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
      {items.map(item => {
        const Icon = ICON_MAP[item.icon]
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={closeAllApps}
            className="relative flex flex-col items-center justify-center gap-2 rounded-xl border border-gray-100 bg-white p-3 text-center hover:border-brand-200 hover:bg-brand-50/40 transition-colors"
          >
            {item.alert && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
            {Icon && (
              <span className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center text-gray-600">
                <Icon size={17} aria-hidden />
              </span>
            )}
            <span className="text-xs font-medium text-gray-700 leading-tight line-clamp-2">{item.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
