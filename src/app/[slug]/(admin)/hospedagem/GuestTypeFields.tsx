'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, UserPlus } from 'lucide-react'

// Campos de "quem vai ficar" de todo modal de alocar hóspede (quarto inteiro
// e cama, no mapa, na Agenda e no detalhe do quarto): o Tipo vem primeiro e
// decide o resto — Obreiro busca entre os obreiros cadastrados nesta base (e
// avisa se a pessoa já está alocada em outro lugar, sem bloquear); Escola
// pede a escola; os demais, nome livre.

export type ObreiroOption = {
  personId: string
  name: string
  // Alocações ativas da pessoa, já como endereço:
  // "Bloco · Andar · Quarto · Cama (dd/mm/aaaa → dd/mm/aaaa)"
  allocatedAt: string[]
}

type GuestKind = 'visitante' | 'convidado' | 'obreiro' | 'escola'

const KIND_OPTIONS: { value: GuestKind; label: string }[] = [
  { value: 'visitante', label: 'Visitante' },
  { value: 'convidado', label: 'Convidado/Professor' },
  { value: 'obreiro', label: 'Obreiro' },
  { value: 'escola', label: 'Escola' },
]

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

// Busca "inteligente": ignora acento e maiúscula, e cada pedaço digitado
// pode ser o começo de qualquer palavra do nome ("gio men" acha "Giovanna
// Meneguini"). Quem começa com o texto digitado vem primeiro.
function searchObreiros(list: ObreiroOption[], query: string) {
  const q = normalize(query)
  if (!q) return []
  const tokens = q.split(' ')
  const hits: { o: ObreiroOption; rank: number }[] = []
  for (const o of list) {
    const n = normalize(o.name)
    const words = n.split(' ')
    const rank = n.startsWith(q) ? 0
      : tokens.every(t => words.some(w => w.startsWith(t))) ? 1
      : n.includes(q) ? 2
      : -1
    if (rank >= 0) hits.push({ o, rank })
  }
  return hits
    .sort((a, b) => a.rank - b.rank || a.o.name.localeCompare(b.o.name, 'pt-BR'))
    .slice(0, 8)
    .map(h => h.o)
}

export function GuestTypeFields({ destination, schools, obreiros, where = 'neste quarto', group = true }: {
  destination: string
  schools: { id: string; name: string }[]
  obreiros: ObreiroOption[]
  where?: string // "neste quarto" | "nesta cama"
  group?: boolean // quarto inteiro aceita nome de grupo/turma; cama é uma pessoa só
}) {
  const initialKind: GuestKind =
    destination === 'obreiro' ? 'obreiro'
    : destination === 'aluno' && schools.length > 0 ? 'escola'
    : 'visitante'
  const [kind, setKind] = useState<GuestKind>(initialKind)
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<ObreiroOption | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [active, setActive] = useState(0)
  const nameRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => (kind === 'obreiro' ? searchObreiros(obreiros, query) : []), [kind, obreiros, query])

  // Obreiro tem que sair da lista (é o que liga a alocação à pessoa) — o
  // navegador segura o envio com essa mensagem enquanto ninguém for escolhido.
  useEffect(() => {
    nameRef.current?.setCustomValidity(kind === 'obreiro' && !picked ? 'Escolha um obreiro da lista.' : '')
  }, [kind, picked])

  function pick(o: ObreiroOption) {
    setPicked(o)
    setQuery(o.name)
    setListOpen(false)
  }

  const kindOptions = KIND_OPTIONS.filter(k => k.value !== 'escola' || schools.length > 0)
  const header = kind === 'escola' ? 'escola' : kind === 'obreiro' ? 'obreiro' : kind === 'convidado' ? 'convidado' : 'visitante'

  return (
    <>
      <div className="flex items-center gap-2 text-green-600">
        <UserPlus size={20} />
        <p className="text-sm font-semibold">Alocar {header} {where}</p>
      </div>

      <input type="hidden" name="guest_type" value={kind === 'escola' ? 'aluno' : kind} />
      <input type="hidden" name="person_id" value={kind === 'obreiro' ? (picked?.personId ?? '') : ''} />
      {kind !== 'escola' && <input type="hidden" name="school_id" value="" />}

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
        <select
          value={kind}
          onChange={e => { setKind(e.target.value as GuestKind); setPicked(null); setQuery('') }}
          className={inputCls}
        >
          {kindOptions.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
      </div>

      {kind === 'escola' ? (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Escola *</label>
            <select name="school_id" required className={inputCls}>
              <option value="">Selecione a escola...</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{group ? 'Nome/Identificação *' : 'Nome do aluno *'}</label>
            <input name="guest_name" required placeholder={group ? 'Ex: Turma ETED 2026.1' : 'Nome completo'} className={inputCls} />
          </div>
        </>
      ) : kind === 'obreiro' ? (
        <div className="relative">
          <label className="block text-xs font-medium text-gray-600 mb-1">Nome do obreiro *</label>
          <input
            ref={nameRef}
            name="guest_name"
            required
            autoComplete="off"
            value={query}
            placeholder="Digite pra buscar entre os obreiros da base"
            onChange={e => { setQuery(e.target.value); setPicked(null); setListOpen(true); setActive(0) }}
            onFocus={() => setListOpen(true)}
            onBlur={() => setTimeout(() => setListOpen(false), 150)}
            onKeyDown={e => {
              if (!listOpen || picked || results.length === 0) return
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, results.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
              else if (e.key === 'Enter') { e.preventDefault(); pick(results[active] ?? results[0]) }
              else if (e.key === 'Escape') setListOpen(false)
            }}
            className={inputCls}
          />
          {listOpen && query.trim() && !picked && (
            <ul className="absolute z-20 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {results.length === 0 ? (
                <li className="px-3 py-2.5 text-sm text-gray-400">Nenhum obreiro desta base com esse nome.</li>
              ) : results.map((o, i) => (
                <li key={o.personId}>
                  <button
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => pick(o)}
                    className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${i === active ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
                  >
                    <span className="block text-gray-900">{o.name}</span>
                    {o.allocatedAt.length > 0 && (
                      <span className="block text-[11px] text-amber-600 truncate">Já alocado: {o.allocatedAt[0]}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {picked && picked.allocatedAt.length > 0 && (
            <div className="mt-2 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle size={14} className="shrink-0 mt-px" />
              <div className="min-w-0">
                <p className="font-medium">Esse obreiro já está alocado em:</p>
                {picked.allocatedAt.map(a => <p key={a}>{a}</p>)}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{group ? 'Nome do hóspede/grupo *' : 'Nome do hóspede *'}</label>
          <input name="guest_name" required placeholder={group ? 'Nome completo ou grupo' : 'Nome completo'} className={inputCls} />
        </div>
      )}
    </>
  )
}
