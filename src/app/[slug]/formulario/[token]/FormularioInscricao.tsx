'use client'

import { useRef, useState, useContext, createContext, useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { getFormDict, normalizeLang, t } from '@/lib/i18n/forms'
import type { FormDict, Lang } from '@/lib/i18n/forms'
import { HeartHandshake, Camera, IdCard, FileText } from 'lucide-react'
import { ptDict } from '@/lib/i18n/forms'
import { orgShortName } from '@/lib/orgShortName'
import { LangSwitcher } from '@/components/ui/LangSwitcher'
import { PhotoFramingGuide } from '@/components/ui/PhotoFramingGuide'

// ── Contexts ────────────────────────────────────────────────────────────────

// Dictionary context — avoids prop drilling through all 16 sections
const DictCtx = createContext<FormDict>(ptDict)

// Context para campos ocultos — evita prop-drilling em todas as seções
const HiddenCtx = createContext<Set<string>>(new Set())
// Wrapper: oculta o campo se ele estiver na lista de hidden_fields da escola
function H({ id, children }: { id: string; children: React.ReactNode }) {
  const hidden = useContext(HiddenCtx)
  if (hidden.has(id)) return null
  return <>{children}</>
}
// HiddenStyles: injeta CSS que oculta campos pelo atributo name (para campos sem wrapper H)
function HiddenStyles() {
  const hidden = useContext(HiddenCtx)
  if (!hidden.size) return null
  const selectors = [...hidden].map(f => {
    const field = f.split('.').slice(1).join('.')
    return `[data-field="${field}"]`
  }).join(',')
  return <style>{`${selectors}{display:none!important}`}</style>
}
import { salvarSecao, enviarFormulario, gerarLinkReferencia, anexarComprovante, anexarDocumentos, atualizarSecaoAtual } from './actions'
import { InternationalPhoneField } from '@/components/ui/InternationalPhoneField'
import { MaskedInput, useMask } from '@/components/ui/MaskedInput'
import { FileInputField } from '@/components/ui/FileInputField'

type Prefill = {
  nome?: string
  email?: string
  telefone?: string
  idioma?: string
}

type DocumentUrls = Record<string, { url: string; name: string; type: string; size?: number }>

type Props = {
  slug: string
  token: string
  applicationId: string
  schoolName: string
  orgName: string
  className?: string
  prefill?: Prefill
  initialSection?: number
  initialData?: Record<string, unknown>
  hiddenFields?: string[]
  paymentInfo?: string | null
  initialLang?: string
  printMode?: boolean
  documentUrls?: DocumentUrls
}

// ── Helpers ────────────────────────────────────────────────────────────────

// Sem min/max o <input type="date"> deixa digitar qualquer quantidade de
// dígitos no ano — trava nascimento entre 1900/hoje e chegada/saída até 2100.
const DATE_MIN = '1900-01-01'
const DATE_MAX = new Date().toISOString().slice(0, 10)

function Field({ label, name, defaultValue, placeholder, required, type = 'text', maxLength, min, max }: {
  label: string; name: string; defaultValue?: string; placeholder?: string
  required?: boolean; type?: string; maxLength?: number; min?: string; max?: string
}) {
  const isBirthDate = name === 'data_nascimento'
  return (
    <div data-field={name}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input name={name} type={type} defaultValue={defaultValue} placeholder={placeholder}
        required={required} maxLength={maxLength}
        min={type === 'date' ? (min ?? DATE_MIN) : undefined}
        max={type === 'date' ? (max ?? (isBirthDate ? DATE_MAX : '2100-12-31')) : undefined}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50" />
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
        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50 resize-none" />
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
        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50">
        <option value="" disabled>{d.nav.select_placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function SectionTitle({ number, title }: { number: string; title: string }) {
  return (
    <div className="mb-6">
      <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest">{number}</span>
      <h2 className="text-xl font-bold text-gray-900 mt-1">{title}</h2>
      <div className="h-0.5 bg-indigo-100 mt-3" />
    </div>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-800 leading-relaxed">
      {children}
    </div>
  )
}

// ── Seções ─────────────────────────────────────────────────────────────────

function S1Nome({ prefill, data }: { prefill?: Prefill; data?: Record<string, string> }) {
  const d = useContext(DictCtx)
  return (
    <div className="space-y-4">
      <SectionTitle number={d.s1.section} title={d.s1.title} />
      <Field label={d.s1.nome} name="nome" type="text"
        defaultValue={data?.nome ?? prefill?.nome} required />
    </div>
  )
}

function S3Termo({ data }: { data?: Record<string, string> }) {
  const d = useContext(DictCtx)
  const hidden = useContext(HiddenCtx)
  // Filtra antes de numerar, pra não deixar buraco na numeração quando a
  // escola esconde um item específico (ex: pular direto de "8." pra "9.").
  const visibleTerms = d.s3.terms
    .map((term, i) => ({ term, key: `termo_${i + 1}` }))
    .filter(({ key }) => !hidden.has(`s3.${key}`))
  return (
    <div className="space-y-5">
      <SectionTitle number={d.s3.section} title={d.s3.title} />
      <div className="space-y-2">
        {visibleTerms.map(({ term, key }, i) => (
          <label key={key} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-indigo-200 cursor-pointer">
            <input type="checkbox" name={key} value="sim"
              defaultChecked={data?.[key] === 'sim'} required
              className="mt-0.5 accent-indigo-600 flex-shrink-0" />
            <span className="text-sm text-gray-700">{i + 1}. {term}</span>
          </label>
        ))}
      </div>
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" name="aceite_termos" value="sim"
            defaultChecked={data?.aceite_termos === 'sim'} required
            className="mt-0.5 accent-yellow-600 flex-shrink-0" />
          <span className="text-sm font-semibold text-yellow-800">
            {d.s3.aceite}
          </span>
        </label>
      </div>
    </div>
  )
}

function S4Escola({ schoolName, className, data, orgName }: { schoolName: string; className?: string; data?: Record<string, string>; orgName: string }) {
  const d = useContext(DictCtx)
  return (
    <div className="space-y-4">
      <SectionTitle number={d.s4.section} title={d.s4.title} />
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={d.s4.escola} name="escola" defaultValue={data?.escola ?? schoolName} required />
        <Field label={d.s4.turma} name="turma" defaultValue={data?.turma ?? className ?? ''} />
        <H id="s4.como_conheceu"><div className="sm:col-span-2">
          <Select label={d.s4.como_conheceu} name="como_conheceu" required
            defaultValue={data?.como_conheceu}
            options={[
              { value: 'indicacao', label: d.s4.how_know_indicacao },
              { value: 'redes_sociais', label: d.s4.how_know_redes },
              { value: 'site', label: d.s4.how_know_site },
              { value: 'evento', label: d.s4.how_know_evento },
              { value: 'church', label: d.s4.how_know_church },
              { value: 'outro', label: d.s4.how_know_outro },
            ]} />
        </div></H>
        <H id="s4.como_conheceu_jocum"><div className="sm:col-span-2">
          <Field label={t(d.s4.como_conheceu_jocum, { orgName: orgShortName(orgName) })} name="como_conheceu_jocum" defaultValue={data?.como_conheceu_jocum} />
        </div></H>
        <H id="s4.conversou_equipe"><Select label={d.s4.conversou_equipe}
          name="conversou_equipe" required defaultValue={data?.conversou_equipe}
          options={[
            { value: 'sim', label: d.s4.conversou_sim },
            { value: 'nao', label: d.s4.conversou_nao },
          ]} /></H>
        <H id="s4.conversou_com_quem"><Field label={d.s4.conversou_com_quem} name="conversou_com_quem"
          defaultValue={data?.conversou_com_quem} /></H>
        <H id="s4.motivacao"><div className="sm:col-span-2">
          <TextArea label={d.s4.motivacao} name="motivacao"
            defaultValue={data?.motivacao} required rows={4} />
        </div></H>
        <H id="s4.data_chegada">
          <Field label={d.s4.data_chegada} name="data_chegada" type="date" defaultValue={data?.data_chegada} />
        </H>
        <H id="s4.horario_chegada">
          <Field label={d.s4.horario_chegada} name="horario_chegada" type="time" defaultValue={data?.horario_chegada} />
        </H>
        <H id="s4.data_chegada">
          <p className="sm:col-span-2 text-xs text-gray-400 -mt-2">{d.s4.data_chegada_hint}</p>
        </H>
        <H id="s4.data_saida">
          <Field label={d.s4.data_saida} name="data_saida" type="date" defaultValue={data?.data_saida} />
        </H>
        <H id="s4.horario_saida">
          <Field label={d.s4.horario_saida} name="horario_saida" type="time" defaultValue={data?.horario_saida} />
        </H>
      </div>
    </div>
  )
}

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
    } catch { /* sem auto-fill, usuário preenche manualmente */ }
    setLoadingCep(false)
  }

  return (
    <>
      <div className="sm:col-span-2 mt-2"><p className="text-sm font-semibold text-gray-700 border-t pt-3">{d.s5.endereco_section}</p></div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{d.s5.cep}</label>
        <input name="cep" value={cep} onChange={e => setCepRaw(e.target.value)} onBlur={handleCepBlur}
          placeholder="00000-000" maxLength={9} inputMode="numeric"
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50" />
        {loadingCep && <p className="text-xs text-indigo-500 mt-1">{d.nav.loading_cep}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{d.s5.bairro}</label>
        <input name="bairro" value={bairro} onChange={e => setBairro(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50" />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">{d.s5.endereco_rua}</label>
        <input name="endereco" value={endereco} onChange={e => setEndereco(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{d.s5.cidade} <span className="text-red-500">*</span></label>
        <input name="cidade" value={cidade} onChange={e => setCidade(e.target.value)} required
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{d.s5.estado} <span className="text-red-500">*</span></label>
        <input name="estado" value={estado} onChange={e => setEstado(e.target.value)} required
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50" />
      </div>
    </>
  )
}

function ZipAddressFields({ data }: { data?: Record<string, string> }) {
  const d = useContext(DictCtx)
  return (
    <>
      <div className="sm:col-span-2 mt-2"><p className="text-sm font-semibold text-gray-700 border-t pt-3">{d.s5.endereco_section}</p></div>
      <Field label={d.s5.cep} name="cep" defaultValue={data?.cep} placeholder={d.s5.zip_placeholder} />
      <Field label={d.s5.bairro} name="bairro" defaultValue={data?.bairro} />
      <div className="sm:col-span-2">
        <Field label={d.s5.endereco_rua} name="endereco" defaultValue={data?.endereco} />
      </div>
      <Field label={d.s5.cidade} name="cidade" defaultValue={data?.cidade} required />
      <Field label={d.s5.estado} name="estado" defaultValue={data?.estado} required />
    </>
  )
}

function S5Dados({ prefill, data, onNationalityChange }: {
  prefill?: Prefill
  data?: Record<string, string>
  onNationalityChange?: (isBrazilian: boolean) => void
}) {
  const d = useContext(DictCtx)
  const hidden = useContext(HiddenCtx)
  const [estrangeiro, setEstrangeiro] = useState(data?.is_brasileiro === 'nao')
  const [estudando, setEstudando] = useState(data?.estudando === 'sim')

  function handleNationality(e: React.ChangeEvent<HTMLSelectElement>) {
    const isForeigner = e.target.value === 'nao'
    setEstrangeiro(isForeigner)
    onNationalityChange?.(!isForeigner)
  }

  // Se a escola escondeu os documentos que apareceriam nesse ramo (RG/CPF/
  // Passaporte pra brasileiro, só Passaporte pra estrangeiro), não sobra
  // nada pra pedir — some com a seção inteira em vez de mostrar o título e
  // o aviso "preencha ao menos um" sem nenhum campo embaixo.
  const showDocumentos = estrangeiro
    ? !hidden.has('s5.passaporte')
    : !hidden.has('s5.rg') || !hidden.has('s5.cpf') || !hidden.has('s5.passaporte')

  return (
    <div className="space-y-4">
      <SectionTitle number={d.s5.section} title={d.s5.title} />
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={d.s5.email} name="email" type="email"
          defaultValue={data?.email ?? prefill?.email} required />
        <Select label={d.s5.sexo} name="sexo" required defaultValue={data?.sexo} options={[
          { value: 'M', label: d.opts.gender_m },
          { value: 'F', label: d.opts.gender_f },
        ]} />
        <Field label={d.s5.data_nascimento} name="data_nascimento" type="date"
          defaultValue={data?.data_nascimento} required />
        <H id="s5.estado_civil">
          <Select label={d.s5.estado_civil} name="estado_civil" required defaultValue={data?.estado_civil} options={[
            { value: 'solteiro', label: d.s5.solteiro },
            { value: 'casado', label: d.s5.casado },
            { value: 'comprometido', label: d.s5.comprometido },
            { value: 'divorciado', label: d.s5.divorciado },
            { value: 'viuvo', label: d.s5.viuvo },
          ]} />
        </H>
        <Select label={d.s5.is_brasileiro} name="is_brasileiro" required
          defaultValue={data?.is_brasileiro}
          options={[
            { value: 'sim', label: d.s5.is_brasileiro_sim },
            { value: 'nao', label: d.s5.is_brasileiro_nao },
          ]} onChange={handleNationality} />
        {estrangeiro && <>
          <Field label={d.s5.nacionalidade} name="nacionalidade"
            defaultValue={data?.nacionalidade} required />
          <Select label={d.s5.fluencia_portugues} name="fluencia_portugues"
            defaultValue={data?.fluencia_portugues}
            options={[
              { value: 'basico', label: d.opts.basic },
              { value: 'intermediario', label: d.opts.intermediate },
              { value: 'avancado', label: d.opts.advanced },
              { value: 'fluente', label: d.opts.fluent },
            ]} />
        </>}

        {/* Formação */}
        <div className="sm:col-span-2 mt-2"><p className="text-sm font-semibold text-gray-700 border-t pt-3">{d.s5.formacao_section}</p></div>
        <Field label={d.s5.formacao} name="formacao" defaultValue={data?.formacao} />
        <H id="s5.estudando">
          <Select label={d.s5.estudando} name="estudando" required
            defaultValue={data?.estudando}
            options={[
              { value: 'sim', label: d.opts.yes },
              { value: 'nao', label: d.opts.no },
            ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEstudando(e.target.value === 'sim')} />
          {estudando && (
            <div className="sm:col-span-2">
              <Field label={d.s5.curso_atual} name="curso_atual" defaultValue={data?.curso_atual} />
            </div>
          )}
        </H>
        <Field label={d.s5.profissao} name="profissao" defaultValue={data?.profissao} />
        <H id="s5.trabalha">
          <Select label={d.s5.trabalha} name="trabalha" required defaultValue={data?.trabalha} options={[
            { value: 'sim', label: d.opts.yes },
            { value: 'nao', label: d.opts.no },
          ]} />
        </H>
        <H id="s5.experiencias"><div className="sm:col-span-2">
          <TextArea label={d.s5.experiencias} name="experiencias"
            defaultValue={data?.experiencias} rows={3} />
        </div></H>
        <H id="s5.habilidades"><div className="sm:col-span-2">
          <TextArea label={d.s5.habilidades} name="habilidades" defaultValue={data?.habilidades} rows={3} />
        </div></H>

        {/* Idiomas — field names are fixed (DB keys), only labels are translated */}
        <div className="sm:col-span-2 mt-2"><p className="text-sm font-semibold text-gray-700 border-t pt-3">{d.s5.idiomas_section}</p></div>
        {([
          { label: d.s5.idioma_portugues, name: 'idioma_português', defaultNativo: true },
          { label: d.s5.idioma_ingles,    name: 'idioma_inglês',    defaultNativo: false },
          { label: d.s5.idioma_espanhol,  name: 'idioma_espanhol',  defaultNativo: false },
        ] as { label: string; name: string; defaultNativo: boolean }[]).map(({ label, name, defaultNativo }) => (
          <div key={name}>
            <Select label={label} name={name}
              defaultValue={data?.[name] ?? (defaultNativo ? 'nativo' : '')}
              options={[
                { value: 'nativo',        label: d.opts.native },
                { value: 'basico',        label: d.opts.basic },
                { value: 'intermediario', label: d.opts.intermediate },
                { value: 'avancado',      label: d.opts.advanced },
                { value: 'fluente',       label: d.opts.fluent },
                { value: 'nao_falo',      label: d.opts.dont_speak },
              ]} />
          </div>
        ))}
        <Field label={d.s5.outro_idioma} name="outro_idioma"
          defaultValue={data?.outro_idioma} placeholder={d.s5.outro_idioma_placeholder} />

        {/* Documentos */}
        {showDocumentos && (<>
          <div className="sm:col-span-2 mt-2">
            <p className="text-sm font-semibold text-gray-700 border-t pt-3">{d.s5.documentos_section}</p>
            {!estrangeiro && <p className="text-xs text-gray-400 mt-1">{d.s5.documentos_hint}</p>}
          </div>
          {!estrangeiro ? (<>
            <H id="s5.rg"><MaskedInput mask="rg" name="rg" label={d.s5.rg} defaultValue={data?.rg} /></H>
            <H id="s5.cpf"><MaskedInput mask="cpf" name="cpf" label={d.s5.cpf} defaultValue={data?.cpf} /></H>
            <H id="s5.passaporte"><Field label={d.s5.passaporte_opcional} name="passaporte" defaultValue={data?.passaporte} maxLength={20} /></H>
          </>) : (<>
            <H id="s5.passaporte"><div className="sm:col-span-2">
              <Field label={d.s5.passaporte_required} name="passaporte" defaultValue={data?.passaporte}
                required maxLength={20} placeholder="Ex: AB123456" />
            </div></H>
          </>)}
        </>)}
        <H id="s5.servico_militar">
          <Select label={d.s5.servico_militar} name="servico_militar"
            defaultValue={data?.servico_militar}
            options={[
              { value: 'sim', label: d.s5.sm_sim },
              { value: 'nao', label: d.s5.sm_nao },
              { value: 'nao_aplicavel', label: d.s5.sm_na },
            ]} />
        </H>

        {/* Endereço */}
        <H id="s5.endereco_bloco"><>
          {!estrangeiro
            ? <CepAddressFields data={data} />
            : <ZipAddressFields data={data} />
          }
          <Field label={d.s5.pais} name="pais" defaultValue={data?.pais ?? (estrangeiro ? '' : 'Brasil')} required />
        </></H>

        {/* Redes sociais */}
        <H id="s5.redes_bloco"><>
          <div className="sm:col-span-2 mt-2"><p className="text-sm font-semibold text-gray-700 border-t pt-3">{d.s5.redes_section}</p></div>
          <Field label="Instagram" name="instagram" defaultValue={data?.instagram} placeholder="@usuario" />
          <Field label="Facebook" name="facebook" defaultValue={data?.facebook} />
          <Field label="TikTok" name="tiktok" defaultValue={data?.tiktok} />
          <Field label="LinkedIn" name="linkedin" defaultValue={data?.linkedin} />
          <div className="sm:col-span-2">
            <Field label={d.s5.outros_links} name="outros_links" defaultValue={data?.outros_links} />
          </div>
        </></H>

        {/* Emergência */}
        <div className="sm:col-span-2 mt-2"><p className="text-sm font-semibold text-gray-700 border-t pt-3">{d.s5.emergencia_section}</p></div>
        <p className="sm:col-span-2 text-xs text-gray-500">{d.s5.emergencia_hint}</p>
        <Field label={d.s5.emergencia_nome} name="emergencia_nome" defaultValue={data?.emergencia_nome} required />
        <Field label={d.s5.emergencia_parentesco} name="emergencia_parentesco" defaultValue={data?.emergencia_parentesco} required />
        <InternationalPhoneField phoneName="emergencia_telefone" countryName="emergencia_telefone_country"
          label={d.s5.celular} defaultCountryIso="BR"
          defaultPhone={data?.emergencia_telefone} required />
        <Field label={d.s5.emergencia_email} name="emergencia_email" type="email" defaultValue={data?.emergencia_email} />
        <Field label={d.s5.emergencia_cidade} name="emergencia_cidade" defaultValue={data?.emergencia_cidade} />

        <InternationalPhoneField phoneName="celular" countryName="celular_country"
          label={d.s5.celular} defaultCountryIso="BR" defaultPhone={data?.celular ?? prefill?.telefone} />
      </div>
    </div>
  )
}

function anosDesde(dateStr: string): number | null {
  if (!dateStr) return null
  const then = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(then.getTime())) return null
  const now = new Date()
  let years = now.getFullYear() - then.getFullYear()
  const beforeAnniversary = now.getMonth() < then.getMonth() ||
    (now.getMonth() === then.getMonth() && now.getDate() < then.getDate())
  if (beforeAnniversary) years -= 1
  return years >= 0 ? years : null
}

function idadeCrianca(dateStr: string, d: FormDict): string | null {
  if (!dateStr) return null
  const then = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(then.getTime())) return null
  const now = new Date()
  if (then > now) return null
  let years = now.getFullYear() - then.getFullYear()
  let months = now.getMonth() - then.getMonth()
  if (now.getDate() < then.getDate()) months -= 1
  if (months < 0) { years -= 1; months += 12 }
  if (years < 0) return null
  if (years >= 5) return t(d.s7.filhos_idade_anos, { anos: String(years) })
  if (years === 0) return t(d.s7.filhos_idade_meses, { meses: String(months) })
  if (months === 0) return t(d.s7.filhos_idade_anos, { anos: String(years) })
  return t(d.s7.filhos_idade_anos_meses, { anos: String(years), meses: String(months) })
}

type ChildEntry = { nome: string; sexo: string; data_nascimento: string }

function parseChildren(raw?: string): ChildEntry[] {
  if (!raw) return [{ nome: '', sexo: '', data_nascimento: '' }]
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length) {
      return parsed.map((r: unknown) => {
        const row = (r ?? {}) as Partial<ChildEntry>
        return { nome: row.nome ?? '', sexo: row.sexo ?? '', data_nascimento: row.data_nascimento ?? '' }
      })
    }
  } catch { /* valor legado em texto livre, cai no fallback abaixo */ }
  return raw.trim() ? [{ nome: raw, sexo: '', data_nascimento: '' }] : [{ nome: '', sexo: '', data_nascimento: '' }]
}

function ChildrenField({ data }: { data?: string }) {
  const d = useContext(DictCtx)
  const [rows, setRows] = useState<ChildEntry[]>(() => parseChildren(data))

  function updateRow(i: number, patch: Partial<ChildEntry>) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }
  function addRow() {
    setRows(prev => [...prev, { nome: '', sexo: '', data_nascimento: '' }])
  }
  function removeRow(i: number) {
    setRows(prev => prev.filter((_, idx) => idx !== i))
  }

  const filled = rows.filter(r => r.nome.trim())
  const serialized = JSON.stringify(filled)
  const inputClass = "w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50"

  return (
    <div className="sm:col-span-2 space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">{d.s7.filhos_dados}</label>
        <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
          {t(d.s7.filhos_contagem, { count: String(filled.length) })}
        </span>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="relative rounded-xl border border-gray-200 bg-white p-3 space-y-2">
          {rows.length > 1 && (
            <button type="button" onClick={() => removeRow(i)} aria-label={d.s7.filhos_remove}
              className="absolute top-2 right-2 text-gray-400 hover:text-red-500 text-sm">✕</button>
          )}
          <input type="text" value={row.nome} onChange={e => updateRow(i, { nome: e.target.value })}
            placeholder={d.s7.filhos_nome_ph} required className={`${inputClass} pr-8`} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">{d.s7.filhos_sexo}</label>
              <select value={row.sexo} onChange={e => updateRow(i, { sexo: e.target.value })} className={inputClass}>
                <option value="" disabled>{d.nav.select_placeholder}</option>
                <option value="M">{d.opts.gender_m}</option>
                <option value="F">{d.opts.gender_f}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">{d.s7.filhos_nascimento}</label>
              <input type="date" value={row.data_nascimento} max={new Date().toISOString().slice(0, 10)}
                onChange={e => updateRow(i, { data_nascimento: e.target.value })} className={inputClass} />
              {row.data_nascimento && (
                <p className="text-xs text-indigo-700 mt-1">{idadeCrianca(row.data_nascimento, d)}</p>
              )}
            </div>
          </div>
        </div>
      ))}
      <button type="button" onClick={addRow}
        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
        {d.s7.filhos_add}
      </button>
      <input type="hidden" name="filhos_dados" value={serialized} readOnly />
    </div>
  )
}

