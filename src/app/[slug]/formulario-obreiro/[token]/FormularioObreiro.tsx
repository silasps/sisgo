'use client'

import { useRef, useState, useContext, createContext } from 'react'
import { HeartHandshake } from 'lucide-react'
import { salvarSecaoObreiro, enviarFormularioObreiro, gerarLinkReferenciaObreiro } from './actions'
import { InternationalPhoneField } from '@/components/ui/InternationalPhoneField'
import { MaskedInput, useMask } from '@/components/ui/MaskedInput'
import { LangSwitcher } from '@/components/ui/LangSwitcher'

// ── i18n stub — will use staff-forms dict when ready, fallback to inline PT ──

type Lang = 'pt' | 'en' | 'es'
const LangCtx = createContext<Lang>('pt')

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

function Field({ label, name, defaultValue, placeholder, required, type = 'text', maxLength }: {
  label: string; name: string; defaultValue?: string; placeholder?: string
  required?: boolean; type?: string; maxLength?: number
}) {
  return (
    <div data-field={name}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input name={name} type={type} defaultValue={defaultValue} placeholder={placeholder}
        required={required} maxLength={maxLength}
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
  return (
    <div data-field={name}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select name={name} defaultValue={defaultValue ?? ''} required={required} onChange={onChange}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-gray-50">
        <option value="" disabled>Selecione…</option>
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
      <SubSection title="Endereço" />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
        <input name="cep" value={cep} onChange={e => setCepRaw(e.target.value)} onBlur={handleCepBlur}
          placeholder="00000-000" maxLength={9} inputMode="numeric"
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-gray-50" />
        {loadingCep && <p className="text-xs text-amber-500 mt-1">Buscando endereço…</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
        <input name="bairro" value={bairro} onChange={e => setBairro(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-gray-50" />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Rua / Endereço</label>
        <input name="endereco" value={endereco} onChange={e => setEndereco(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-gray-50" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cidade <span className="text-red-500">*</span></label>
        <input name="cidade" value={cidade} onChange={e => setCidade(e.target.value)} required
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-gray-50" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Estado <span className="text-red-500">*</span></label>
        <input name="estado" value={estado} onChange={e => setEstado(e.target.value)} required
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-gray-50" />
      </div>
    </>
  )
}

function ZipAddressFields({ data }: { data?: Record<string, string> }) {
  return (
    <>
      <SubSection title="Address" />
      <Field label="ZIP / Postal code" name="cep" defaultValue={data?.cep} placeholder="e.g. 12345" />
      <Field label="District" name="bairro" defaultValue={data?.bairro} />
      <div className="sm:col-span-2">
        <Field label="Street / Address" name="endereco" defaultValue={data?.endereco} />
      </div>
      <Field label="City" name="cidade" defaultValue={data?.cidade} required />
      <Field label="State / Province" name="estado" defaultValue={data?.estado} required />
    </>
  )
}

// ── Sections ─────────────────────────────────────────────────────────────────

function S1Email({ prefill, data }: { prefill?: Prefill; data?: Record<string, string> }) {
  return (
    <div className="space-y-4">
      <SectionTitle number="Seção 01" title="E-mail" />
      <Field label="E-mail" name="email" type="email"
        defaultValue={data?.email ?? prefill?.email} required />
    </div>
  )
}

function S2Dados({ prefill, data, onNationalityChange }: {
  prefill?: Prefill; data?: Record<string, string>
  onNationalityChange?: (isBrazilian: boolean) => void
}) {
  const [estrangeiro, setEstrangeiro] = useState(data?.is_brasileiro === 'nao')

  function handleNationality(e: React.ChangeEvent<HTMLSelectElement>) {
    const isForeigner = e.target.value === 'nao'
    setEstrangeiro(isForeigner)
    onNationalityChange?.(!isForeigner)
  }

  return (
    <div className="space-y-4">
      <SectionTitle number="Seção 02" title="Dados Pessoais" />
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Field label="Nome completo" name="nome" defaultValue={data?.nome ?? prefill?.nome} required />
        </div>
        <Select label="Sexo" name="sexo" required defaultValue={data?.sexo} options={[
          { value: 'M', label: 'Masculino' },
          { value: 'F', label: 'Feminino' },
        ]} />
        <Field label="Data de nascimento" name="data_nascimento" type="date"
          defaultValue={data?.data_nascimento} required />
        <Select label="Estado civil" name="estado_civil" required defaultValue={data?.estado_civil} options={[
          { value: 'solteiro', label: 'Solteiro(a)' },
          { value: 'casado', label: 'Casado(a)' },
          { value: 'divorciado', label: 'Divorciado(a)' },
          { value: 'viuvo', label: 'Viúvo(a)' },
        ]} />
        <Select label="É brasileiro(a)?" name="is_brasileiro" required
          defaultValue={data?.is_brasileiro}
          options={[
            { value: 'sim', label: 'Sim' },
            { value: 'nao', label: 'Não' },
          ]} onChange={handleNationality} />
        {estrangeiro && <>
          <Field label="Nacionalidade" name="nacionalidade" defaultValue={data?.nacionalidade} required />
          <Select label="Fluência em português" name="fluencia_portugues"
            defaultValue={data?.fluencia_portugues}
            options={[
              { value: 'basico', label: 'Básico' },
              { value: 'intermediario', label: 'Intermediário' },
              { value: 'avancado', label: 'Avançado' },
              { value: 'fluente', label: 'Fluente' },
            ]} />
        </>}

        <SubSection title="Formação e Habilidades" />
        <Select label="Grau de escolaridade" name="escolaridade" required defaultValue={data?.escolaridade} options={[
          { value: 'fundamental', label: 'Ensino Fundamental' },
          { value: 'medio', label: 'Ensino Médio' },
          { value: 'tecnico', label: 'Técnico' },
          { value: 'superior_incompleto', label: 'Superior Incompleto' },
          { value: 'superior', label: 'Superior Completo' },
          { value: 'pos_graduacao', label: 'Pós-graduação' },
          { value: 'mestrado', label: 'Mestrado' },
          { value: 'doutorado', label: 'Doutorado' },
        ]} />
        <Field label="Profissão" name="profissao" defaultValue={data?.profissao} />
        <div className="sm:col-span-2">
          <TextArea label="Habilidades" name="habilidades" defaultValue={data?.habilidades} rows={3}
            placeholder="Ex: culinária, música, ensino, liderança, manutenção…" />
        </div>
        <div className="sm:col-span-2">
          <Field label="Curso de especialização profissional" name="especializacao_profissional"
            defaultValue={data?.especializacao_profissional}
            placeholder="Ex: técnico em enfermagem, mecânica…" />
        </div>
        <div className="sm:col-span-2">
          <Field label="Escolas ou especializações da JOCUM" name="escolas_jocum"
            defaultValue={data?.escolas_jocum}
            placeholder="Ex: ETED, EDE, EMAP…" />
        </div>

        <SubSection title="Idiomas" />
        {([
          { label: 'Português', name: 'idioma_portugues', defaultNativo: true },
          { label: 'Inglês', name: 'idioma_ingles' },
          { label: 'Espanhol', name: 'idioma_espanhol' },
        ] as { label: string; name: string; defaultNativo?: boolean }[]).map(({ label, name, defaultNativo }) => (
          <div key={name}>
            <Select label={label} name={name}
              defaultValue={data?.[name] ?? (defaultNativo ? 'nativo' : '')}
              options={[
                { value: 'nativo', label: 'Nativo' },
                { value: 'basico', label: 'Básico' },
                { value: 'intermediario', label: 'Intermediário' },
                { value: 'avancado', label: 'Avançado' },
                { value: 'fluente', label: 'Fluente' },
                { value: 'nao_falo', label: 'Não falo' },
              ]} />
          </div>
        ))}
        <Field label="Outro idioma" name="outro_idioma" defaultValue={data?.outro_idioma}
          placeholder="Ex: Francês (intermediário)" />

        <SubSection title="Documentos" />
        {!estrangeiro ? (<>
          <MaskedInput mask="rg" name="rg" label="RG" defaultValue={data?.rg} required />
          <MaskedInput mask="cpf" name="cpf" label="CPF" defaultValue={data?.cpf} required />
          <Field label="Passaporte (opcional)" name="passaporte" defaultValue={data?.passaporte} maxLength={20} />
        </>) : (<>
          <div className="sm:col-span-2">
            <Field label="Passaporte (obrigatório)" name="passaporte" defaultValue={data?.passaporte}
              required maxLength={20} placeholder="Ex: AB123456" />
          </div>
        </>)}

        {!estrangeiro
          ? <CepAddressFields data={data} />
          : <ZipAddressFields data={data} />
        }
        <Field label="País" name="pais" defaultValue={data?.pais ?? (estrangeiro ? '' : 'Brasil')} required />
        <InternationalPhoneField phoneName="celular" countryName="celular_country"
          label="Celular / WhatsApp" defaultCountryIso="BR" defaultPhone={data?.celular ?? prefill?.telefone} />
        <Field label="E-mail de contato" name="email_contato" type="email"
          defaultValue={data?.email_contato} required />

        <SubSection title="Redes sociais" />
        <Field label="Instagram" name="instagram" defaultValue={data?.instagram} placeholder="@usuario" />
        <Field label="Facebook" name="facebook" defaultValue={data?.facebook} />
        <Field label="TikTok" name="tiktok" defaultValue={data?.tiktok} />
        <Field label="LinkedIn" name="linkedin" defaultValue={data?.linkedin} />

        <SubSection title="Contato de emergência" />
        <Field label="Nome" name="emergencia_nome" defaultValue={data?.emergencia_nome} required />
        <Field label="Grau de parentesco" name="emergencia_parentesco" defaultValue={data?.emergencia_parentesco} required />
        <InternationalPhoneField phoneName="emergencia_telefone" countryName="emergencia_telefone_country"
          label="Telefone" defaultCountryIso="BR"
          defaultPhone={data?.emergencia_telefone} required />
        <Field label="E-mail" name="emergencia_email" type="email" defaultValue={data?.emergencia_email} />
      </div>
    </div>
  )
}

function S3Familia({ data, estadoCivilS2 }: { data?: Record<string, string>; estadoCivilS2?: string }) {
  const estadoCivil = data?.estado_civil_atual ?? estadoCivilS2 ?? ''
  const [temFilhos, setTemFilhos] = useState(data?.tem_filhos === 'sim')

  return (
    <div className="space-y-4">
      <SectionTitle number="Seção 03" title="Família" />
      <div className="grid sm:grid-cols-2 gap-4">
        <input type="hidden" name="estado_civil_atual" value={estadoCivil} />
        {estadoCivil && (
          <div className="sm:col-span-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-600">
            Estado civil: <strong>
              {{ solteiro: 'Solteiro(a)', casado: 'Casado(a)', divorciado: 'Divorciado(a)', viuvo: 'Viúvo(a)' }[estadoCivil] ?? estadoCivil}
            </strong>
            <span className="text-xs text-gray-400 ml-2">(informado na seção anterior)</span>
          </div>
        )}

        {estadoCivil === 'casado' && <>
          <SubSection title="Dados do cônjuge" />
          <Field label="Nome completo do cônjuge" name="conjuge_nome" defaultValue={data?.conjuge_nome} required />
          <Field label="Data de nascimento do cônjuge" name="conjuge_nascimento" type="date" defaultValue={data?.conjuge_nascimento} />
          <Field label="Tempo casados" name="tempo_casados" defaultValue={data?.tempo_casados} />
          <Select label="Cônjuge virá para a base?" name="conjuge_vira" defaultValue={data?.conjuge_vira} options={[
            { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
          ]} />
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Certidão de casamento <span className="text-red-500">*</span>
            </label>
            <input type="file" name="doc_certidao_casamento" accept="image/jpeg,image/png,image/webp,application/pdf"
              required
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 cursor-pointer" />
          </div>
        </>}

        <div className="sm:col-span-2 mt-2">
          <Select label="Tem filhos?" name="tem_filhos" defaultValue={data?.tem_filhos} options={[
            { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
          ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTemFilhos(e.target.value === 'sim')} />
        </div>
        {temFilhos && <>
          <div className="sm:col-span-2">
            <TextArea label="Dados dos filhos (nome e ano de nascimento)" name="filhos_dados"
              defaultValue={data?.filhos_dados} rows={3} required
              placeholder="Ex: João (2018), Maria (2020)" />
          </div>
          <Select label="Os filhos virão para a base?" name="filhos_virao" defaultValue={data?.filhos_virao} options={[
            { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
          ]} />
        </>}
      </div>
    </div>
  )
}

function S4Igreja({ data }: { data?: Record<string, string> }) {
  const [conversou, setConversou] = useState(data?.conversou_pastor === 'sim')
  const [participa, setParticipa] = useState(data?.tem_ministerio === 'sim')
  const [lideranca, setLideranca] = useState(data?.tem_lideranca === 'sim')
  return (
    <div className="space-y-4">
      <SectionTitle number="Seção 04" title="Igreja e Vida Espiritual" />
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Field label="Nome da igreja" name="igreja_nome" defaultValue={data?.igreja_nome} required />
        </div>
        <Field label="Cidade da igreja" name="igreja_cidade" defaultValue={data?.igreja_cidade} required />
        <Field label="Há quanto tempo congrega?" name="tempo_igreja" defaultValue={data?.tempo_igreja} required />
        <Select label="É membro oficial?" name="membro_oficial" defaultValue={data?.membro_oficial} options={[
          { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
        ]} />
        <Select label="Participa de algum ministério?" name="tem_ministerio" defaultValue={data?.tem_ministerio} options={[
          { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
        ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setParticipa(e.target.value === 'sim')} />
        {participa && <>
          <Field label="Qual ministério?" name="ministerio_qual" defaultValue={data?.ministerio_qual} />
          <Select label="Tem cargo de liderança?" name="tem_lideranca" defaultValue={data?.tem_lideranca} options={[
            { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
          ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLideranca(e.target.value === 'sim')} />
          {lideranca && <Field label="Qual cargo?" name="lideranca_cargo" defaultValue={data?.lideranca_cargo} />}
        </>}

        <SubSection title="Dados do pastor / líder" />
        <Field label="Nome do pastor/líder" name="pastor_nome" defaultValue={data?.pastor_nome} required />
        <Field label="Cargo" name="pastor_cargo" defaultValue={data?.pastor_cargo} />
        <Field label="E-mail do pastor" name="pastor_email" type="email" defaultValue={data?.pastor_email} />
        <InternationalPhoneField phoneName="pastor_telefone" countryName="pastor_telefone_country"
          label="Telefone do pastor" defaultCountryIso="BR"
          defaultPhone={data?.pastor_telefone} />

        <div className="sm:col-span-2">
          <Select label="Conversou com o pastor sobre vir servir na base?" name="conversou_pastor" required
            defaultValue={data?.conversou_pastor}
            options={[
              { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
            ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setConversou(e.target.value === 'sim')} />
        </div>
        {conversou && (
          <Select label="O pastor concorda?" name="pastor_concorda"
            defaultValue={data?.pastor_concorda}
            options={[
              { value: 'sim', label: 'Sim, totalmente' },
              { value: 'parcialmente', label: 'Parcialmente' },
              { value: 'nao', label: 'Não' },
            ]} />
        )}
        <div className="sm:col-span-2">
          <Select label="A igreja está ciente da sua decisão?" name="igreja_ciente" required
            defaultValue={data?.igreja_ciente}
            options={[
              { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }, { value: 'parcialmente', label: 'Parcialmente' },
            ]} />
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            Precisaremos de uma referência do seu pastor/líder. O formulário de referência será enviado separadamente.
          </p>
        </div>
      </div>
    </div>
  )
}

function S5Experiencia({ data }: { data?: Record<string, string> }) {
  const [tipo, setTipo] = useState(data?.experiencia_recente_tipo ?? '')
  const [conhece, setConhece] = useState(data?.conhece_alguem === 'sim')
  return (
    <div className="space-y-4">
      <SectionTitle number="Seção 05" title="Experiência Recente" />
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Select label="Qual foi sua experiência mais recente?" name="experiencia_recente_tipo" required
            defaultValue={data?.experiencia_recente_tipo}
            options={[
              { value: 'escola', label: 'Fiz uma escola desta instituição' },
              { value: 'missao', label: 'Servi em um projeto missionário' },
              { value: 'nenhuma', label: 'Nenhuma das duas' },
            ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTipo(e.target.value)} />
        </div>

        {tipo === 'escola' && <>
          <Field label="Nome da escola" name="escola_nome" defaultValue={data?.escola_nome} required />
          <Field label="Período / Turma" name="escola_periodo" defaultValue={data?.escola_periodo} />
          <SubSection title="Contato da liderança da escola" />
          <Field label="Nome do líder" name="escola_lider_nome" defaultValue={data?.escola_lider_nome} required />
          <Field label="E-mail do líder" name="escola_lider_email" type="email" defaultValue={data?.escola_lider_email} />
          <InternationalPhoneField phoneName="escola_lider_tel" countryName="escola_lider_tel_country"
            label="Telefone do líder" defaultCountryIso="BR" defaultPhone={data?.escola_lider_tel} required />
        </>}

        {tipo === 'missao' && <>
          <div className="sm:col-span-2">
            <TextArea label="Qual projeto? Descreva sua experiência" name="missao_descricao"
              defaultValue={data?.missao_descricao} required rows={4} />
          </div>
          <Field label="Organização / Base onde serviu" name="missao_organizacao"
            defaultValue={data?.missao_organizacao} required />
          <Field label="Período / Duração" name="missao_duracao" defaultValue={data?.missao_duracao} />
          <SubSection title="Contato da liderança anterior" />
          <Field label="Nome do líder" name="missao_lider_nome" defaultValue={data?.missao_lider_nome} required />
          <Field label="E-mail do líder" name="missao_lider_email" type="email" defaultValue={data?.missao_lider_email} />
          <InternationalPhoneField phoneName="missao_lider_tel" countryName="missao_lider_tel_country"
            label="Telefone do líder" defaultCountryIso="BR" defaultPhone={data?.missao_lider_tel} required />
        </>}

        <SubSection title="Conexão com a base" />
        <div className="sm:col-span-2">
          <Select label="Conhece algum parente ou conhecido desta base?" name="conhece_alguem"
            defaultValue={data?.conhece_alguem}
            options={[
              { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
            ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setConhece(e.target.value === 'sim')} />
        </div>
        {conhece && <>
          <Select label="Qual o vínculo?" name="vinculo_tipo" defaultValue={data?.vinculo_tipo} options={[
            { value: 'parente', label: 'Parente' }, { value: 'conhecido', label: 'Conhecido(a)' },
          ]} />
          <Field label="Nome da pessoa" name="vinculo_nome" defaultValue={data?.vinculo_nome} />
          <div className="sm:col-span-2">
            <TextArea label="Descreva o vínculo" name="vinculo_descricao"
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
  return (
    <div className="space-y-4">
      <SectionTitle number="Seção 06" title="Servir na Base" />
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Select label="Como pretende servir?" name="modalidade_servico" required
            defaultValue={data?.modalidade_servico}
            options={[
              { value: 'integral', label: 'Integral (tempo integral)' },
              { value: 'parcial', label: 'Parcial (meio período)' },
              { value: 'temporario', label: 'Temporário (período específico)' },
            ]} />
        </div>
        <Field label="Quanto tempo pretende servir?" name="tempo_servico"
          defaultValue={data?.tempo_servico} required
          placeholder="Ex: 1 ano, 6 meses, indeterminado" />
        <Field label="Data prevista de chegada" name="data_chegada" type="date"
          defaultValue={data?.data_chegada} />
        {ministries.length > 0 && (
          <div className="sm:col-span-2">
            <Select label="Qual ministério deseja servir?" name="ministerio_escolhido"
              defaultValue={data?.ministerio_escolhido ?? ministryId ?? ''}
              options={ministries.map(m => ({ value: m.id, label: m.name }))} />
          </div>
        )}
        <div className="sm:col-span-2">
          <TextArea label="Motivação para servir na base" name="motivacao"
            defaultValue={data?.motivacao} required rows={4}
            placeholder="Conte-nos por que deseja servir conosco e o que te motiva…" />
        </div>
      </div>
    </div>
  )
}

function S7Saude({ data }: { data?: Record<string, string> }) {
  const [problema, setProblema] = useState(data?.problema_saude === 'sim')
  const [limitacao, setLimitacao] = useState(data?.limitacao_fisica === 'sim')
  const [remedio, setRemedio] = useState(data?.remedio_controlado === 'sim')
  const [alergia, setAlergia] = useState(data?.tem_alergia === 'sim')
  return (
    <div className="space-y-4">
      <SectionTitle number="Seção 07" title="Saúde" />
      <div className="grid gap-4">
        <Select label="Possui algum problema de saúde?" name="problema_saude" required
          defaultValue={data?.problema_saude}
          options={[{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }]}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setProblema(e.target.value === 'sim')} />
        {problema && (
          <TextArea label="Descreva o problema de saúde" name="problema_saude_descricao"
            defaultValue={data?.problema_saude_descricao} required rows={3} />
        )}

        <Select label="Possui alguma limitação física?" name="limitacao_fisica" required
          defaultValue={data?.limitacao_fisica}
          options={[{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }]}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLimitacao(e.target.value === 'sim')} />
        {limitacao && (
          <TextArea label="Descreva a limitação" name="limitacao_fisica_descricao"
            defaultValue={data?.limitacao_fisica_descricao} required rows={3} />
        )}

        <Select label="Toma algum remédio controlado?" name="remedio_controlado" required
          defaultValue={data?.remedio_controlado}
          options={[{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }]}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRemedio(e.target.value === 'sim')} />
        {remedio && (
          <TextArea label="Descreva o medicamento, dosagem e motivo" name="remedio_controlado_descricao"
            defaultValue={data?.remedio_controlado_descricao} required rows={3} />
        )}

        <Select label="Tem alguma alergia?" name="tem_alergia" required
          defaultValue={data?.tem_alergia}
          options={[{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }]}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAlergia(e.target.value === 'sim')} />
        {alergia && (
          <TextArea label="Descreva a alergia" name="alergia_descricao"
            defaultValue={data?.alergia_descricao} required rows={3} />
        )}
      </div>
    </div>
  )
}

function S8Legal({ data }: { data?: Record<string, string> }) {
  const [pendencia, setPendencia] = useState(data?.pendencia_judicial === 'sim')
  return (
    <div className="space-y-4">
      <SectionTitle number="Seção 08" title="Questões Jurídicas" />
      <div className="grid gap-4">
        <Select label="Possui alguma pendência judicial?" name="pendencia_judicial" required
          defaultValue={data?.pendencia_judicial}
          options={[{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }]}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPendencia(e.target.value === 'sim')} />
        {pendencia && (
          <TextArea label="Descreva a pendência" name="pendencia_judicial_descricao"
            defaultValue={data?.pendencia_judicial_descricao} required rows={3} />
        )}

        <div className="space-y-2 mt-2">
          {[
            { name: 'decl_verdadeiro', text: 'Declaro que todas as informações prestadas neste formulário são verdadeiras.' },
            { name: 'decl_compromisso', text: 'Comprometo-me a respeitar as regras e valores da base durante o período de serviço.' },
            { name: 'decl_sem_condenacao_menor', text: 'Declaro não possuir condenação, processo em andamento ou histórico de conduta inadequada envolvendo crianças ou adolescentes.' },
          ].map(decl => (
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
  const [temApoio, setTemApoio] = useState(data?.tem_apoio_financeiro === 'sim')
  return (
    <div className="space-y-4">
      <SectionTitle number="Seção 09" title="Finanças" />
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Select label="Possui apoio financeiro para se manter na base?" name="tem_apoio_financeiro" required
            defaultValue={data?.tem_apoio_financeiro}
            options={[
              { value: 'sim', label: 'Sim' }, { value: 'parcialmente', label: 'Parcialmente' }, { value: 'nao', label: 'Não' },
            ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTemApoio(e.target.value === 'sim' || e.target.value === 'parcialmente')} />
        </div>
        {temApoio && (
          <div className="sm:col-span-2">
            <TextArea label="Descreva seus apoios financeiros" name="apoio_financeiro_descricao"
              defaultValue={data?.apoio_financeiro_descricao} required rows={3}
              placeholder="Ex: igreja, família, mantenedores, recursos próprios…" />
          </div>
        )}
        <div className="sm:col-span-2">
          <TextArea label="Descreva sua situação financeira atual" name="situacao_financeira"
            defaultValue={data?.situacao_financeira} required rows={4}
            placeholder="Como você planeja se sustentar durante o período na base?" />
        </div>
        <div className="sm:col-span-2">
          <Select label="Possui dívidas?" name="tem_dividas" defaultValue={data?.tem_dividas} options={[
            { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
          ]} />
        </div>
      </div>
    </div>
  )
}

function S10DocumentosAceite({ isBrazilian, estadoCivil }: { isBrazilian: boolean; estadoCivil: string }) {
  return (
    <div className="space-y-4">
      <SectionTitle number="Seção 10" title="Documentos e Aceite Final" />

      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800 leading-relaxed">
        Envie os documentos solicitados abaixo. Todas as imagens serão convertidas automaticamente para o formato correto.
        <strong className="block mt-2">Instruções para a foto:</strong>
        Tire uma foto de rosto (tipo 3x4), com fundo claro, rosto centralizado e boa iluminação. Evite selfies com filtros.
      </div>

      <div className="grid gap-4">
        {[
          { name: 'doc_foto', label: 'Foto pessoal (tipo 3x4)', required: true },
          ...(isBrazilian ? [
            { name: 'doc_rg_frente', label: 'RG — Frente', required: true },
            { name: 'doc_rg_verso', label: 'RG — Verso', required: true },
          ] : [
            { name: 'doc_passaporte', label: 'Passaporte (com foto)', required: true },
          ]),
          ...(estadoCivil === 'casado' ? [
            { name: 'doc_certidao_casamento_s10', label: 'Certidão de casamento', required: false },
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
          <h3 className="font-semibold text-gray-900 text-sm mb-2">Lei Geral de Proteção de Dados (LGPD)</h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            Ao enviar este formulário, você autoriza o tratamento dos seus dados pessoais para fins exclusivos
            do processo de seleção de obreiros desta organização missionária, conforme a Lei nº 13.709/2018 (LGPD).
            Seus dados serão armazenados de forma segura e não serão compartilhados com terceiros.
          </p>
        </div>
        <label className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 cursor-pointer">
          <input type="checkbox" name="aceite_lgpd" value="sim" required
            className="mt-0.5 accent-amber-600 flex-shrink-0" />
          <span className="text-sm font-semibold text-amber-800">
            Li e concordo com os termos de tratamento de dados acima.
          </span>
        </label>
        <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 cursor-pointer hover:border-amber-200">
          <input type="checkbox" name="maior_18" value="sim" required
            className="mt-0.5 accent-amber-600 flex-shrink-0" />
          <span className="text-sm text-gray-700">Declaro que sou maior de 18 anos.</span>
        </label>
        <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 cursor-pointer hover:border-amber-200">
          <input type="checkbox" name="decl_ciencia_verificacao" value="sim" required
            className="mt-0.5 accent-amber-600 flex-shrink-0" />
          <span className="text-sm text-gray-700">
            Estou ciente de que meus dados poderão ser objeto de verificação de antecedentes,
            incluindo consulta a certidões e referências, como parte do processo de proteção
            de crianças e adolescentes da organização.
          </span>
        </label>
      </div>
    </div>
  )
}

// ── Tela de sucesso ──────────────────────────────────────────────────────────

function SubmittedScreen({ slug, applicationId, orgName }: {
  slug: string; applicationId: string; orgName: string
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
        <h2 className="text-3xl font-black text-gray-900 mb-3">Formulário enviado!</h2>
        <p className="text-gray-600 max-w-md mx-auto text-base leading-relaxed">
          Obrigado pelo seu interesse em servir na {orgName}. Sua inscrição será analisada pela equipe e entraremos em contato em breve.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-left max-w-md mx-auto space-y-4">
        <h3 className="font-bold text-gray-900 text-center">Próximos passos: Referências</h3>
        <p className="text-sm text-gray-600 text-center">
          Já enviamos por e-mail o pedido de recomendação ao seu pastor (e à liderança da sua
          experiência recente, se informada). Se preferir agilizar por WhatsApp ou outro meio,
          gere o link abaixo e envie você mesmo.
        </p>

        <div className="space-y-2">
          <button onClick={() => gerarLink('pastor')} disabled={loadingPastor}
            className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors text-sm">
            {loadingPastor ? 'Gerando…' : pastorLink ? 'Gerar novo link (Pastor)' : 'Copiar link — Referência do Pastor'}
          </button>
          {pastorLink && (
            <div className="flex items-center gap-2 bg-white border border-amber-200 rounded-xl px-3 py-2">
              <input readOnly value={pastorLink}
                className="flex-1 text-xs text-gray-600 bg-transparent outline-none truncate" />
              <button onClick={() => copyLink(pastorLink, 'pastor')}
                className="text-xs font-semibold text-amber-600 hover:text-amber-800 whitespace-nowrap">
                {copied === 'pastor' ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <button onClick={() => gerarLink('amigo')} disabled={loadingAmigo}
            className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors text-sm">
            {loadingAmigo ? 'Gerando…' : amigoLink ? 'Gerar novo link (Amigo)' : 'Gerar link — Referência do Amigo'}
          </button>
          {amigoLink && (
            <div className="flex items-center gap-2 bg-white border border-purple-200 rounded-xl px-3 py-2">
              <input readOnly value={amigoLink}
                className="flex-1 text-xs text-gray-600 bg-transparent outline-none truncate" />
              <button onClick={() => copyLink(amigoLink, 'amigo')}
                className="text-xs font-semibold text-purple-600 hover:text-purple-800 whitespace-nowrap">
                {copied === 'amigo' ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center">Cada link é único e expira em 30 dias.</p>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

type SectionDef = { id: number; component: React.ReactNode }

export function FormularioObreiro({
  slug, token, applicationId, orgName, ministryName, ministryId, ministries,
  prefill, initialSection = 1, initialData, initialLang, printMode
}: Props) {
  const [lang, setLang] = useState<Lang>((initialLang as Lang) ?? 'pt')
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
    { id: 2, component: <S2Dados prefill={prefill} data={localData.s2} onNationalityChange={setIsBrazilian} /> },
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
      <LangCtx.Provider value={lang}>
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
      </LangCtx.Provider>
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
      await salvarSecaoObreiro(slug, token, sections[currentIndex].id, dataRecord).catch(() => {})
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
          setError('Informe o e-mail ou telefone do pastor.')
          setSaving(false)
          return
        }
      }

      const dataRecord: Record<string, string> = {}
      fd.forEach((v, k) => { if (typeof v === 'string') dataRecord[k] = v })
      const data: Record<string, unknown> = {}
      fd.forEach((v, k) => { data[k] = v })
      const saveResult = await salvarSecaoObreiro(slug, token, sections[currentIndex].id, data)
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
      setError(err instanceof Error ? err.message : 'Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  if (submitted) {
    return <SubmittedScreen slug={slug} applicationId={applicationId} orgName={orgName} />
  }

  return (
    <LangCtx.Provider value={lang}>
    <div>
      <div className="flex justify-end mb-4">
        <LangSwitcher lang={lang} onChange={l => setLang(l as Lang)} uiLabel="Idioma" />
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-500">
            Seção {currentIndex + 1} de {sections.length}
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
              Voltar
            </button>
          ) : <div className="hidden sm:block" />}

          <button type="submit" disabled={saving}
            className="w-full sm:w-auto px-8 py-3 sm:py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors text-center">
            {saving ? 'Salvando…' : isLast ? 'Enviar formulário' : 'Próxima seção →'}
          </button>
        </div>
      </form>
    </div>
    </LangCtx.Provider>
  )
}
