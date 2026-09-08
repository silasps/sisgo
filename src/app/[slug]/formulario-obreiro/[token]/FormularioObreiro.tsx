'use client'

import { useRef, useState, useContext, createContext } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { HeartHandshake } from 'lucide-react'
import { salvarSecaoObreiro, salvarSecaoObreiroComArquivos, enviarFormularioObreiro, gerarLinkReferenciaObreiro } from './actions'

const SECTIONS_COM_ARQUIVO = new Set([3, 10])
import { InternationalPhoneField } from '@/components/ui/InternationalPhoneField'
import { MaskedInput, useMask } from '@/components/ui/MaskedInput'
import { LangSwitcher } from '@/components/ui/LangSwitcher'
import { getStaffFormDict, normalizeStaffLang, tStaff, ptDict } from '@/lib/i18n/staff-forms'
import type { StaffFormDict, StaffLang } from '@/lib/i18n/staff-forms'

// ── Dictionary context — avoids prop drilling through all 10 sections ──────
const DictCtx = createContext<StaffFormDict>(ptDict)

type Prefill = {
  nome?: string
  email?: string
  telefone?: string
  idioma?: string
}

type MinistryOption = { id: string; name: string }

type Props = {
  slug: string
  token: string
  applicationId: string
  orgName: string
  orgType?: string | null
  ministryName?: string
  ministryId?: string | null
  ministries: MinistryOption[]
  prefill?: Prefill
  initialSection?: number
  initialData?: Record<string, unknown>
  initialLang?: string
  printMode?: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Sem min/max o <input type="date"> deixa digitar qualquer quantidade de
// dígitos no ano (ex.: "969999") — trava o valor entre 1900 e hoje.
const DATE_MIN = '1900-01-01'
const DATE_MAX = new Date().toISOString().slice(0, 10)

function Field({ label, name, defaultValue, placeholder, required, type = 'text', maxLength, min, max }: {
  label: string; name: string; defaultValue?: string; placeholder?: string
  required?: boolean; type?: string; maxLength?: number; min?: string; max?: string
}) {
  return (
    <div data-field={name}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input name={name} type={type} defaultValue={defaultValue} placeholder={placeholder}
        required={required} maxLength={maxLength}
        min={type === 'date' ? (min ?? DATE_MIN) : undefined}
        max={type === 'date' ? (max ?? DATE_MAX) : undefined}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-gray-50" />
    </div>
  )
}

function TextArea({ label, name, defaultValue, placeholder, required, rows = 4 }: {
  label: string; name: string; defaultValue?: string; placeholder?: string; required?: boolean; rows?: number
}) {
  return (
    <div data-field={name}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <textarea name={name} defaultValue={defaultValue} placeholder={placeholder} required={required} rows={rows}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-gray-50 resize-none" />
    </div>
  )
}

function Select({ label, name, defaultValue, required, options, onChange }: {
  label: string; name: string; defaultValue?: string; required?: boolean
  options: { value: string; label: string }[]
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
}) {
  const d = useContext(DictCtx)
  return (
    <div data-field={name}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select name={name} defaultValue={defaultValue ?? ''} required={required} onChange={onChange}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-gray-50">
        <option value="" disabled>{d.nav.select_placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function SectionTitle({ number, title }: { number: string; title: string }) {
  return (
    <div className="mb-6">
      <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">{number}</span>
      <h2 className="text-xl font-bold text-gray-900 mt-1">{title}</h2>
      <div className="h-0.5 bg-amber-100 mt-3" />
    </div>
  )
}

function SubSection({ title }: { title: string }) {
  return <div className="sm:col-span-2 mt-2"><p className="text-sm font-semibold text-gray-700 border-t pt-3">{title}</p></div>
}

// ── CEP auto-fill ────────────────────────────────────────────────────────────

function CepAddressFields({ data }: { data?: Record<string, string> }) {
  const d = useContext(DictCtx)
  const { value: cep, onChange: setCepRaw } = useMask('cep', data?.cep ?? '')
  const [endereco, setEndereco] = useState(data?.endereco ?? '')
  const [bairro, setBairro] = useState(data?.bairro ?? '')
  const [cidade, setCidade] = useState(data?.cidade ?? '')
  const [estado, setEstado] = useState(data?.estado ?? '')
  const [loadingCep, setLoadingCep] = useState(false)

  async function handleCepBlur() {
    const cleaned = cep.replace(/\D/g, '')
    if (cleaned.length !== 8) return
    setLoadingCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`)
      const json = await res.json()
      if (!json.erro) {
        setEndereco(json.logradouro ?? '')
        setBairro(json.bairro ?? '')
        setCidade(json.localidade ?? '')
        setEstado(json.uf ?? '')
      }
    } catch { /* user fills manually */ }
    setLoadingCep(false)
  }

  return (
    <>
      <SubSection title={d.s2.endereco_section} />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{d.s2.cep}</label>
        <input name="cep" value={cep} onChange={e => setCepRaw(e.target.value)} onBlur={handleCepBlur}
          placeholder="00000-000" maxLength={9} inputMode="numeric"
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-gray-50" />
        {loadingCep && <p className="text-xs text-amber-500 mt-1">{d.nav.loading_cep}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{d.s2.bairro}</label>
        <input name="bairro" value={bairro} onChange={e => setBairro(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-gray-50" />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">{d.s2.endereco_rua}</label>
        <input name="endereco" value={endereco} onChange={e => setEndereco(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-gray-50" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{d.s2.cidade} <span className="text-red-500">*</span></label>
        <input name="cidade" value={cidade} onChange={e => setCidade(e.target.value)} required
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-gray-50" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{d.s2.estado} <span className="text-red-500">*</span></label>
        <input name="estado" value={estado} onChange={e => setEstado(e.target.value)} required
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-gray-50" />
      </div>
    </>
  )
}

function ZipAddressFields({ data }: { data?: Record<string, string> }) {
  const d = useContext(DictCtx)
  return (
    <>
      <SubSection title={d.s2.endereco_section} />
      <Field label={d.s2.cep} name="cep" defaultValue={data?.cep} placeholder={d.s2.zip_ph} />
      <Field label={d.s2.bairro} name="bairro" defaultValue={data?.bairro} />
      <div className="sm:col-span-2">
        <Field label={d.s2.endereco_rua} name="endereco" defaultValue={data?.endereco} />
      </div>
      <Field label={d.s2.cidade} name="cidade" defaultValue={data?.cidade} required />
      <Field label={d.s2.estado} name="estado" defaultValue={data?.estado} required />
    </>
  )
}

// ── Escolas/especializações — lista dinâmica (nome + mês/ano de conclusão) ──

type JocumSchoolEntry = { escola: string; mesAno: string }

// Aceita tanto o novo formato (JSON array) quanto texto livre salvo antes
// desta mudança — sem isso, reabrir uma inscrição antiga perderia o dado.
function parseJocumSchools(raw?: string): JocumSchoolEntry[] {
  if (!raw) return [{ escola: '', mesAno: '' }]
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length) {
      return parsed.map((r: unknown) => {
        const row = (r ?? {}) as Partial<JocumSchoolEntry>
        return { escola: row.escola ?? '', mesAno: row.mesAno ?? '' }
      })
    }
  } catch { /* valor legado em texto livre, cai no fallback abaixo */ }
  return raw.trim() ? [{ escola: raw, mesAno: '' }] : [{ escola: '', mesAno: '' }]
}

function JocumSchoolsField({ label, placeholder, data }: { label: string; placeholder: string; data?: string }) {
  const d = useContext(DictCtx)
  const [rows, setRows] = useState<JocumSchoolEntry[]>(() => parseJocumSchools(data))

  function updateRow(i: number, patch: Partial<JocumSchoolEntry>) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }
  function addRow() {
    setRows(prev => [...prev, { escola: '', mesAno: '' }])
  }
  function removeRow(i: number) {
    setRows(prev => prev.filter((_, idx) => idx !== i))
  }

  // Só serializa linhas com algum conteúdo — evita salvar um array cheio de
  // linhas vazias quando a pessoa clicou em "+" mas não preencheu.
  const serialized = JSON.stringify(rows.filter(r => r.escola.trim() || r.mesAno.trim()))

  return (
    <div className="sm:col-span-2 space-y-2">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <p className="text-xs text-gray-500 -mt-1">{d.s2.escolas_jocum_hint}</p>
      {rows.length > 0 && (
        <div className="hidden sm:flex gap-2 items-start">
          <span className="flex-1 text-xs font-medium text-gray-500">{placeholder}</span>
          <span className="w-40 text-xs font-medium text-gray-500">{d.s2.escolas_jocum_mes_ano}</span>
        </div>
      )}
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2 items-start">
          <input type="text" value={row.escola} onChange={e => updateRow(i, { escola: e.target.value })}
            placeholder={placeholder}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-gray-50" />
          <input type="month" value={row.mesAno} onChange={e => updateRow(i, { mesAno: e.target.value })}
            placeholder={d.s2.escolas_jocum_mes_ano} aria-label={d.s2.escolas_jocum_mes_ano}
            className="w-40 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-gray-50" />
          {rows.length > 1 && (
            <button type="button" onClick={() => removeRow(i)} aria-label={d.s2.escolas_jocum_remove}
              className="px-3 py-2.5 text-gray-400 hover:text-red-500 text-sm">✕</button>
          )}
        </div>
      ))}
      <button type="button" onClick={addRow}
        className="text-xs font-semibold text-amber-600 hover:text-amber-800">
        {d.s2.escolas_jocum_add}
      </button>
      {/* Campo de verdade enviado no submit — mesmo `name` de sempre, só que
          agora carregando um JSON array em vez de texto livre. */}
      <input type="hidden" name="escolas_jocum" value={serialized} readOnly />
    </div>
  )
}

// ── Sections ─────────────────────────────────────────────────────────────────

function S1Email({ prefill, data }: { prefill?: Prefill; data?: Record<string, string> }) {
  const d = useContext(DictCtx)
  return (
    <div className="space-y-4">
      <SectionTitle number={d.s1.section} title={d.s1.title} />
      <Field label={d.s1.email} name="email" type="email"
        defaultValue={data?.email ?? prefill?.email} required />
    </div>
  )
}

function S2Dados({ prefill, data, onNationalityChange, orgName, orgType }: {
  prefill?: Prefill; data?: Record<string, string>
  onNationalityChange?: (isBrazilian: boolean) => void
  orgName: string; orgType?: string | null
}) {
  const d = useContext(DictCtx)
  const [estrangeiro, setEstrangeiro] = useState(data?.is_brasileiro === 'nao')

  function handleNationality(e: React.ChangeEvent<HTMLSelectElement>) {
    const isForeigner = e.target.value === 'nao'
    setEstrangeiro(isForeigner)
    onNationalityChange?.(!isForeigner)
  }

  return (
    <div className="space-y-4">
      <SectionTitle number={d.s2.section} title={d.s2.title} />
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Field label={d.s2.nome} name="nome" defaultValue={data?.nome ?? prefill?.nome} required />
        </div>
        <Select label={d.s2.sexo} name="sexo" required defaultValue={data?.sexo} options={[
          { value: 'M', label: d.opts.gender_m },
          { value: 'F', label: d.opts.gender_f },
        ]} />
        <Field label={d.s2.data_nascimento} name="data_nascimento" type="date"
          defaultValue={data?.data_nascimento} required />
        <Select label={d.s2.estado_civil} name="estado_civil" required defaultValue={data?.estado_civil} options={[
          { value: 'solteiro', label: d.s3.solteiro },
          { value: 'casado', label: d.s3.casado },
          { value: 'divorciado', label: d.s3.divorciado },
          { value: 'viuvo', label: d.s3.viuvo },
        ]} />
        <Select label={d.s2.is_brasileiro} name="is_brasileiro" required
          defaultValue={data?.is_brasileiro}
          options={[
            { value: 'sim', label: d.s2.is_brasileiro_sim },
            { value: 'nao', label: d.s2.is_brasileiro_nao },
          ]} onChange={handleNationality} />
        {estrangeiro && <>
          <Field label={d.s2.nacionalidade} name="nacionalidade" defaultValue={data?.nacionalidade} required />
          <Select label={d.s2.fluencia_portugues} name="fluencia_portugues"
            defaultValue={data?.fluencia_portugues}
            options={[
              { value: 'basico', label: d.opts.basic },
              { value: 'intermediario', label: d.opts.intermediate },
              { value: 'avancado', label: d.opts.advanced },
              { value: 'fluente', label: d.opts.fluent },
            ]} />
          <Select label={d.s2.idioma_preferencia} name="idioma_preferencia_comunicacao"
            defaultValue={data?.idioma_preferencia_comunicacao}
            options={[
              { value: 'portugues', label: d.s2.idioma_portugues },
              { value: 'ingles', label: d.s2.idioma_ingles },
              { value: 'espanhol', label: d.s2.idioma_espanhol },
              { value: 'outro', label: d.opts.other },
            ]} />
        </>}

        <SubSection title={d.s2.formacao_section} />
        <Select label={d.s2.escolaridade} name="escolaridade" required defaultValue={data?.escolaridade} options={[
          { value: 'fundamental', label: d.s2.fundamental },
          { value: 'medio', label: d.s2.medio },
          { value: 'tecnico', label: d.s2.tecnico },
          { value: 'superior_incompleto', label: d.s2.superior_incompleto },
          { value: 'superior', label: d.s2.superior },
          { value: 'pos_graduacao', label: d.s2.pos_graduacao },
          { value: 'mestrado', label: d.s2.mestrado },
          { value: 'doutorado', label: d.s2.doutorado },
        ]} />
        <Field label={d.s2.profissao} name="profissao" defaultValue={data?.profissao} />
        <div className="sm:col-span-2">
          <TextArea label={d.s2.habilidades} name="habilidades" defaultValue={data?.habilidades} rows={3}
            placeholder={d.s2.habilidades_ph} />
        </div>
        <div className="sm:col-span-2">
          <Field label={d.s2.especializacao_profissional} name="especializacao_profissional"
            defaultValue={data?.especializacao_profissional}
            placeholder={d.s2.especializacao_profissional_ph} />
        </div>
        <JocumSchoolsField
          label={!orgType || orgType === 'jocum' ? d.s2.escolas_jocum : tStaff(d.s2.escolas_jocum_generic, { orgName })}
          placeholder={d.s2.escolas_jocum_ph}
          data={data?.escolas_jocum}
        />

        <SubSection title={d.s2.idiomas_section} />
        {([
          { label: d.s2.idioma_portugues, name: 'idioma_portugues', defaultNativo: true },
          { label: d.s2.idioma_ingles, name: 'idioma_ingles' },
          { label: d.s2.idioma_espanhol, name: 'idioma_espanhol' },
        ] as { label: string; name: string; defaultNativo?: boolean }[]).map(({ label, name, defaultNativo }) => (
          <div key={name}>
            <Select label={label} name={name}
              defaultValue={data?.[name] ?? (defaultNativo ? 'nativo' : '')}
              options={[
                { value: 'nativo', label: d.opts.native },
                { value: 'basico', label: d.opts.basic },
                { value: 'intermediario', label: d.opts.intermediate },
                { value: 'avancado', label: d.opts.advanced },
                { value: 'fluente', label: d.opts.fluent },
                { value: 'nao_falo', label: d.opts.dont_speak },
              ]} />
          </div>
        ))}
        <Field label={d.s2.outro_idioma} name="outro_idioma" defaultValue={data?.outro_idioma}
          placeholder={d.s2.outro_idioma_ph} />

        <SubSection title={d.s2.documentos_section} />
        {!estrangeiro ? (<>
          <MaskedInput mask="rg" name="rg" label={d.s2.rg} defaultValue={data?.rg} required />
          <MaskedInput mask="cpf" name="cpf" label={d.s2.cpf} defaultValue={data?.cpf} required />
          <Field label={d.s2.passaporte_opcional} name="passaporte" defaultValue={data?.passaporte} maxLength={20} />
        </>) : (<>
          <div className="sm:col-span-2">
            <Field label={d.s2.passaporte_obrigatorio} name="passaporte" defaultValue={data?.passaporte}
              required maxLength={20} placeholder="Ex: AB123456" />
          </div>
        </>)}

        {!estrangeiro
          ? <CepAddressFields data={data} />
          : <ZipAddressFields data={data} />
        }
        <Field label={d.s2.pais} name="pais" defaultValue={data?.pais ?? (estrangeiro ? '' : 'Brasil')} required />
        <InternationalPhoneField phoneName="celular" countryName="celular_country"
          label={d.s2.celular} defaultCountryIso="BR" defaultPhone={data?.celular ?? prefill?.telefone} />
        <Field label={d.s2.email_contato} name="email_contato" type="email"
          defaultValue={data?.email_contato} required />

        <SubSection title={d.s2.redes_section} />
        <Field label={d.s2.instagram} name="instagram" defaultValue={data?.instagram} placeholder="@usuario" />
        <Field label={d.s2.facebook} name="facebook" defaultValue={data?.facebook} />
        <Field label={d.s2.tiktok} name="tiktok" defaultValue={data?.tiktok} />
        <Field label={d.s2.linkedin} name="linkedin" defaultValue={data?.linkedin} />

        <SubSection title={d.s2.emergencia_section} />
        <Field label={d.s2.emergencia_nome} name="emergencia_nome" defaultValue={data?.emergencia_nome} required />
        <Field label={d.s2.emergencia_parentesco} name="emergencia_parentesco" defaultValue={data?.emergencia_parentesco} required />
        <InternationalPhoneField phoneName="emergencia_telefone" countryName="emergencia_telefone_country"
          label={d.s2.emergencia_telefone} defaultCountryIso="BR"
          defaultPhone={data?.emergencia_telefone} required />
        <Field label={d.s2.emergencia_email} name="emergencia_email" type="email" defaultValue={data?.emergencia_email} />
      </div>
    </div>
  )
}

function S3Familia({ data, estadoCivilS2 }: { data?: Record<string, string>; estadoCivilS2?: string }) {
  const d = useContext(DictCtx)
  const estadoCivil = data?.estado_civil_atual ?? estadoCivilS2 ?? ''
  const [temFilhos, setTemFilhos] = useState(data?.tem_filhos === 'sim')

  const civilMap: Record<string, string> = {
    solteiro: d.s3.solteiro,
    casado: d.s3.casado,
    divorciado: d.s3.divorciado,
    viuvo: d.s3.viuvo,
  }

  return (
    <div className="space-y-4">
      <SectionTitle number={d.s3.section} title={d.s3.title} />
      <div className="grid sm:grid-cols-2 gap-4">
        <input type="hidden" name="estado_civil_atual" value={estadoCivil} />
        {estadoCivil && (
          <div className="sm:col-span-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-600">
            {d.s3.civil_label} <strong>{civilMap[estadoCivil] ?? estadoCivil}</strong>
            <span className="text-xs text-gray-400 ml-2">{d.s3.civil_from_s2}</span>
          </div>
        )}

        {estadoCivil === 'casado' && <>
          <SubSection title={d.s3.conjuge_section} />
          <Field label={d.s3.conjuge_nome} name="conjuge_nome" defaultValue={data?.conjuge_nome} required />
          <Field label={d.s3.conjuge_data_nascimento} name="conjuge_nascimento" type="date" defaultValue={data?.conjuge_nascimento} />
          <Field label={d.s3.tempo_casados} name="tempo_casados" defaultValue={data?.tempo_casados} />
          <Select label={d.s3.conjuge_vira} name="conjuge_vira" defaultValue={data?.conjuge_vira} options={[
            { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
          ]} />
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {d.s3.certidao_casamento} <span className="text-red-500">*</span>
            </label>
            <input type="file" name="doc_certidao_casamento" accept="image/jpeg,image/png,image/webp,application/pdf"
              required
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 cursor-pointer" />
          </div>
        </>}

        <div className="sm:col-span-2 mt-2">
          <Select label={d.s3.tem_filhos} name="tem_filhos" defaultValue={data?.tem_filhos} options={[
            { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
          ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTemFilhos(e.target.value === 'sim')} />
        </div>
        {temFilhos && <>
          <div className="sm:col-span-2">
            <TextArea label={d.s3.filhos_dados} name="filhos_dados"
              defaultValue={data?.filhos_dados} rows={3} required
              placeholder={d.s3.filhos_dados_ph} />
          </div>
          <Select label={d.s3.filhos_virao} name="filhos_virao" defaultValue={data?.filhos_virao} options={[
            { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
          ]} />
        </>}
      </div>
    </div>
  )
}

function S4Igreja({ data }: { data?: Record<string, string> }) {
  const d = useContext(DictCtx)
  const [conversou, setConversou] = useState(data?.conversou_pastor === 'sim')
  const [participa, setParticipa] = useState(data?.tem_ministerio === 'sim')
  const [lideranca, setLideranca] = useState(data?.tem_lideranca === 'sim')
  return (
    <div className="space-y-4">
      <SectionTitle number={d.s4.section} title={d.s4.title} />
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Field label={d.s4.igreja_nome} name="igreja_nome" defaultValue={data?.igreja_nome} required />
        </div>
        <Field label={d.s4.igreja_cidade} name="igreja_cidade" defaultValue={data?.igreja_cidade} required />
        <Field label={d.s4.tempo_igreja} name="tempo_igreja" defaultValue={data?.tempo_igreja} required />
        <Select label={d.s4.membro} name="membro_oficial" defaultValue={data?.membro_oficial} options={[
          { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
        ]} />
        <Select label={d.s4.tem_ministerio} name="tem_ministerio" defaultValue={data?.tem_ministerio} options={[
          { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
        ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setParticipa(e.target.value === 'sim')} />
        {participa && <>
          <Field label={d.s4.ministerio_qual} name="ministerio_qual" defaultValue={data?.ministerio_qual} />
          <Select label={d.s4.tem_lideranca} name="tem_lideranca" defaultValue={data?.tem_lideranca} options={[
            { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
          ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLideranca(e.target.value === 'sim')} />
          {lideranca && <Field label={d.s4.lideranca_qual} name="lideranca_cargo" defaultValue={data?.lideranca_cargo} />}
        </>}

        <SubSection title={d.s4.pastor_section} />
        <Field label={d.s4.pastor_nome} name="pastor_nome" defaultValue={data?.pastor_nome} required />
        <Field label={d.s4.pastor_cargo} name="pastor_cargo" defaultValue={data?.pastor_cargo} />
        <Field label={d.s4.pastor_email} name="pastor_email" type="email" defaultValue={data?.pastor_email} />
        <InternationalPhoneField phoneName="pastor_telefone" countryName="pastor_telefone_country"
          label={d.s4.pastor_telefone} defaultCountryIso="BR"
          defaultPhone={data?.pastor_telefone} />

        <div className="sm:col-span-2">
          <Select label={d.s4.conversou_pastor} name="conversou_pastor" required
            defaultValue={data?.conversou_pastor}
            options={[
              { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
            ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setConversou(e.target.value === 'sim')} />
        </div>
        {conversou && (
          <Select label={d.s4.pastor_concorda} name="pastor_concorda"
            defaultValue={data?.pastor_concorda}
            options={[
              { value: 'sim', label: d.opts.yes },
              { value: 'parcialmente', label: d.opts.partially },
              { value: 'nao', label: d.opts.no },
            ]} />
        )}
        <div className="sm:col-span-2">
          <Select label={d.s4.igreja_ciente} name="igreja_ciente" required
            defaultValue={data?.igreja_ciente}
            options={[
              { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no }, { value: 'parcialmente', label: d.opts.partially },
            ]} />
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            {d.s4.pastor_hint}
          </p>
        </div>
      </div>
    </div>
  )
}

function S5Experiencia({ data }: { data?: Record<string, string> }) {
  const d = useContext(DictCtx)
  const [tipo, setTipo] = useState(data?.experiencia_recente_tipo ?? '')
  const [conhece, setConhece] = useState(data?.conhece_alguem === 'sim')
  return (
    <div className="space-y-4">
      <SectionTitle number={d.s5.section} title={d.s5.title} />
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Select label={d.s5.tipo_label} name="experiencia_recente_tipo" required
            defaultValue={data?.experiencia_recente_tipo}
            options={[
              { value: 'escola', label: d.s5.tipo_escola },
              { value: 'missao', label: d.s5.tipo_missao },
              { value: 'nenhuma', label: d.s5.tipo_nenhuma },
            ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTipo(e.target.value)} />
        </div>

        {tipo === 'escola' && <>
          <Field label={d.s5.escola_nome} name="escola_nome" defaultValue={data?.escola_nome} required />
          <Field label={d.s5.escola_periodo} name="escola_periodo" defaultValue={data?.escola_periodo} />
          <SubSection title={d.s5.escola_lideranca_section} />
          <Field label={d.s5.escola_lider_nome} name="escola_lider_nome" defaultValue={data?.escola_lider_nome} required />
          <Field label={d.s5.escola_lider_email} name="escola_lider_email" type="email" defaultValue={data?.escola_lider_email} />
          <InternationalPhoneField phoneName="escola_lider_tel" countryName="escola_lider_tel_country"
            label={d.s5.escola_lider_tel} defaultCountryIso="BR" defaultPhone={data?.escola_lider_tel} required />
        </>}

        {tipo === 'missao' && <>
          <div className="sm:col-span-2">
            <TextArea label={d.s5.missao_descricao} name="missao_descricao"
              defaultValue={data?.missao_descricao} required rows={4} />
          </div>
          <Field label={d.s5.missao_organizacao} name="missao_organizacao"
            defaultValue={data?.missao_organizacao} required />
          <Field label={d.s5.missao_duracao} name="missao_duracao" defaultValue={data?.missao_duracao} />
          <SubSection title={d.s5.missao_lideranca_section} />
          <Field label={d.s5.missao_lider_nome} name="missao_lider_nome" defaultValue={data?.missao_lider_nome} required />
          <Field label={d.s5.missao_lider_email} name="missao_lider_email" type="email" defaultValue={data?.missao_lider_email} />
          <InternationalPhoneField phoneName="missao_lider_tel" countryName="missao_lider_tel_country"
            label={d.s5.missao_lider_tel} defaultCountryIso="BR" defaultPhone={data?.missao_lider_tel} required />
        </>}

        <SubSection title={d.s5.conexao_section} />
        <div className="sm:col-span-2">
          <Select label={d.s5.conhece_parente} name="conhece_alguem"
            defaultValue={data?.conhece_alguem}
            options={[
              { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
            ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setConhece(e.target.value === 'sim')} />
        </div>
        {conhece && <>
          <Select label={d.s5.vinculo_tipo} name="vinculo_tipo" defaultValue={data?.vinculo_tipo} options={[
            { value: 'parente', label: d.s5.parentesco }, { value: 'conhecido', label: d.s5.conhecido },
          ]} />
          <Field label={d.s5.vinculo_nome} name="vinculo_nome" defaultValue={data?.vinculo_nome} />
          <div className="sm:col-span-2">
            <TextArea label={d.s5.vinculo_descricao} name="vinculo_descricao"
              defaultValue={data?.vinculo_descricao} rows={2} />
          </div>
        </>}
      </div>
    </div>
  )
}

function S6ServirBase({ data, ministries, ministryId }: {
  data?: Record<string, string>; ministries: MinistryOption[]; ministryId?: string | null
}) {
  const d = useContext(DictCtx)
  return (
    <div className="space-y-4">
      <SectionTitle number={d.s6.section} title={d.s6.title} />
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Select label={d.s6.como_servir} name="modalidade_servico" required
            defaultValue={data?.modalidade_servico}
            options={[
              { value: 'integral', label: d.s6.integral },
              { value: 'parcial', label: d.s6.parcial },
              { value: 'temporario', label: d.s6.temporario },
            ]} />
        </div>
        <Field label={d.s6.quanto_tempo} name="tempo_servico"
          defaultValue={data?.tempo_servico} required
          placeholder={d.s6.quanto_tempo_ph} />
        <Field label={d.s6.data_chegada} name="data_chegada" type="date"
          defaultValue={data?.data_chegada} min={DATE_MAX} max="2100-12-31" />
        {ministries.length > 0 && (
          <div className="sm:col-span-2">
            <Select label={d.s6.qual_ministerio} name="ministerio_escolhido"
              defaultValue={data?.ministerio_escolhido ?? ministryId ?? ''}
              options={ministries.map(m => ({ value: m.id, label: m.name }))} />
          </div>
        )}
        <div className="sm:col-span-2">
          <TextArea label={d.s6.motivacao} name="motivacao"
            defaultValue={data?.motivacao} required rows={4}
            placeholder={d.s6.motivacao_ph} />
        </div>
      </div>
    </div>
  )
}

function S7Saude({ data }: { data?: Record<string, string> }) {
  const d = useContext(DictCtx)
  const [problema, setProblema] = useState(data?.problema_saude === 'sim')
  const [limitacao, setLimitacao] = useState(data?.limitacao_fisica === 'sim')
  const [remedio, setRemedio] = useState(data?.remedio_controlado === 'sim')
  const [alergia, setAlergia] = useState(data?.tem_alergia === 'sim')
  return (
    <div className="space-y-4">
      <SectionTitle number={d.s7.section} title={d.s7.title} />
      <div className="grid gap-4">
        <Select label={d.s7.problema_saude} name="problema_saude" required
          defaultValue={data?.problema_saude}
          options={[{ value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no }]}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setProblema(e.target.value === 'sim')} />
        {problema && (
          <TextArea label={d.s7.problema_saude_desc} name="problema_saude_descricao"
            defaultValue={data?.problema_saude_descricao} required rows={3} />
        )}

        <Select label={d.s7.limitacao_fisica} name="limitacao_fisica" required
          defaultValue={data?.limitacao_fisica}
          options={[{ value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no }]}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLimitacao(e.target.value === 'sim')} />
        {limitacao && (
          <TextArea label={d.s7.limitacao_fisica_desc} name="limitacao_fisica_descricao"
            defaultValue={data?.limitacao_fisica_descricao} required rows={3} />
        )}

        <Select label={d.s7.medicamento_controlado} name="remedio_controlado" required
          defaultValue={data?.remedio_controlado}
          options={[{ value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no }]}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRemedio(e.target.value === 'sim')} />
        {remedio && (
          <TextArea label={d.s7.medicamento_controlado_desc} name="remedio_controlado_descricao"
            defaultValue={data?.remedio_controlado_descricao} required rows={3} />
        )}

        <Select label={d.s7.alergia} name="tem_alergia" required
          defaultValue={data?.tem_alergia}
          options={[{ value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no }]}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAlergia(e.target.value === 'sim')} />
        {alergia && (
          <TextArea label={d.s7.alergia_desc} name="alergia_descricao"
            defaultValue={data?.alergia_descricao} required rows={3} />
        )}
      </div>
    </div>
  )
}

function S8Legal({ data }: { data?: Record<string, string> }) {
  const d = useContext(DictCtx)
  const [pendencia, setPendencia] = useState(data?.pendencia_judicial === 'sim')
  const decls = [
    { name: 'decl_verdadeiro', text: d.s8.decl_verdadeiro },
    { name: 'decl_compromisso', text: d.s8.decl_respeito },
    { name: 'decl_sem_condenacao_menor', text: d.s8.decl_sem_condenacao_menor },
  ]
  return (
    <div className="space-y-4">
      <SectionTitle number={d.s8.section} title={d.s8.title} />
      <div className="grid gap-4">
        <Select label={d.s8.pendencia_judicial} name="pendencia_judicial" required
          defaultValue={data?.pendencia_judicial}
          options={[{ value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no }]}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPendencia(e.target.value === 'sim')} />
        {pendencia && (
          <TextArea label={d.s8.pendencia_judicial_desc} name="pendencia_judicial_descricao"
            defaultValue={data?.pendencia_judicial_descricao} required rows={3} />
        )}

        <div className="space-y-2 mt-2">
          {decls.map(decl => (
            <label key={decl.name} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 cursor-pointer hover:border-amber-200">
              <input type="checkbox" name={decl.name} value="sim"
                defaultChecked={data?.[decl.name] === 'sim'}
                required className="mt-0.5 accent-amber-600 flex-shrink-0" />
              <span className="text-sm text-gray-700">{decl.text}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

function S9Financeiro({ data }: { data?: Record<string, string> }) {
  const d = useContext(DictCtx)
  const [temApoio, setTemApoio] = useState(data?.tem_apoio_financeiro === 'sim')
  return (
    <div className="space-y-4">
      <SectionTitle number={d.s9.section} title={d.s9.title} />
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Select label={d.s9.apoio_financeiro} name="tem_apoio_financeiro" required
            defaultValue={data?.tem_apoio_financeiro}
            options={[
              { value: 'sim', label: d.opts.yes }, { value: 'parcialmente', label: d.opts.partially }, { value: 'nao', label: d.opts.no },
            ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTemApoio(e.target.value === 'sim' || e.target.value === 'parcialmente')} />
        </div>
        {temApoio && (
          <div className="sm:col-span-2">
            <TextArea label={d.s9.apoio_qual} name="apoio_financeiro_descricao"
              defaultValue={data?.apoio_financeiro_descricao} required rows={3}
              placeholder={d.s9.apoio_qual_ph} />
          </div>
        )}
        <div className="sm:col-span-2">
          <TextArea label={d.s9.situacao_financeira} name="situacao_financeira"
            defaultValue={data?.situacao_financeira} required rows={4}
            placeholder={d.s9.situacao_financeira_ph} />
        </div>
        <div className="sm:col-span-2">
          <Select label={d.s9.tem_dividas} name="tem_dividas" defaultValue={data?.tem_dividas} options={[
            { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
          ]} />
        </div>
      </div>
    </div>
  )
}

function S10DocumentosAceite({ isBrazilian, estadoCivil }: { isBrazilian: boolean; estadoCivil: string }) {
  const d = useContext(DictCtx)
  return (
    <div className="space-y-4">
      <SectionTitle number={d.s10.section} title={d.s10.title} />

      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800 leading-relaxed">
        {d.s10.docs_intro}
        <strong className="block mt-2">{d.s10.foto_instrucoes_label}</strong>
        {d.s10.foto_instrucoes}
      </div>

      <div className="grid gap-4">
        {[
          { name: 'doc_foto', label: d.s10.doc_foto, required: true },
          ...(isBrazilian ? [
            { name: 'doc_rg_frente', label: d.s10.doc_rg_frente, required: true },
            { name: 'doc_rg_verso', label: d.s10.doc_rg_verso, required: true },
          ] : [
            { name: 'doc_passaporte', label: d.s10.doc_passaporte, required: true },
          ]),
          ...(estadoCivil === 'casado' ? [
            { name: 'doc_certidao_casamento_s10', label: d.s3.certidao_casamento, required: false },
          ] : []),
        ].map(doc => (
          <div key={doc.name}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {doc.label}{doc.required && <span className="text-red-500 ml-0.5"> *</span>}
            </label>
            <input type="file" name={doc.name} accept="image/jpeg,image/png,image/webp,application/pdf"
              required={doc.required}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 cursor-pointer" />
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-900 text-sm mb-2">{d.s10.lgpd_heading}</h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            {d.s10.lgpd_text}
          </p>
        </div>
        <label className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 cursor-pointer">
          <input type="checkbox" name="aceite_lgpd" value="sim" required
            className="mt-0.5 accent-amber-600 flex-shrink-0" />
          <span className="text-sm font-semibold text-amber-800">
            {d.s10.lgpd_checkbox}
          </span>
        </label>
        <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 cursor-pointer hover:border-amber-200">
          <input type="checkbox" name="maior_18" value="sim" required
            className="mt-0.5 accent-amber-600 flex-shrink-0" />
          <span className="text-sm text-gray-700">{d.s10.maior_18}</span>
        </label>
        <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 cursor-pointer hover:border-amber-200">
          <input type="checkbox" name="decl_ciencia_verificacao" value="sim" required
            className="mt-0.5 accent-amber-600 flex-shrink-0" />
          <span className="text-sm text-gray-700">
            {d.s10.decl_ciencia_verificacao}
          </span>
        </label>
      </div>
    </div>
  )
}

// ── Tela de sucesso ──────────────────────────────────────────────────────────

function SubmittedScreen({ slug, applicationId, orgName, d }: {
  slug: string; applicationId: string; orgName: string; d: StaffFormDict
}) {
  const [pastorLink, setPastorLink] = useState<string | null>(null)
  const [amigoLink, setAmigoLink] = useState<string | null>(null)
  const [loadingPastor, setLoadingPastor] = useState(false)
  const [loadingAmigo, setLoadingAmigo] = useState(false)
  const [copied, setCopied] = useState<'pastor' | 'amigo' | null>(null)

  async function gerarLink(tipo: 'pastor' | 'amigo') {
    if (tipo === 'pastor') setLoadingPastor(true)
    else setLoadingAmigo(true)
    try {
      const result = await gerarLinkReferenciaObreiro(slug, applicationId, tipo)
      if ('url' in result && result.url) {
        const url = result.url
        if (tipo === 'pastor') setPastorLink(url)
        else setAmigoLink(url)
        await navigator.clipboard.writeText(url).catch(() => {})
        setCopied(tipo)
        setTimeout(() => setCopied(null), 3000)
      }
    } catch { /* ignore */ }
    if (tipo === 'pastor') setLoadingPastor(false)
    else setLoadingAmigo(false)
  }

  async function copyLink(link: string, tipo: 'pastor' | 'amigo') {
    await navigator.clipboard.writeText(link).catch(() => {})
    setCopied(tipo)
    setTimeout(() => setCopied(null), 3000)
  }

  return (
    <div className="text-center py-12 px-4 space-y-8">
      <div>
        <HeartHandshake className="size-14 mx-auto mb-4 text-amber-500" />
        <h2 className="text-3xl font-black text-gray-900 mb-3">{d.submitted.title}</h2>
        <p className="text-gray-600 max-w-md mx-auto text-base leading-relaxed">
          {tStaff(d.submitted.body, { org: orgName })}
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-left max-w-md mx-auto space-y-4">
        <h3 className="font-bold text-gray-900 text-center">{d.submitted.next_title}</h3>
        <p className="text-sm text-gray-600 text-center">
          {d.submitted.next_body}
        </p>

        <div className="space-y-2">
          <button onClick={() => gerarLink('pastor')} disabled={loadingPastor}
            className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors text-sm">
            {loadingPastor ? d.submitted.generating : pastorLink ? d.submitted.new_pastor : d.submitted.gen_pastor}
          </button>
          {pastorLink && (
            <div className="flex items-center gap-2 bg-white border border-amber-200 rounded-xl px-3 py-2">
              <input readOnly value={pastorLink}
                className="flex-1 text-xs text-gray-600 bg-transparent outline-none truncate" />
              <button onClick={() => copyLink(pastorLink, 'pastor')}
                className="text-xs font-semibold text-amber-600 hover:text-amber-800 whitespace-nowrap">
                {copied === 'pastor' ? d.submitted.copied : d.submitted.copy}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <button onClick={() => gerarLink('amigo')} disabled={loadingAmigo}
            className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors text-sm">
            {loadingAmigo ? d.submitted.generating : amigoLink ? d.submitted.new_friend : d.submitted.gen_friend}
          </button>
          {amigoLink && (
            <div className="flex items-center gap-2 bg-white border border-purple-200 rounded-xl px-3 py-2">
              <input readOnly value={amigoLink}
                className="flex-1 text-xs text-gray-600 bg-transparent outline-none truncate" />
              <button onClick={() => copyLink(amigoLink, 'amigo')}
                className="text-xs font-semibold text-purple-600 hover:text-purple-800 whitespace-nowrap">
                {copied === 'amigo' ? d.submitted.copied : d.submitted.copy}
              </button>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center">{d.submitted.link_hint}</p>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

type SectionDef = { id: number; component: React.ReactNode }

export function FormularioObreiro({
  slug, token, applicationId, orgName, orgType, ministryId, ministries,
  prefill, initialSection = 1, initialData, initialLang, printMode
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [lang, setLangState] = useState<StaffLang>(normalizeStaffLang(initialLang ?? prefill?.idioma))
  const d = getStaffFormDict(lang)

  function setLang(l: StaffLang) {
    setLangState(l)
    const params = new URLSearchParams(searchParams.toString())
    params.set('lang', l)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const [current, setCurrent] = useState(initialSection)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  const [localData, setLocalData] = useState<Record<string, Record<string, string>>>(
    (initialData ?? {}) as Record<string, Record<string, string>>
  )

  const [isBrazilian, setIsBrazilian] = useState(
    (localData.s2 as Record<string, string> | undefined)?.is_brasileiro !== 'nao'
  )

  const sections: SectionDef[] = [
    { id: 1, component: <S1Email prefill={prefill} data={localData.s1} /> },
    { id: 2, component: <S2Dados prefill={prefill} data={localData.s2} onNationalityChange={setIsBrazilian} orgName={orgName} orgType={orgType} /> },
    { id: 3, component: <S3Familia data={localData.s3} estadoCivilS2={localData.s2?.estado_civil} /> },
    { id: 4, component: <S4Igreja data={localData.s4} /> },
    { id: 5, component: <S5Experiencia data={localData.s5} /> },
    { id: 6, component: <S6ServirBase data={localData.s6} ministries={ministries} ministryId={ministryId} /> },
    { id: 7, component: <S7Saude data={localData.s7} /> },
    { id: 8, component: <S8Legal data={localData.s8} /> },
    { id: 9, component: <S9Financeiro data={localData.s9} /> },
    { id: 10, component: <S10DocumentosAceite isBrazilian={isBrazilian} estadoCivil={localData.s2?.estado_civil ?? localData.s3?.estado_civil_atual ?? ''} /> },
  ]

  if (printMode) {
    return (
      <DictCtx.Provider value={d}>
      <div>
        <div className="print:hidden mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            Versão para preenchimento à mão — imprima e devolva à equipe por outro meio.
          </p>
          <button type="button" onClick={() => window.print()}
            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors">
            Baixar PDF (imprimir)
          </button>
        </div>
        <div className="space-y-8">
          {sections.map(s => (
            <div key={s.id} className="pb-8 border-b border-gray-100 last:border-0 break-inside-avoid-page">
              {s.component}
            </div>
          ))}
        </div>
      </div>
      </DictCtx.Provider>
    )
  }

  const currentIndex = sections.findIndex(s => s.id === current)
  const isLast = currentIndex === sections.length - 1
  const progress = Math.round(((currentIndex + 1) / sections.length) * 100)

  async function handleBack() {
    if (currentIndex === 0) return
    if (formRef.current) {
      const fd = new FormData(formRef.current)
      const dataRecord: Record<string, string> = {}
      fd.forEach((v, k) => { if (typeof v === 'string') dataRecord[k] = v })
      setLocalData(prev => ({ ...prev, [`s${sections[currentIndex].id}`]: dataRecord }))
      if (SECTIONS_COM_ARQUIVO.has(sections[currentIndex].id)) {
        await salvarSecaoObreiroComArquivos(slug, token, sections[currentIndex].id, fd).catch(() => {})
      } else {
        await salvarSecaoObreiro(slug, token, sections[currentIndex].id, dataRecord).catch(() => {})
      }
    }
    setCurrent(sections[currentIndex - 1].id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleNext(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const fd = new FormData(e.currentTarget)

      if (sections[currentIndex].id === 2) {
        setIsBrazilian(fd.get('is_brasileiro') !== 'nao')
      }

      if (sections[currentIndex].id === 4) {
        const email = (fd.get('pastor_email') as string)?.trim()
        const tel = (fd.get('pastor_telefone') as string)?.trim()
        if (!email && (!tel || tel === '+55')) {
          setError(d.s4.pastor_hint)
          setSaving(false)
          return
        }
      }

      const dataRecord: Record<string, string> = {}
      fd.forEach((v, k) => { if (typeof v === 'string') dataRecord[k] = v })
      const saveResult = SECTIONS_COM_ARQUIVO.has(sections[currentIndex].id)
        ? await salvarSecaoObreiroComArquivos(slug, token, sections[currentIndex].id, fd)
        : await salvarSecaoObreiro(slug, token, sections[currentIndex].id, dataRecord)
      if (!('error' in saveResult)) {
        setLocalData(prev => ({ ...prev, [`s${sections[currentIndex].id}`]: dataRecord }))
      }
      if ('error' in saveResult) throw new Error(saveResult.error)

      if (isLast) {
        const submitResult = await enviarFormularioObreiro(slug, token)
        if ('error' in submitResult) throw new Error(submitResult.error)
        setSubmitted(true)
      } else {
        setCurrent(sections[currentIndex + 1].id)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : d.nav.error_save)
    } finally {
      setSaving(false)
    }
  }

  if (submitted) {
    return <SubmittedScreen slug={slug} applicationId={applicationId} orgName={orgName} d={d} />
  }

  return (
    <DictCtx.Provider value={d}>
    <div>
      <div className="flex justify-end mb-4">
        <LangSwitcher lang={lang} onChange={l => setLang(l as StaffLang)} uiLabel={d.langSwitcher.label} />
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-500">
            {tStaff(d.nav.section_of, { n: String(currentIndex + 1), total: String(sections.length) })}
          </span>
          <span className="text-xs font-semibold text-amber-600">{progress}%</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-amber-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }} />
        </div>
      </div>

      <form ref={formRef} onSubmit={handleNext} className="space-y-6">
        {sections[currentIndex].component}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-6 border-t border-gray-100">
          {currentIndex > 0 ? (
            <button type="button" onClick={handleBack}
              className="w-full sm:w-auto px-6 py-3 sm:py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-center">
              {d.nav.back}
            </button>
          ) : <div className="hidden sm:block" />}

          <button type="submit" disabled={saving}
            className="w-full sm:w-auto px-8 py-3 sm:py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors text-center">
            {saving ? d.nav.saving : isLast ? d.nav.submit : d.nav.next}
          </button>
        </div>
      </form>
    </div>
    </DictCtx.Provider>
  )
}