function S6Historia({ data }: { data?: Record<string, string> }) {
  const d = useContext(DictCtx)
  return (
    <div className="space-y-4">
      <SectionTitle number={d.s6.section} title={d.s6.title} />
      <div className="grid grid-cols-1 gap-4">
        <TextArea label={d.s6.sobre_voce} name="sobre_voce" defaultValue={data?.sobre_voce} required rows={5} />
        <TextArea label={d.s6.processo_decisao} name="processo_decisao"
          defaultValue={data?.processo_decisao} required rows={4} />
        <TextArea label={d.s6.expectativas} name="expectativas"
          defaultValue={data?.expectativas} required rows={4} />
        <TextArea label={d.s6.motivacoes} name="motivacoes"
          defaultValue={data?.motivacoes} required rows={3} />
        <TextArea label={d.s6.responsabilidades}
          name="responsabilidades" defaultValue={data?.responsabilidades} rows={3} />
      </div>
    </div>
  )
}

function S7Familia({ data, estadoCivilS5 }: { data?: Record<string, string>; estadoCivilS5?: string }) {
  const d = useContext(DictCtx)
  const initialCivil = data?.estado_civil_atual ?? estadoCivilS5 ?? ''
  const estadoCivil = initialCivil
  const [temFilhos, setTemFilhos] = useState(data?.tem_filhos === 'sim')
  const [filhosVirao, setFilhosVirao] = useState(data?.filhos_virao ?? '')
  const [dataCasamento, setDataCasamento] = useState(data?.data_casamento ?? '')
  const anosCasados = anosDesde(dataCasamento)

  const civilMap: Record<string, string> = {
    solteiro: d.s5.solteiro,
    casado: d.s5.casado,
    comprometido: d.s5.comprometido,
    divorciado: d.s5.divorciado,
    viuvo: d.s5.viuvo,
  }

  return (
    <div className="space-y-4">
      <SectionTitle number={d.s7.section} title={d.s7.title} />
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={d.s7.nome_pai} name="nome_pai" defaultValue={data?.nome_pai} />
        <Field label={d.s7.nome_mae} name="nome_mae" defaultValue={data?.nome_mae} />
        <Select label={d.s7.pais_cristaos} name="pais_cristaos" defaultValue={data?.pais_cristaos} options={[
          { value: 'ambos', label: d.s7.pc_ambos },
          { value: 'apenas_um', label: d.s7.pc_apenas_um },
          { value: 'nenhum', label: d.s7.pc_nenhum },
        ]} />
        <Select label={d.s7.familia_apoia} name="familia_apoia" required
          defaultValue={data?.familia_apoia} options={[
            { value: 'sim', label: d.opts.yes },
            { value: 'parcialmente', label: d.opts.partially },
            { value: 'nao', label: d.opts.no },
          ]} />
        <div className="sm:col-span-2">
          <TextArea label={d.s7.situacao_familiar}
            name="situacao_familiar" defaultValue={data?.situacao_familiar} rows={3} />
        </div>

        <input type="hidden" name="estado_civil_atual" value={estadoCivil || initialCivil} />
        {(estadoCivil || initialCivil) && (
          <div className="sm:col-span-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-600">
            {d.s5.civil_label} <strong>
              {civilMap[estadoCivil || initialCivil] ?? (estadoCivil || initialCivil)}
            </strong>
            <span className="text-xs text-gray-400 ml-2">{d.s5.civil_from_s5}</span>
          </div>
        )}

        {(estadoCivil === 'casado' || initialCivil === 'casado') && <>
          <Field label={d.s7.conjuge_nome_idade} name="conjuge_nome_idade" defaultValue={data?.conjuge_nome_idade} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{d.s7.data_casamento}</label>
            <input type="date" name="data_casamento" value={dataCasamento} max={new Date().toISOString().slice(0, 10)}
              onChange={e => setDataCasamento(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50" />
            {anosCasados !== null && (
              <p className="text-xs text-indigo-700 mt-1">{t(d.s7.data_casamento_anos, { anos: String(anosCasados) })}</p>
            )}
          </div>
          <Select label={d.s7.conjuge_apoia} name="conjuge_apoia" defaultValue={data?.conjuge_apoia} options={[
            { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
          ]} />
          <Select label={d.s7.conjuge_participa} name="conjuge_participa" defaultValue={data?.conjuge_participa} options={[
            { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
          ]} />
        </>}

        {(estadoCivil === 'comprometido' || initialCivil === 'comprometido') && <>
          <Field label={d.s7.tempo_compromisso} name="tempo_compromisso" defaultValue={data?.tempo_compromisso} />
          <Select label={d.s7.compromisso_apoia} name="compromisso_apoia" defaultValue={data?.compromisso_apoia} options={[
            { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
          ]} />
          <div className="sm:col-span-2">
            <TextArea label={d.s7.situacao_relacional} name="situacao_relacional"
              defaultValue={data?.situacao_relacional} rows={2} />
          </div>
        </>}

        <div className="sm:col-span-2 mt-2">
          <Select label={d.s7.tem_filhos} name="tem_filhos" defaultValue={data?.tem_filhos} options={[
            { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
          ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            setTemFilhos(e.target.value === 'sim')
            setFilhosVirao('')
          }} />
        </div>
        {temFilhos && <>
          <ChildrenField data={data?.filhos_dados} />
          <Select label={d.s7.filhos_virao} name="filhos_virao" defaultValue={data?.filhos_virao} options={[
            { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
          ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilhosVirao(e.target.value)} />
          {(filhosVirao === 'nao' || (data?.filhos_virao === 'nao' && !filhosVirao)) && (
            <Field label={d.s7.filhos_ficam_com} name="filhos_ficam_com"
              defaultValue={data?.filhos_ficam_com} />
          )}
        </>}
      </div>
    </div>
  )
}

function S8Igreja({ data }: { data?: Record<string, string> }) {
  const d = useContext(DictCtx)
  const [participa, setParticipa] = useState(data?.tem_ministerio === 'sim')
  const [lideranca, setLideranca] = useState(data?.tem_lideranca === 'sim')
  const [conversou, setConversou] = useState(data?.conversou_pastor === 'sim')
  return (
    <div className="space-y-4">
      <SectionTitle number={d.s8.section} title={d.s8.title} />
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Field label={d.s8.igreja_nome} name="igreja_nome" defaultValue={data?.igreja_nome} required />
        </div>
        <Field label={d.s8.igreja_cidade} name="igreja_cidade" defaultValue={data?.igreja_cidade} required />
        <Field label={d.s8.tempo_igreja} name="tempo_igreja" defaultValue={data?.tempo_igreja} required />
        <Select label={d.s8.membro_oficial} name="membro_oficial" defaultValue={data?.membro_oficial} options={[
          { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
        ]} />
        <Select label={d.s8.tem_ministerio} name="tem_ministerio" defaultValue={data?.tem_ministerio} options={[
          { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
        ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setParticipa(e.target.value === 'sim')} />
        {participa && <>
          <Field label={d.s8.ministerio_qual} name="ministerio_qual" defaultValue={data?.ministerio_qual} />
          <Field label={d.s8.ministerio_tempo} name="ministerio_tempo" defaultValue={data?.ministerio_tempo} />
          <Select label={d.s8.tem_lideranca} name="tem_lideranca" defaultValue={data?.tem_lideranca} options={[
            { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
          ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLideranca(e.target.value === 'sim')} />
          {lideranca && <Field label={d.s8.lideranca_cargo} name="lideranca_cargo" defaultValue={data?.lideranca_cargo} />}
          <div className="sm:col-span-2">
            <TextArea label={d.s8.responsabilidades_igreja} name="responsabilidades_igreja"
              defaultValue={data?.responsabilidades_igreja} rows={3} />
          </div>
        </>}

        <H id="s8.pastor_bloco"><div className="sm:col-span-2 mt-2 border-t pt-3">
          <p className="text-sm font-semibold text-gray-700 mb-3">{d.s8.pastor_section}</p>
        </div></H>
        <H id="s8.pastor_bloco"><Select label={d.s8.conversou_pastor} name="conversou_pastor" required
          defaultValue={data?.conversou_pastor}
          options={[
            { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
          ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setConversou(e.target.value === 'sim')} /></H>
        {conversou && (
          <H id="s8.pastor_bloco"><Select label={d.s8.pastor_concorda} name="pastor_concorda"
            defaultValue={data?.pastor_concorda}
            options={[
              { value: 'sim', label: d.s8.pastor_pc_sim },
              { value: 'parcialmente', label: d.s8.pastor_pc_parcialmente },
              { value: 'nao', label: d.s8.pastor_pc_nao },
            ]} /></H>
        )}
        <H id="s8.pastor_bloco"><Field label={d.s8.pastor_nome} name="pastor_nome" defaultValue={data?.pastor_nome} required /></H>
        <H id="s8.pastor_bloco"><Field label={d.s8.pastor_cargo} name="pastor_cargo" defaultValue={data?.pastor_cargo} /></H>
        <H id="s8.pastor_bloco"><Field label={d.s8.pastor_email} name="pastor_email" type="email" defaultValue={data?.pastor_email} /></H>
        <H id="s8.pastor_bloco"><InternationalPhoneField phoneName="pastor_telefone" countryName="pastor_telefone_country"
          label={d.s8.pastor_telefone} defaultCountryIso="BR"
          defaultPhone={data?.pastor_telefone} /></H>
        <H id="s8.pastor_bloco"><div className="sm:col-span-2">
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            {d.s8.pastor_hint}
          </p>
        </div></H>
        <H id="s8.pastor_bloco"><div className="sm:col-span-2">
          <InfoBox>{d.s8.pastor_infobox}</InfoBox>
        </div></H>
      </div>
    </div>
  )
}

function S9Referencia({ data }: { data?: Record<string, string> }) {
  const d = useContext(DictCtx)
  return (
    <div className="space-y-4">
      <SectionTitle number={d.s9.section} title={d.s9.title} />
      <InfoBox>{d.s9.infobox}</InfoBox>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Field label={d.s9.ref_nome} name="ref_nome" defaultValue={data?.ref_nome} required />
        </div>
        <Field label={d.s9.ref_relacionamento} name="ref_relacionamento"
          defaultValue={data?.ref_relacionamento} required />
        <Field label={d.s9.ref_tempo} name="ref_tempo" defaultValue={data?.ref_tempo} required />
        <Select label={d.s9.ref_crista} name="ref_crista" defaultValue={data?.ref_crista} options={[
          { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
        ]} />
        <Field label={d.s9.ref_email} name="ref_email" type="email" defaultValue={data?.ref_email} required />
        <InternationalPhoneField phoneName="ref_telefone" countryName="ref_telefone_country"
          label={d.s9.ref_telefone} defaultCountryIso="BR"
          defaultPhone={data?.ref_telefone} required />
      </div>
    </div>
  )
}

function S10Historico({ data }: { data?: Record<string, string> }) {
  const d = useContext(DictCtx)
  const [teve, setTeve] = useState(data?.teve_historico === 'sim')
  return (
    <div className="space-y-4">
      <SectionTitle number={d.s10.section} title={d.s10.title} />
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Select label={d.s10.teve_historico} name="teve_historico"
            required defaultValue={data?.teve_historico}
            options={[
              { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
            ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTeve(e.target.value === 'sim')} />
        </div>
        {teve && <>
          <div className="sm:col-span-2">
            <Field label={d.s10.hist_qual} name="hist_qual" defaultValue={data?.hist_qual} />
          </div>
          <Field label={d.s10.hist_org} name="hist_org" defaultValue={data?.hist_org} />
          <Field label={d.s10.hist_duracao} name="hist_duracao" defaultValue={data?.hist_duracao} />
          <Field label={d.s10.hist_quando} name="hist_quando" defaultValue={data?.hist_quando} />
          <Field label={d.s10.hist_lider_nome} name="hist_lider_nome" defaultValue={data?.hist_lider_nome} />
          <Field label={d.s10.hist_lider_email} name="hist_lider_email" type="email" defaultValue={data?.hist_lider_email} />
          <InternationalPhoneField phoneName="hist_lider_tel" countryName="hist_lider_tel_country"
            label={d.s10.hist_lider_tel} defaultCountryIso="BR" defaultPhone={data?.hist_lider_tel} />
          <div className="sm:col-span-2">
            <InfoBox>{d.s10.infobox}</InfoBox>
          </div>
        </>}
      </div>
    </div>
  )
}

const AREAS_AUTOAVALIACAO_KEYS = [
  'liderança', 'obediência', 'vida_devocional', 'facilidade_de_aprender', 'maturidade_pessoal',
  'trabalho_em_equipe', 'habilidade_para_falar_em_público', 'comunicação', 'organização',
  'pontualidade', 'flexibilidade', 'relacionamento_com_autoridade',
  'resolução_de_conflitos', 'capacidade_de_lidar_com_pressão', 'comportamento_em_situações_difíceis',
]

function S11Espiritual({ data }: { data?: Record<string, string> }) {
  const d = useContext(DictCtx)
  const [fezPsico, setFezPsico] = useState(data?.psicologico !== undefined && data?.psicologico !== 'nao')
  const [fezRecup, setFezRecup] = useState(data?.recuperacao === 'sim')
  return (
    <div className="space-y-5">
      <SectionTitle number={d.s11.section} title={d.s11.title} />

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">{d.s11.autoaval_title}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-1/2">
                  {d.lang === 'pt' ? 'Área' : d.lang === 'en' ? 'Area' : 'Área'}
                </th>
                {d.s11.autoaval_cols.map(col => (
                  <th key={col} className="text-center px-2 py-2 font-medium text-gray-600 text-xs">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {d.s11.autoaval_areas.map((area, idx) => {
                const key = `autoaval_${AREAS_AUTOAVALIACAO_KEYS[idx]}`
                const saved = data?.[key]
                return (
                  <tr key={area} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-700">{area}</td>
                    {['otimo', 'bom', 'regular', 'melhorar'].map(val => (
                      <td key={val} className="text-center px-2 py-2">
                        <input type="radio" name={key} value={val} required
                          defaultChecked={saved === val}
                          className="accent-indigo-600" />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="mt-2 border-t pt-3"><p className="text-sm font-semibold text-gray-700">{d.s11.vida_section}</p></div>
        <Field label={d.s11.tempo_convertido} name="tempo_convertido"
          defaultValue={data?.tempo_convertido} required />
        <TextArea label={d.s11.conversao} name="conversao"
          defaultValue={data?.conversao} required rows={4} />
        <TextArea label={d.s11.vida_deus} name="vida_deus"
          defaultValue={data?.vida_deus} required rows={3} />
        <TextArea label={d.s11.devocional} name="devocional"
          defaultValue={data?.devocional} rows={3} />
        <TextArea label={d.s11.crescimento_espiritual} name="crescimento_espiritual"
          defaultValue={data?.crescimento_espiritual} rows={3} />

        <div className="mt-2 border-t pt-3"><p className="text-sm font-semibold text-gray-700">{d.s11.chamado_section}</p></div>
        <Select label={d.s11.chamado} name="chamado" required
          defaultValue={data?.chamado}
          options={[
            { value: 'sim', label: d.s11.chamado_opts[0] },
            { value: 'em_discernimento', label: d.s11.chamado_opts[1] },
            { value: 'nao', label: d.s11.chamado_opts[2] },
          ]} />
        <TextArea label={d.s11.chamado_descricao} name="chamado_descricao"
          defaultValue={data?.chamado_descricao} rows={3} />
        <TextArea label={d.s11.visao_missoes} name="visao_missoes"
          defaultValue={data?.visao_missoes} rows={3} />

        <div className="mt-2 border-t pt-3"><p className="text-sm font-semibold text-gray-700">{d.s11.emocional_section}</p></div>
        <Select label={d.s11.psicologico} name="psicologico" required
          defaultValue={data?.psicologico}
          options={[
            { value: 'sim_faz', label: d.s11.psico_sim_faz },
            { value: 'sim_fez', label: d.s11.psico_sim_fez },
            { value: 'nao', label: d.s11.psico_nao },
          ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFezPsico(e.target.value !== 'nao')} />
        {fezPsico && (
          <TextArea label={d.s11.diagnostico_emocional}
            name="diagnostico_emocional" defaultValue={data?.diagnostico_emocional} rows={3} />
        )}
        <Select label={d.s11.acompanhamento_pastoral} name="acompanhamento_pastoral"
          defaultValue={data?.acompanhamento_pastoral}
          options={[
            { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
          ]} />

        <div className="mt-2 border-t pt-3"><p className="text-sm font-semibold text-gray-700">{d.s11.recuperacao_section}</p></div>
        <Select label={d.s11.recuperacao} name="recuperacao"
          defaultValue={data?.recuperacao}
          options={[
            { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
          ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFezRecup(e.target.value === 'sim')} />
        {fezRecup && <>
          <Field label={d.s11.recuperacao_detalhes} name="recuperacao_detalhes"
            defaultValue={data?.recuperacao_detalhes} />
          <TextArea label={d.s11.recuperacao_hoje} name="recuperacao_hoje"
            defaultValue={data?.recuperacao_hoje} rows={3} />
        </>}
      </div>
    </div>
  )
}

function S12Saude({ data }: { data?: Record<string, string> }) {
  const d = useContext(DictCtx)
  const [usaMed, setUsaMed] = useState(data?.usa_medicamento === 'sim')
  const [planoSaude, setPlanoSaude] = useState(data?.plano_saude === 'sim')
  return (
    <div className="space-y-4">
      <SectionTitle number={d.s12.section} title={d.s12.title} />
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <TextArea label={d.s12.saude_geral} name="saude_geral"
            defaultValue={data?.saude_geral} rows={3} />
        </div>
        <Field label={d.s12.alergias} name="alergias" defaultValue={data?.alergias} />
        <Field label={d.s12.restricao_alimentar} name="restricao_alimentar" defaultValue={data?.restricao_alimentar} />
        <Field label={d.s12.limitacao_fisica} name="limitacao_fisica" defaultValue={data?.limitacao_fisica} />
        <H id="s12.cirurgias"><div className="sm:col-span-2">
          <Field label={d.s12.cirurgias} name="cirurgias" defaultValue={data?.cirurgias} />
        </div></H>

        <H id="s12.usa_medicamento"><div className="sm:col-span-2 mt-2 border-t pt-3">
          <Select label={d.s12.usa_medicamento} name="usa_medicamento" required
            defaultValue={data?.usa_medicamento}
            options={[
              { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
            ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setUsaMed(e.target.value === 'sim')} />
        </div></H>
        {usaMed && <>
          <Field label={d.s12.med_nome} name="med_nome" defaultValue={data?.med_nome} />
          <Field label={d.s12.med_motivo} name="med_motivo" defaultValue={data?.med_motivo} />
          <Field label={d.s12.med_dosagem} name="med_dosagem" defaultValue={data?.med_dosagem} />
          <Select label={d.s12.med_receita} name="med_receita" defaultValue={data?.med_receita} options={[
            { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
          ]} />
        </>}

        <H id="s12.plano_saude"><div className="sm:col-span-2 mt-2 border-t pt-3">
          <Select label={d.s12.plano_saude} name="plano_saude" defaultValue={data?.plano_saude} options={[
            { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
          ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPlanoSaude(e.target.value === 'sim')} />
        </div></H>
        {planoSaude && (
          <Field label={d.s12.plano_saude_qual} name="plano_saude_qual" defaultValue={data?.plano_saude_qual} />
        )}
        <div className="sm:col-span-2">
          <TextArea label={d.s12.emergencia_medica} name="emergencia_medica"
            defaultValue={data?.emergencia_medica} rows={2} />
        </div>
      </div>
    </div>
  )
}

function S13Legal({ data }: { data?: Record<string, string> }) {
  const d = useContext(DictCtx)
  const [temAntecedente, setTemAntecedente] = useState(data?.antecedente === 'sim')
  return (
    <div className="space-y-4">
      <SectionTitle number={d.s13.section} title={d.s13.title} />
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Select label={d.s13.antecedente} name="antecedente" required
            defaultValue={data?.antecedente}
            options={[
              { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
            ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTemAntecedente(e.target.value === 'sim')} />
        </div>
        {temAntecedente && (
          <div className="sm:col-span-2">
            <TextArea label={d.s13.antecedente_descricao} name="antecedente_descricao"
              defaultValue={data?.antecedente_descricao} rows={3} />
          </div>
        )}
        <div className="sm:col-span-2">
          <Select label={d.s13.pendencia_juridica} name="pendencia_juridica" required
            defaultValue={data?.pendencia_juridica}
            options={[
              { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
            ]} />
        </div>
        <div className="sm:col-span-2">
          <Select label={d.s13.restricao_legal}
            name="restricao_legal" defaultValue={data?.restricao_legal}
            options={[
              { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
            ]} />
        </div>
        <div className="sm:col-span-2">
          <div className="space-y-2 mt-2">
            {d.s13.decls.map((decl, i) => (
              <label key={i} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 cursor-pointer hover:border-indigo-200">
                <input type="checkbox" name={['decl_verdadeiro', 'decl_compromisso', 'decl_referencias'][i]} value="sim"
                  defaultChecked={data?.[['decl_verdadeiro', 'decl_compromisso', 'decl_referencias'][i]] === 'sim'}
                  required className="mt-0.5 accent-indigo-600 flex-shrink-0" />
                <span className="text-sm text-gray-700">{decl}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function S14Financeiro({ data }: { data?: Record<string, string> }) {
  const d = useContext(DictCtx)
  return (
    <div className="space-y-4">
      <SectionTitle number={d.s14.section} title={d.s14.title} />
      <InfoBox>{d.s14.infobox}</InfoBox>
      <div className="grid sm:grid-cols-2 gap-4">
        <Select label={d.s14.apoio_tipo} name="apoio_tipo" required
          defaultValue={data?.apoio_tipo}
          options={[
            { value: 'proprio', label: d.s14.at_proprio },
            { value: 'familia', label: d.s14.at_familia },
            { value: 'igreja', label: d.s14.at_igreja },
            { value: 'mantenedores', label: d.s14.at_mantenedores },
            { value: 'misto', label: d.s14.at_misto },
          ]} />
        <Select label={d.s14.ajuda_igreja} name="ajuda_igreja"
          defaultValue={data?.ajuda_igreja}
          options={[
            { value: 'sim', label: d.s14.ai_sim },
            { value: 'nao', label: d.s14.ai_nao },
            { value: 'em_conversa', label: d.s14.ai_em_conversa },
          ]} />
        <Select label={d.s14.pagar_tudo} name="pagar_tudo" required
          defaultValue={data?.pagar_tudo}
          options={[
            { value: 'sim', label: d.s14.pt_sim },
            { value: 'parcialmente', label: d.s14.pt_parcialmente },
            { value: 'nao', label: d.s14.pt_nao },
          ]} />
        <Select label={d.s14.mantenedores} name="mantenedores"
          defaultValue={data?.mantenedores}
          options={[
            { value: 'sim_ja_iniciou', label: d.s14.mt_sim_ja },
            { value: 'sim_nao_iniciou', label: d.s14.mt_sim_nao },
            { value: 'nao', label: d.s14.mt_nao },
          ]} />
        <div className="sm:col-span-2">
          <TextArea label={d.s14.situacao_financeira}
            name="situacao_financeira" defaultValue={data?.situacao_financeira} required rows={4} />
        </div>
        <div className="sm:col-span-2">
          <Select label={d.s14.dividas} name="dividas" defaultValue={data?.dividas} options={[
            { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
          ]} />
        </div>
      </div>
    </div>
  )
}

function S15Documentos({ hasRg, hasCpf, hasPassaporte, sexo, documentUrls }: {
  hasRg: boolean; hasCpf: boolean; hasPassaporte: boolean; sexo?: string; documentUrls?: DocumentUrls
}) {
  const d = useContext(DictCtx)
  // Só pede upload do(s) documento(s) que a pessoa de fato preencheu na seção 5
  // (lá é exigido pelo menos um entre RG/CPF/Passaporte) — se por algum motivo
  // nenhum dos três estiver disponível (ex: todos escondidos pela escola),
  // não força upload de documento nenhum.
  const docs: Array<{ name: string; label: string; required: boolean; icon: 'foto' | 'id' }> = [
    { name: 'doc_foto', label: d.s15.doc_foto, required: true, icon: 'foto' },
    ...(hasRg ? [
      { name: 'doc_rg_frente', label: d.s15.doc_rg_frente_br, required: true, icon: 'id' as const },
      { name: 'doc_rg_verso', label: d.s15.doc_rg_verso_br, required: true, icon: 'id' as const },
    ] : []),
    ...(hasCpf ? [{ name: 'doc_cpf', label: d.s15.doc_cpf, required: true, icon: 'id' as const }] : []),
    ...(hasPassaporte ? [{ name: 'doc_passaporte', label: d.s15.doc_passaporte_estrangeiro, required: true, icon: 'id' as const }] : []),
  ]
  return (
    <div className="space-y-4">
      <SectionTitle number={d.s15.section} title={d.s15.title} />
      <InfoBox>{d.s15.infobox}</InfoBox>
      <div className="grid grid-cols-1 gap-4">
        {docs.map(doc => (
          <FileInputField key={doc.name} name={doc.name} accept="image/jpeg,image/png,image/webp,application/pdf"
            required={doc.required} tone="indigo"
            icon={doc.icon === 'foto' ? <Camera size={16} aria-hidden /> : <IdCard size={16} aria-hidden />}
            title={doc.label}
            badgeLabel={d.nav.doc_required} readyLabel={d.nav.doc_ready}
            dropLabel={doc.icon === 'foto' ? d.nav.doc_drop_generic : d.nav.doc_drop_generic}
            dropHint={d.nav.doc_drop_hint} attachedLabel={d.nav.doc_attached}
            changeLabel={d.nav.change_file} removeLabel={d.nav.remove_file}
            modelGraphic={doc.icon === 'foto' ? <PhotoFramingGuide sexo={sexo} caption={d.nav.photo_model_caption} /> : undefined}
            existingFileUrl={documentUrls?.[doc.name]?.url}
            existingFileName={documentUrls?.[doc.name]?.name}
            existingFileType={documentUrls?.[doc.name]?.type}
            existingFileSize={documentUrls?.[doc.name]?.size} />
        ))}
      </div>
    </div>
  )
}

function S16Aceite({ data }: { data?: Record<string, string> }) {
  const d = useContext(DictCtx)
  const finalNames = ['final_verdadeiro', 'final_ciente_avaliacao', 'final_sem_garantia', 'final_autorizo_contato', 'final_documentos_adicionais']
  return (
    <div className="space-y-4">
      <SectionTitle number={d.s16.section} title={d.s16.title} />
      <div className="space-y-3">
        <label className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 hover:border-indigo-300 cursor-pointer bg-gray-50">
          <input type="checkbox" name="maior_18" value="sim"
            defaultChecked={data?.maior_18 === 'sim'} required
            className="mt-0.5 accent-indigo-600 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-800">{d.s16.maior_18}</span>
        </label>
        {d.s16.finals.map((decl, i) => (
          <label key={finalNames[i]} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-indigo-200 cursor-pointer">
            <input type="checkbox" name={finalNames[i]} value="sim"
              defaultChecked={data?.[finalNames[i]] === 'sim'} required
              className="mt-0.5 accent-indigo-600 flex-shrink-0" />
            <span className="text-sm text-gray-700">{decl} *</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// ── Tela intermediária obrigatória: pagamento + comprovante ────────────────
// Fica ENTRE a última seção do formulário e o envio de verdade — o formulário
// só é marcado como enviado depois que o comprovante é anexado com sucesso.
// Só aparece quando a escola configurou informações de pagamento.

function PaymentGateScreen({ slug, token, paymentInfo, onComplete, d }: {
  slug: string; token: string; paymentInfo: string; onComplete: () => void; d: FormDict
}) {
  const [status, setStatus] = useState<'idle' | 'sending'>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('sending')
    setError('')
    const receiptResult = await anexarComprovante(slug, token, new FormData(e.currentTarget))
    if ('error' in receiptResult) {
      setError(receiptResult.error ?? '')
      setStatus('idle')
      return
    }
    const submitResult = await enviarFormulario(slug, token)
    if ('error' in submitResult) {
      setError(submitResult.error ?? '')
      setStatus('idle')
      return
    }
    onComplete()
  }

  return (
    <div className="py-10 px-4 max-w-md mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-black text-gray-900 mb-2">{d.submitted.payment_title}</h2>
        <p className="text-sm text-gray-500">{d.submitted.payment_gate_hint}</p>
      </div>
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-left space-y-4">
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{paymentInfo}</p>
        <form onSubmit={handleSubmit} className="space-y-3 border-t border-green-200 pt-4">
          <div>
            <FileInputField name="comprovante" required
              accept="application/pdf,image/jpeg,image/png,image/webp"
              tone="green" icon={<FileText size={16} aria-hidden />}
              title={d.submitted.receipt_label} subtitle={d.submitted.receipt_hint}
              badgeLabel={d.nav.doc_required} readyLabel={d.nav.doc_ready}
              dropLabel={d.nav.doc_drop_generic} dropHint={d.nav.doc_drop_hint} attachedLabel={d.nav.doc_attached}
              changeLabel={d.nav.change_file} removeLabel={d.nav.remove_file} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={status === 'sending'}
            className="w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-60">
            {status === 'sending' ? d.submitted.receipt_sending : d.submitted.receipt_send}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Tela de sucesso com geração de links ───────────────────────────────────

function SubmittedScreen({ slug, applicationId, schoolName, hiddenSet, d }: {
  slug: string; applicationId: string; schoolName: string; hiddenSet: Set<string>; d: FormDict
}) {
  const showPastorLink = !hiddenSet.has('s8.pastor_bloco')
  const showAmigoLink = !hiddenSet.has('s9.oculto')
  const showReferences = showPastorLink || showAmigoLink
  const [pastorLink, setPastorLink] = useState<string | null>(null)
  const [amigoLink, setAmigoLink] = useState<string | null>(null)
  const [loadingPastor, setLoadingPastor] = useState(false)
  const [loadingAmigo, setLoadingAmigo] = useState(false)
  const [copied, setCopied] = useState<'pastor' | 'amigo' | null>(null)

  async function gerarLink(tipo: 'pastor' | 'amigo') {
    if (tipo === 'pastor') setLoadingPastor(true)
    else setLoadingAmigo(true)
    try {
      const result = await gerarLinkReferencia(slug, applicationId, tipo)
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
        <HeartHandshake className="size-14 mx-auto mb-4 text-brand-500" />
        <h2 className="text-3xl font-black text-gray-900 mb-3">{d.submitted.title}</h2>
        <p className="text-gray-600 max-w-md mx-auto text-base leading-relaxed">
          {t(d.submitted.body, { school: schoolName })}
        </p>
      </div>

      {showReferences && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 text-left max-w-md mx-auto space-y-4">
          <h3 className="font-bold text-gray-900 text-center">{d.submitted.next_title}</h3>
          <p className="text-sm text-gray-600 text-center">{d.submitted.next_body}</p>

          {/* Pastor */}
          {showPastorLink && (
            <div className="space-y-2">
              <button onClick={() => gerarLink('pastor')} disabled={loadingPastor}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors text-sm">
                {loadingPastor ? d.submitted.generating : pastorLink ? d.submitted.new_pastor : d.submitted.gen_pastor}
              </button>
              {pastorLink && (
                <div className="flex items-center gap-2 bg-white border border-indigo-200 rounded-xl px-3 py-2">
                  <input readOnly value={pastorLink}
                    className="flex-1 text-xs text-gray-600 bg-transparent outline-none truncate" />
                  <button onClick={() => copyLink(pastorLink, 'pastor')}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 whitespace-nowrap">
                    {copied === 'pastor' ? d.submitted.copied : d.submitted.copy}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Amigo */}
          {showAmigoLink && (
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
          )}

          <p className="text-xs text-gray-400 text-center">{d.submitted.link_hint}</p>
        </div>
      )}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

type SectionDef = { id: number; component: React.ReactNode }

export function FormularioInscricao({
  slug, token, applicationId, schoolName, orgName, className, prefill, initialSection = 1, initialData, hiddenFields, paymentInfo, initialLang, printMode, documentUrls
}: Props) {
  const hiddenSet = useMemo(() => new Set(hiddenFields ?? []), [hiddenFields])
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [lang, setLangState] = useState<Lang>(normalizeLang(initialLang ?? prefill?.idioma))
  const d = getFormDict(lang)

  function setLang(l: Lang) {
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

  const [, setIsBrazilian] = useState(
    (localData.s5 as Record<string, string> | undefined)?.is_brasileiro !== 'nao'
  )

  const sections: SectionDef[] = [
    { id: 1,  component: <S1Nome prefill={prefill} data={localData.s1} /> },
    { id: 3,  component: <S3Termo data={localData.s3} /> },
    { id: 4,  component: <S4Escola schoolName={schoolName} orgName={orgName} className={className} data={localData.s4} /> },
    { id: 5,  component: <S5Dados prefill={prefill} data={localData.s5} onNationalityChange={setIsBrazilian} /> },
    { id: 6,  component: <S6Historia data={localData.s6} /> },
    { id: 7,  component: <S7Familia data={localData.s7} estadoCivilS5={localData.s5?.estado_civil} /> },
    { id: 8,  component: <S8Igreja data={localData.s8} /> },
    { id: 9,  component: <S9Referencia data={localData.s9} /> },
    { id: 10, component: <S10Historico data={localData.s10} /> },
    { id: 11, component: <S11Espiritual data={localData.s11} /> },
    { id: 12, component: <S12Saude data={localData.s12} /> },
    { id: 13, component: <S13Legal data={localData.s13} /> },
    { id: 14, component: <S14Financeiro data={localData.s14} /> },
    { id: 15, component: <S15Documentos
        hasRg={!!localData.s5?.rg?.trim()}
        hasCpf={!!localData.s5?.cpf?.trim()}
        hasPassaporte={!!localData.s5?.passaporte?.trim()}
        sexo={localData.s5?.sexo}
        documentUrls={documentUrls}
      /> },
    { id: 16, component: <S16Aceite data={localData.s16} /> },
  ]

  const visibleSections = sections.filter(s => !hiddenSet.has(`s${s.id}.oculto`))

  // Se a pessoa já preencheu até a última seção mas nunca terminou de anexar
  // o comprovante (fechou a aba, perdeu conexão, o navegador recarregou a
  // página em segundo plano...), reabrir o mesmo link deve voltar direto pra
  // tela de pagamento — não pra última seção do formulário de novo, que já
  // está toda preenchida e só confunde quem já passou por ali sem entender
  // que falta um passo.
  const lastSectionId = visibleSections[visibleSections.length - 1]?.id
  const [awaitingPayment, setAwaitingPayment] = useState(
    !!paymentInfo && !(initialData as Record<string, unknown> | undefined)?.payment_receipt
      && !!lastSectionId && initialSection >= lastSectionId
  )

  if (printMode) {
    return (
      <DictCtx.Provider value={d}>
      <HiddenCtx.Provider value={hiddenSet}>
      <HiddenStyles />
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
          {visibleSections.map(s => (
            <div key={s.id} className="pb-8 border-b border-gray-100 last:border-0 break-inside-avoid-page">
              {s.component}
            </div>
          ))}
        </div>
        {paymentInfo && (
          <div className="mt-8 bg-green-50 border border-green-200 rounded-2xl p-6 break-inside-avoid-page">
            <h3 className="font-bold text-gray-900 mb-1">{d.submitted.payment_title}</h3>
            <p className="text-xs text-gray-500 mb-3">
              Ao enviar a inscrição pelo site, o candidato vê esta mensagem e precisa anexar o
              comprovante de pagamento — é obrigatório, a inscrição só é registrada depois disso.
            </p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{paymentInfo}</p>
            <div className="border-t border-green-200 mt-4 pt-4 space-y-3 print:hidden">
              <div>
                <FileInputField name="comprovante_preview"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  tone="green" icon={<FileText size={16} aria-hidden />}
                  title={d.submitted.receipt_label} subtitle={d.submitted.receipt_hint}
                  badgeLabel={d.nav.doc_required} readyLabel={d.nav.doc_ready}
                  dropLabel={d.nav.doc_drop_generic} dropHint={d.nav.doc_drop_hint} attachedLabel={d.nav.doc_attached}
                  changeLabel={d.nav.change_file} removeLabel={d.nav.remove_file} />
              </div>
              <button type="button" disabled
                className="w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white opacity-60 cursor-not-allowed">
                {d.submitted.receipt_send}
              </button>
              <p className="text-xs text-gray-400 text-center">
                Envio desativado aqui — só funciona de verdade quando um candidato preenche o
                formulário real (esta é só uma pré-visualização, sem inscrição de verdade por trás).
              </p>
            </div>
          </div>
        )}
      </div>
      </HiddenCtx.Provider>
      </DictCtx.Provider>
    )
  }

  const currentIndex = Math.max(0, visibleSections.findIndex(s => s.id === current))
  const isLast = currentIndex === visibleSections.length - 1
  const progress = Math.round(((currentIndex + 1) / visibleSections.length) * 100)

  async function handleBack() {
    if (currentIndex === 0) return
    const target = visibleSections[currentIndex - 1].id
    // Seção 15 é só arquivo — não tem texto pra guardar em dataRecord (viraria
    // {} e apagaria os documentos já enviados via anexarDocumentos). Os
    // arquivos já ficam salvos assim que a pessoa avança por lá; nada a
    // fazer aqui além de navegar.
    if (visibleSections[currentIndex].id === 15) {
      await atualizarSecaoAtual(slug, token, target).catch(() => {})
    } else if (formRef.current) {
      const fd = new FormData(formRef.current)
      const dataRecord: Record<string, string> = {}
      fd.forEach((v, k) => { if (typeof v === 'string') dataRecord[k] = v })
      setLocalData(prev => ({ ...prev, [`s${visibleSections[currentIndex].id}`]: dataRecord }))
      await salvarSecao(slug, token, visibleSections[currentIndex].id, dataRecord, target).catch(() => {})
    }
    setCurrent(target)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleNext(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const fd = new FormData(e.currentTarget)

      // Validação customizada: seção 5 — ao menos um documento (RG, CPF ou
      // Passaporte) obrigatório entre os que a escola não escondeu; estrangeiro
      // só tem o campo de passaporte, que já é required no próprio input.
      // Se a escola escondeu os três, não há nada pra exigir aqui.
      if (visibleSections[currentIndex].id === 5 && fd.get('is_brasileiro') !== 'nao') {
        const rgVisible = !hiddenSet.has('s5.rg')
        const cpfVisible = !hiddenSet.has('s5.cpf')
        const passaporteVisible = !hiddenSet.has('s5.passaporte')
        if (rgVisible || cpfVisible || passaporteVisible) {
          const rg = rgVisible ? (fd.get('rg') as string)?.trim() : ''
          const cpf = cpfVisible ? (fd.get('cpf') as string)?.trim() : ''
          const passaporte = passaporteVisible ? (fd.get('passaporte') as string)?.trim() : ''
          if (!rg && !cpf && !passaporte) {
            setError(d.s5.documentos_hint)
            setSaving(false)
            return
          }
        }
      }

      // Validação customizada: seção 8 — pastor email ou telefone obrigatório
      // (só quando o bloco de pastor não foi escondido pela config da escola)
      if (visibleSections[currentIndex].id === 8 && !hiddenSet.has('s8.pastor_bloco')) {
        const email = (fd.get('pastor_email') as string)?.trim()
        const tel = (fd.get('pastor_telefone') as string)?.trim()
        if (!email && (!tel || tel === '+55')) {
          setError(d.s8.pastor_hint)
          setSaving(false)
          return
        }
      }

      // Atualiza estado de nationalidade após salvar S5
      if (visibleSections[currentIndex].id === 5) {
        setIsBrazilian(fd.get('is_brasileiro') !== 'nao')
      }

      const dataRecord: Record<string, string> = {}
      fd.forEach((v, k) => { if (typeof v === 'string') dataRecord[k] = v })
      const target = isLast ? visibleSections[currentIndex].id : visibleSections[currentIndex + 1].id

      // Seção 15 é só upload de arquivo — salvarSecao não serve pra isso (o
      // File nunca vira nada útil dentro de um jsonb); usa a action dedicada
      // que sobe os arquivos pro Storage de verdade.
      if (visibleSections[currentIndex].id === 15) {
        const uploadResult = await anexarDocumentos(slug, token, fd, target)
        if ('error' in uploadResult) throw new Error(uploadResult.error)
      } else {
        const data: Record<string, unknown> = {}
        fd.forEach((v, k) => { data[k] = v })
        const saveResult = await salvarSecao(slug, token, visibleSections[currentIndex].id, data, target)
        if (!('error' in saveResult)) {
          setLocalData(prev => ({ ...prev, [`s${visibleSections[currentIndex].id}`]: dataRecord }))
        }
        if ('error' in saveResult) throw new Error(saveResult.error)
      }

      if (isLast) {
        // Se a escola configurou informações de pagamento, o envio de verdade
        // só acontece depois que o comprovante for anexado (PaymentGateScreen)
        // — sem isso não tem como tornar o comprovante obrigatório, já que a
        // tela de pagamento hoje só aparece depois do formulário enviado.
        if (paymentInfo) {
          setAwaitingPayment(true)
        } else {
          const submitResult = await enviarFormulario(slug, token)
          if ('error' in submitResult) throw new Error(submitResult.error)
          setSubmitted(true)
        }
      } else {
        setCurrent(visibleSections[currentIndex + 1].id)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : d.nav.error_save)
    } finally {
      setSaving(false)
    }
  }

  if (awaitingPayment && paymentInfo) {
    return (
      <PaymentGateScreen
        slug={slug}
        token={token}
        paymentInfo={paymentInfo}
        onComplete={() => { setAwaitingPayment(false); setSubmitted(true) }}
        d={d}
      />
    )
  }

  if (submitted) {
    return <SubmittedScreen slug={slug} applicationId={applicationId} schoolName={schoolName} hiddenSet={hiddenSet} d={d} />
  }

  return (
    <DictCtx.Provider value={d}>
    <HiddenCtx.Provider value={hiddenSet}>
    <HiddenStyles />
    <div>
      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 md:-mx-8 -mt-4 sm:-mt-6 md:-mt-8 px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-3 bg-white/95 backdrop-blur-sm rounded-t-2xl border-b border-gray-100 mb-6">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 font-bold text-[11px]">
              {currentIndex + 1}
            </span>
            {t(d.nav.section_of, { n: String(currentIndex + 1), total: String(visibleSections.length) })}
          </span>
          <LangSwitcher lang={lang} onChange={setLang} tone="indigo" />
        </div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-gray-400">{d.langSwitcher.label}</span>
          <span className="text-xs font-bold text-indigo-600">{progress}%</span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }} />
        </div>
      </div>

      <form ref={formRef} onSubmit={handleNext} className="space-y-6 pb-24">
        {visibleSections[currentIndex].component}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}
        {/* Mantém o Enter dentro de um campo submetendo a seção — o botão
            visível fica fora do form (barra fixa), então sem isso o form
            perderia o envio implícito por teclado. */}
        <button type="submit" className="sr-only" aria-hidden="true" tabIndex={-1} />
      </form>

      <div className="fixed inset-x-0 bottom-0 z-30 bg-white/95 backdrop-blur-sm border-t border-gray-100">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          {currentIndex > 0 ? (
            <button type="button" onClick={handleBack}
              className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-center shrink-0">
              {d.nav.back}
            </button>
          ) : <div className="hidden sm:block" />}

          <button type="button" onClick={() => formRef.current?.requestSubmit()} disabled={saving}
            className="flex-1 px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors text-center">
            {saving ? d.nav.saving : isLast ? d.nav.submit : d.nav.next}
          </button>
        </div>
      </div>
    </div>
    </HiddenCtx.Provider>
    </DictCtx.Provider>
  )
}
