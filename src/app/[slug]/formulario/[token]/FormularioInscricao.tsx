'use client'

import { useState } from 'react'
import { salvarSecao, enviarFormulario } from './actions'

type Prefill = {
  nome?: string
  email?: string
  telefone?: string
  idioma?: string
}

type Props = {
  token: string
  schoolName: string
  className?: string // turma name
  prefill?: Prefill
  initialSection?: number
  initialData?: Record<string, unknown>
}

const TOTAL_SECTIONS = 16 // seção 2 e 17 são textos fixos sem inputs

// ── Helpers ────────────────────────────────────────────────────────────────

function Field({ label, name, defaultValue, placeholder, required, type = 'text' }: {
  label: string; name: string; defaultValue?: string; placeholder?: string; required?: boolean; type?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} required={required}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50" />
    </div>
  )
}

function TextArea({ label, name, defaultValue, placeholder, required, rows = 4 }: {
  label: string; name: string; defaultValue?: string; placeholder?: string; required?: boolean; rows?: number
}) {
  return (
    <div>
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
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select name={name} defaultValue={defaultValue ?? ''} required={required} onChange={onChange}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50">
        <option value="" disabled>Selecione…</option>
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

function S1Email({ prefill }: { prefill?: Prefill }) {
  return (
    <div className="space-y-4">
      <SectionTitle number="Seção 1" title="Identificação inicial" />
      <Field label="E-mail do candidato" name="email" type="email" defaultValue={prefill?.email} required />
    </div>
  )
}

function S3Termo() {
  const termos = [
    'Estou ciente das minhas responsabilidades financeiras relacionadas à escola.',
    'Concordo em ser responsável pelo pagamento dos valores informados pela organização.',
    'Estou ciente de que, em caso de desistência ou desligamento, os valores já pagos poderão não ser estornados.',
    'Não responsabilizo a JOCUM por danos materiais ou físicos que possam ocorrer durante minha permanência na missão, exceto em situações previstas em lei.',
    'Concordo em me submeter aos padrões, orientações, rotinas e programas da missão durante o período da escola.',
    'Concordo em receber atendimento médico, anestesia ou cirurgia, caso seja necessário em situação de emergência.',
    'Estou ciente de que, durante a escola, não é permitido o uso de tabaco, bebidas alcoólicas ou drogas ilícitas.',
    'Estou ciente de que não devo compartilhar medicamentos de uso pessoal com outras pessoas.',
    'Estou ciente de que relacionamentos amorosos iniciados durante a escola podem estar sujeitos a orientações da liderança.',
    'Declaro que preencherei este formulário com informações verdadeiras.',
  ]
  return (
    <div className="space-y-5">
      <SectionTitle number="Seção 3" title="Termo inicial de compromisso" />
      <div className="space-y-2">
        {termos.map((t, i) => (
          <label key={i} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-indigo-200 cursor-pointer">
            <input type="checkbox" name={`termo_${i + 1}`} value="sim" required
              className="mt-0.5 accent-indigo-600 flex-shrink-0" />
            <span className="text-sm text-gray-700">{i + 1}. {t}</span>
          </label>
        ))}
      </div>
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" name="aceite_termos" value="sim" required
            className="mt-0.5 accent-yellow-600 flex-shrink-0" />
          <span className="text-sm font-semibold text-yellow-800">
            Eu li e concordo com todos os termos iniciais deste formulário. *
          </span>
        </label>
      </div>
    </div>
  )
}

function S4Escola({ schoolName, className }: { schoolName: string; className?: string }) {
  return (
    <div className="space-y-4">
      <SectionTitle number="Seção 4" title="Informações da escola de interesse" />
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Escola desejada" name="escola" defaultValue={schoolName} required />
        <Field label="Turma / Período" name="turma" defaultValue={className ?? ''} />
        <div className="sm:col-span-2">
          <Select label="Como conheceu esta escola?" name="como_conheceu" required options={[
            { value: 'indicacao', label: 'Indicação de alguém' },
            { value: 'redes_sociais', label: 'Redes sociais' },
            { value: 'site', label: 'Site da JOCUM' },
            { value: 'evento', label: 'Evento ou culto' },
            { value: 'church', label: 'Igreja' },
            { value: 'outro', label: 'Outro' },
          ]} />
        </div>
        <div className="sm:col-span-2">
          <Field label="Como conheceu a JOCUM?" name="como_conheceu_jocum" />
        </div>
        <Select label="Já conversou com alguém da equipe?" name="conversou_equipe" required options={[
          { value: 'sim', label: 'Sim' },
          { value: 'nao', label: 'Não' },
        ]} />
        <Field label="Com quem conversou? (se sim)" name="conversou_com_quem" />
        <div className="sm:col-span-2">
          <TextArea label="Por que deseja participar desta escola?" name="motivacao" required rows={4} />
        </div>
      </div>
    </div>
  )
}

function S5Dados({ prefill }: { prefill?: Prefill }) {
  const [estrangeiro, setEstrangeiro] = useState(false)
  const [estudando, setEstudando] = useState(false)
  return (
    <div className="space-y-4">
      <SectionTitle number="Seção 5" title="Informações pessoais" />
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Field label="Nome completo" name="nome" defaultValue={prefill?.nome} required />
        </div>
        <Select label="Sexo" name="sexo" required options={[
          { value: 'M', label: 'Masculino' },
          { value: 'F', label: 'Feminino' },
        ]} />
        <Field label="Data de nascimento" name="data_nascimento" type="date" required />
        <Select label="Estado civil" name="estado_civil" required options={[
          { value: 'solteiro', label: 'Solteiro(a)' },
          { value: 'casado', label: 'Casado(a)' },
          { value: 'divorciado', label: 'Divorciado(a)' },
          { value: 'viuvo', label: 'Viúvo(a)' },
        ]} />
        <Select label="Você é brasileiro?" name="is_brasileiro" required options={[
          { value: 'sim', label: 'Sim' },
          { value: 'nao', label: 'Não' },
        ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEstrangeiro(e.target.value === 'nao')} />
        {estrangeiro && <>
          <Field label="Sua nacionalidade" name="nacionalidade" required />
          <Select label="Nível de fluência em português" name="fluencia_portugues" options={[
            { value: 'basico', label: 'Básico' },
            { value: 'intermediario', label: 'Intermediário' },
            { value: 'avancado', label: 'Avançado' },
            { value: 'fluente', label: 'Fluente' },
          ]} />
        </>}

        {/* Formação */}
        <div className="sm:col-span-2 mt-2"><p className="text-sm font-semibold text-gray-700 border-t pt-3">Formação e profissão</p></div>
        <Field label="Formação / escolaridade" name="formacao" />
        <Select label="Está estudando atualmente?" name="estudando" required options={[
          { value: 'sim', label: 'Sim' },
          { value: 'nao', label: 'Não' },
        ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEstudando(e.target.value === 'sim')} />
        {estudando && <div className="sm:col-span-2"><Field label="Qual curso e instituição?" name="curso_atual" /></div>}
        <Field label="Profissão / ocupação atual" name="profissao" />
        <Select label="Trabalha atualmente?" name="trabalha" required options={[
          { value: 'sim', label: 'Sim' },
          { value: 'nao', label: 'Não' },
        ]} />
        <div className="sm:col-span-2">
          <TextArea label="Principais experiências profissionais" name="experiencias" rows={3} />
        </div>
        <div className="sm:col-span-2">
          <TextArea label="Principais habilidades (artísticas, técnicas, ministeriais etc.)" name="habilidades" rows={3} />
        </div>

        {/* Idiomas */}
        <div className="sm:col-span-2 mt-2"><p className="text-sm font-semibold text-gray-700 border-t pt-3">Idiomas</p></div>
        {['Português','Inglês','Espanhol'].map(idioma => (
          <div key={idioma}>
            <Select label={idioma} name={`idioma_${idioma.toLowerCase()}`} defaultValue={idioma === 'Português' ? 'nativo' : ''} options={[
              { value: 'nativo', label: 'Nativo' },
              { value: 'basico', label: 'Básico' },
              { value: 'intermediario', label: 'Intermediário' },
              { value: 'avancado', label: 'Avançado' },
              { value: 'fluente', label: 'Fluente' },
              { value: 'nao_falo', label: 'Não falo' },
            ]} />
          </div>
        ))}
        <Field label="Outro idioma e nível" name="outro_idioma" placeholder="Ex: Francês — Intermediário" />

        {/* Documentos */}
        <div className="sm:col-span-2 mt-2"><p className="text-sm font-semibold text-gray-700 border-t pt-3">Documentos</p></div>
        <Field label="RG / Documento de identificação" name="rg" />
        <Field label="CPF" name="cpf" placeholder="000.000.000-00" />
        <Field label="Passaporte (se possuir)" name="passaporte" />
        <Select label="Prestou serviço militar?" name="servico_militar" options={[
          { value: 'sim', label: 'Sim' },
          { value: 'nao', label: 'Não' },
          { value: 'nao_aplicavel', label: 'Não se aplica' },
        ]} />

        {/* Endereço */}
        <div className="sm:col-span-2 mt-2"><p className="text-sm font-semibold text-gray-700 border-t pt-3">Endereço e contato</p></div>
        <Field label="Endereço completo" name="endereco" />
        <Field label="CEP" name="cep" placeholder="00000-000" />
        <Field label="Bairro" name="bairro" />
        <Field label="Cidade" name="cidade" required />
        <Field label="Estado / Provincia" name="estado" required />
        <Field label="País" name="pais" defaultValue="Brasil" required />
        <Field label="E-mail" name="email_contato" type="email" defaultValue={prefill?.email} required />
        <Field label="Celular / WhatsApp" name="celular" type="tel" defaultValue={prefill?.telefone} />

        {/* Redes sociais */}
        <div className="sm:col-span-2 mt-2"><p className="text-sm font-semibold text-gray-700 border-t pt-3">Redes sociais</p></div>
        <Field label="Instagram" name="instagram" placeholder="@usuario" />
        <Field label="Facebook" name="facebook" />
        <Field label="TikTok" name="tiktok" />
        <Field label="LinkedIn" name="linkedin" />
        <div className="sm:col-span-2"><Field label="Outros (site, canal, portfólio)" name="outros_links" /></div>

        {/* Emergência */}
        <div className="sm:col-span-2 mt-2"><p className="text-sm font-semibold text-gray-700 border-t pt-3">Contato de emergência</p></div>
        <Field label="Nome" name="emergencia_nome" required />
        <Field label="Grau de parentesco" name="emergencia_parentesco" required />
        <Field label="Telefone / WhatsApp" name="emergencia_telefone" type="tel" required />
        <Field label="E-mail" name="emergencia_email" type="email" />
        <Field label="Cidade e estado" name="emergencia_cidade" />
      </div>
    </div>
  )
}

function S6Historia() {
  return (
    <div className="space-y-4">
      <SectionTitle number="Seção 6" title="Histórico pessoal e contexto de vida" />
      <div className="grid gap-4">
        <TextArea label="Conte um pouco sobre você" name="sobre_voce" required rows={5} />
        <TextArea label="Como foi seu processo de decisão para esta escola?" name="processo_decisao" required rows={4} />
        <TextArea label="O que você espera viver, aprender ou desenvolver?" name="expectativas" required rows={4} />
        <TextArea label="Quais são suas principais motivações?" name="motivacoes" required rows={3} />
        <TextArea label="Responsabilidades atuais que podem interferir na participação?" name="responsabilidades" rows={3} />
      </div>
    </div>
  )
}

function S7Familia() {
  const [estadoCivil, setEstadoCivil] = useState('')
  const [temFilhos, setTemFilhos] = useState(false)
  return (
    <div className="space-y-4">
      <SectionTitle number="Seção 7" title="Informações familiares" />
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Nome do pai" name="nome_pai" />
        <Field label="Nome da mãe" name="nome_mae" />
        <Select label="Seus pais são cristãos?" name="pais_cristaos" options={[
          { value: 'ambos', label: 'Ambos' },
          { value: 'apenas_um', label: 'Apenas um' },
          { value: 'nenhum', label: 'Nenhum' },
        ]} />
        <Select label="Sua família apoia sua participação?" name="familia_apoia" required options={[
          { value: 'sim', label: 'Sim' },
          { value: 'parcialmente', label: 'Parcialmente' },
          { value: 'nao', label: 'Não' },
        ]} />
        <div className="sm:col-span-2">
          <TextArea label="Situação familiar que a equipe deveria saber?" name="situacao_familiar" rows={3} />
        </div>

        <div className="sm:col-span-2 mt-2">
          <Select label="Estado civil atual" name="estado_civil_atual" required options={[
            { value: 'solteiro', label: 'Solteiro(a)' },
            { value: 'casado', label: 'Casado(a)' },
            { value: 'comprometido', label: 'Comprometido(a)' },
            { value: 'divorciado', label: 'Divorciado(a)' },
          ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEstadoCivil(e.target.value)} />
        </div>

        {estadoCivil === 'casado' && <>
          <Field label="Nome e idade do cônjuge" name="conjuge_nome_idade" />
          <Field label="Há quanto tempo casados?" name="tempo_casados" />
          <Select label="Cônjuge apoia a participação?" name="conjuge_apoia" options={[
            { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
          ]} />
          <Select label="Cônjuge também participará?" name="conjuge_participa" options={[
            { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
          ]} />
        </>}

        {estadoCivil === 'comprometido' && <>
          <Field label="Há quanto tempo comprometido(a)?" name="tempo_compromisso" />
          <Select label="A pessoa apoia sua participação?" name="compromisso_apoia" options={[
            { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
          ]} />
          <div className="sm:col-span-2">
            <TextArea label="Situação relacional que a equipe deveria saber?" name="situacao_relacional" rows={2} />
          </div>
        </>}

        <div className="sm:col-span-2 mt-2">
          <Select label="Tem filhos?" name="tem_filhos" options={[
            { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
          ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTemFilhos(e.target.value === 'sim')} />
        </div>
        {temFilhos && <>
          <div className="sm:col-span-2">
            <TextArea label="Nome e idade dos filhos" name="filhos_dados" rows={2} />
          </div>
          <Select label="Filhos virão com você?" name="filhos_virao" options={[
            { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
          ]} />
          <Field label="Caso não venham, com quem ficarão?" name="filhos_ficam_com" />
        </>}
      </div>
    </div>
  )
}

function S8Igreja() {
  const [participa, setParticipa] = useState(false)
  const [lideranca, setLideranca] = useState(false)
  const [conversou, setConversou] = useState(false)
  return (
    <div className="space-y-4">
      <SectionTitle number="Seção 8" title="Igreja local e envolvimento ministerial" />
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><Field label="Nome da sua igreja" name="igreja_nome" required /></div>
        <Field label="Cidade e estado da igreja" name="igreja_cidade" required />
        <Field label="Há quanto tempo frequenta?" name="tempo_igreja" required />
        <Select label="Membro oficial da igreja?" name="membro_oficial" options={[
          { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
        ]} />
        <Select label="Participa de algum ministério?" name="tem_ministerio" options={[
          { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
        ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setParticipa(e.target.value === 'sim')} />
        {participa && <>
          <Field label="Qual ministério?" name="ministerio_qual" />
          <Field label="Há quanto tempo?" name="ministerio_tempo" />
          <Select label="Ocupa cargo de liderança?" name="tem_lideranca" options={[
            { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
          ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLideranca(e.target.value === 'sim')} />
          {lideranca && <Field label="Qual cargo?" name="lideranca_cargo" />}
          <div className="sm:col-span-2">
            <TextArea label="Suas principais responsabilidades na igreja" name="responsabilidades_igreja" rows={3} />
          </div>
        </>}

        <div className="sm:col-span-2 mt-2 border-t pt-3">
          <p className="text-sm font-semibold text-gray-700 mb-3">Dados do pastor / líder responsável</p>
        </div>
        <Select label="Já conversou com seu pastor sobre a escola?" name="conversou_pastor" required options={[
          { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
        ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setConversou(e.target.value === 'sim')} />
        {conversou && <>
          <Select label="Seu pastor concorda com sua participação?" name="pastor_concorda" options={[
            { value: 'sim', label: 'Sim' }, { value: 'parcialmente', label: 'Parcialmente' }, { value: 'nao', label: 'Não' },
          ]} />
        </>}
        <Field label="Nome do pastor / líder" name="pastor_nome" required />
        <Field label="Cargo / função" name="pastor_cargo" />
        <Field label="E-mail" name="pastor_email" type="email" required />
        <Field label="Telefone / WhatsApp" name="pastor_telefone" type="tel" required />
        <div className="sm:col-span-2">
          <InfoBox>
            Será enviado um formulário confidencial para o pastor ou líder indicado. O processo seletivo depende do recebimento dessa recomendação.
          </InfoBox>
        </div>
      </div>
    </div>
  )
}

function S9Referencia() {
  return (
    <div className="space-y-4">
      <SectionTitle number="Seção 9" title="Referência pessoal" />
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><Field label="Nome da referência" name="ref_nome" required /></div>
        <Field label="Grau de relacionamento" name="ref_relacionamento" required />
        <Field label="Há quanto tempo se conhecem?" name="ref_tempo" required />
        <Select label="Essa pessoa é cristã?" name="ref_crista" options={[
          { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
        ]} />
        <Field label="E-mail" name="ref_email" type="email" required />
        <Field label="Telefone / WhatsApp" name="ref_telefone" type="tel" required />
        <div className="sm:col-span-2">
          <InfoBox>
            Será enviado um formulário confidencial para a referência pessoal indicada. O processo seletivo depende dessa recomendação.
          </InfoBox>
        </div>
      </div>
    </div>
  )
}

function S10Historico() {
  const [teve, setTeve] = useState(false)
  return (
    <div className="space-y-4">
      <SectionTitle number="Seção 10" title="Histórico com JOCUM ou outras organizações" />
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Select label="Já participou de escola, seminário ou projeto missionário?" name="teve_historico" required options={[
            { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
          ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTeve(e.target.value === 'sim')} />
        </div>
        {teve && <>
          <div className="sm:col-span-2"><Field label="Qual escola / projeto?" name="hist_qual" /></div>
          <Field label="Organização / base" name="hist_org" />
          <Field label="Duração" name="hist_duracao" />
          <Field label="Quando?" name="hist_quando" />
          <Field label="Líder responsável" name="hist_lider_nome" />
          <Field label="E-mail do líder" name="hist_lider_email" type="email" />
          <Field label="Telefone do líder" name="hist_lider_tel" type="tel" />
          <div className="sm:col-span-2">
            <InfoBox>
              A equipe poderá entrar em contato com a liderança anterior para solicitar recomendações pessoais.
            </InfoBox>
          </div>
        </>}
      </div>
    </div>
  )
}

const AREAS_AUTOAVALIACAO = [
  'Liderança','Obediência','Vida devocional','Facilidade de aprender','Maturidade pessoal',
  'Trabalho em equipe','Habilidade para falar em público','Comunicação','Organização',
  'Pontualidade','Flexibilidade','Relacionamento com autoridade',
  'Resolução de conflitos','Capacidade de lidar com pressão','Comportamento em situações difíceis',
]

function S11Espiritual() {
  const [fezPsico, setFezPsico] = useState(false)
  const [fezRecup, setFezRecup] = useState(false)
  return (
    <div className="space-y-5">
      <SectionTitle number="Seção 11" title="Avaliação pessoal, espiritual e emocional" />

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Autoavaliação — avalie cada área:</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-1/2">Área</th>
                {['Ótimo','Bom','Regular','Preciso melhorar'].map(op => (
                  <th key={op} className="text-center px-2 py-2 font-medium text-gray-600 text-xs">{op}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {AREAS_AUTOAVALIACAO.map(area => (
                <tr key={area} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-700">{area}</td>
                  {['otimo','bom','regular','melhorar'].map(val => (
                    <td key={val} className="text-center px-2 py-2">
                      <input type="radio" name={`autoaval_${area.toLowerCase().replace(/\s/g,'_')}`}
                        value={val} required className="accent-indigo-600" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="mt-2 border-t pt-3"><p className="text-sm font-semibold text-gray-700">Vida cristã</p></div>
        <Field label="Há quanto tempo é convertido?" name="tempo_convertido" required />
        <TextArea label="Conte como foi sua experiência de conversão" name="conversao" required rows={4} />
        <TextArea label="Como está sua vida com Deus atualmente?" name="vida_deus" required rows={3} />
        <TextArea label="Como é sua rotina devocional?" name="devocional" rows={3} />
        <TextArea label="Áreas espirituais que deseja desenvolver" name="crescimento_espiritual" rows={3} />

        <div className="mt-2 border-t pt-3"><p className="text-sm font-semibold text-gray-700">Chamado e missão</p></div>
        <Select label="Acredita ter um chamado missionário?" name="chamado" required options={[
          { value: 'sim', label: 'Sim' }, { value: 'em_discernimento', label: 'Em discernimento' }, { value: 'nao', label: 'Não' },
        ]} />
        <TextArea label="Como entende esse chamado hoje?" name="chamado_descricao" rows={3} />
        <TextArea label="Quais povos, lugares ou temas despertam seu coração?" name="visao_missoes" rows={3} />

        <div className="mt-2 border-t pt-3"><p className="text-sm font-semibold text-gray-700">Saúde emocional</p></div>
        <Select label="Já fez ou faz acompanhamento psicológico?" name="psicologico" required options={[
          { value: 'sim_faz', label: 'Sim, faço atualmente' },
          { value: 'sim_fez', label: 'Sim, já fiz' },
          { value: 'nao', label: 'Não' },
        ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFezPsico(e.target.value !== 'nao')} />
        {fezPsico && <TextArea label="Diagnóstico ou situação que a equipe deveria saber?" name="diagnostico_emocional" rows={3} />}
        <Select label="Está aberto(a) a acompanhamento pastoral?" name="acompanhamento_pastoral" options={[
          { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
        ]} />

        <div className="mt-2 border-t pt-3"><p className="text-sm font-semibold text-gray-700">Histórico de recuperação</p></div>
        <Select label="Já esteve em casa de recuperação ou reabilitação?" name="recuperacao" options={[
          { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
        ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFezRecup(e.target.value === 'sim')} />
        {fezRecup && <>
          <Field label="Qual? Por quanto tempo? Quando?" name="recuperacao_detalhes" />
          <TextArea label="Como avalia sua condição atual nessa área?" name="recuperacao_hoje" rows={3} />
        </>}
      </div>
    </div>
  )
}

function S12Saude() {
  const [usaMed, setUsaMed] = useState(false)
  return (
    <div className="space-y-4">
      <SectionTitle number="Seção 12" title="Saúde física e medicamentos" />
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><TextArea label="Problemas de saúde que a equipe deveria saber" name="saude_geral" rows={3} /></div>
        <Field label="Alergias" name="alergias" />
        <Field label="Restrição alimentar" name="restricao_alimentar" />
        <Field label="Limitação física" name="limitacao_fisica" />
        <div className="sm:col-span-2"><Field label="Cirurgias importantes" name="cirurgias" /></div>

        <div className="sm:col-span-2 mt-2 border-t pt-3">
          <Select label="Usa medicamento contínuo ou controlado?" name="usa_medicamento" required options={[
            { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
          ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setUsaMed(e.target.value === 'sim')} />
        </div>
        {usaMed && <>
          <Field label="Qual medicamento?" name="med_nome" />
          <Field label="Motivo / diagnóstico" name="med_motivo" />
          <Field label="Dosagem" name="med_dosagem" />
          <Select label="Possui receita médica?" name="med_receita" options={[
            { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
          ]} />
        </>}

        <div className="sm:col-span-2 mt-2 border-t pt-3">
          <Select label="Possui plano de saúde?" name="plano_saude" options={[
            { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
          ]} />
        </div>
        <Field label="Qual plano?" name="plano_saude_qual" />
        <div className="sm:col-span-2"><TextArea label="Orientações de emergência médica" name="emergencia_medica" rows={2} /></div>
      </div>
    </div>
  )
}

function S13Legal() {
  const [temAntecedente, setTemAntecedente] = useState(false)
  return (
    <div className="space-y-4">
      <SectionTitle number="Seção 13" title="Questões legais e responsabilidade" />
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Select label="Tem algum antecedente criminal?" name="antecedente" required options={[
            { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
          ]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTemAntecedente(e.target.value === 'sim')} />
        </div>
        {temAntecedente && (
          <div className="sm:col-span-2"><TextArea label="Explique:" name="antecedente_descricao" rows={3} /></div>
        )}
        <div className="sm:col-span-2">
          <Select label="Tem pendência jurídica ou processo criminal?" name="pendencia_juridica" required options={[
            { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
          ]} />
        </div>
        <div className="sm:col-span-2">
          <Select label="Existe restrição legal para viagens ou atividades externas?" name="restricao_legal" options={[
            { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
          ]} />
        </div>
        <div className="sm:col-span-2">
          <div className="space-y-2 mt-2">
            {[
              { name: 'decl_verdadeiro', label: 'Declaro que as informações fornecidas são verdadeiras.' },
              { name: 'decl_compromisso', label: 'Me comprometo a informar a equipe caso alguma informação importante mude.' },
              { name: 'decl_referencias', label: 'Autorizo a equipe a entrar em contato com minhas referências.' },
            ].map(d => (
              <label key={d.name} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 cursor-pointer hover:border-indigo-200">
                <input type="checkbox" name={d.name} value="sim" required className="mt-0.5 accent-indigo-600 flex-shrink-0" />
                <span className="text-sm text-gray-700">{d.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function S14Financeiro() {
  return (
    <div className="space-y-4">
      <SectionTitle number="Seção 14" title="Informações financeiras" />
      <InfoBox>
        A participação na escola envolve custos relacionados a inscrição, hospedagem, alimentação, aulas, materiais e deslocamentos. Confira os valores específicos com a equipe responsável.
      </InfoBox>
      <div className="grid sm:grid-cols-2 gap-4">
        <Select label="Tipo de apoio financeiro" name="apoio_tipo" required options={[
          { value: 'proprio', label: 'Renda própria' },
          { value: 'familia', label: 'Família' },
          { value: 'igreja', label: 'Igreja' },
          { value: 'mantenedores', label: 'Mantenedores' },
          { value: 'misto', label: 'Misto' },
        ]} />
        <Select label="Sua igreja ajudará financeiramente?" name="ajuda_igreja" options={[
          { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }, { value: 'em_conversa', label: 'Em conversa' },
        ]} />
        <Select label="Tem condições de pagar toda a escola?" name="pagar_tudo" required options={[
          { value: 'sim', label: 'Sim' },
          { value: 'parcialmente', label: 'Parcialmente' },
          { value: 'nao', label: 'Não, preciso levantar apoio' },
        ]} />
        <Select label="Pretende levantar mantenedores?" name="mantenedores" options={[
          { value: 'sim_ja_iniciou', label: 'Sim, já iniciei' },
          { value: 'sim_nao_iniciou', label: 'Sim, ainda não iniciei' },
          { value: 'nao', label: 'Não' },
        ]} />
        <div className="sm:col-span-2">
          <TextArea label="Comente sobre sua situação financeira atual e como pretende se organizar" name="situacao_financeira" required rows={4} />
        </div>
        <div className="sm:col-span-2">
          <Select label="Possui dívidas?" name="dividas" options={[
            { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' },
          ]} />
        </div>
      </div>
    </div>
  )
}

function S15Documentos() {
  return (
    <div className="space-y-4">
      <SectionTitle number="Seção 15" title="Upload de documentos" />
      <InfoBox>
        Anexe os documentos solicitados abaixo. Formatos aceitos: JPG, PNG, PDF (máx. 20MB cada).
      </InfoBox>
      <div className="grid gap-4">
        {[
          { name: 'doc_foto', label: 'Foto recente (rosto visível) *', required: true },
          { name: 'doc_rg_frente', label: 'RG / Documento — frente *', required: true },
          { name: 'doc_rg_verso', label: 'RG / Documento — verso *', required: true },
          { name: 'doc_cpf', label: 'CPF (se não constar no documento principal)' },
          { name: 'doc_passaporte', label: 'Passaporte (se possuir)' },
        ].map(d => (
          <div key={d.name}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {d.label}
            </label>
            <input type="file" name={d.name} accept="image/jpeg,image/png,image/webp,application/pdf"
              required={d.required}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer" />
          </div>
        ))}
      </div>
    </div>
  )
}

function S16Aceite() {
  return (
    <div className="space-y-4">
      <SectionTitle number="Seção 16" title="Aceite final e declarações" />
      <div className="space-y-3">
        <label className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 hover:border-indigo-300 cursor-pointer bg-gray-50">
          <input type="checkbox" name="maior_18" value="sim" required className="mt-0.5 accent-indigo-600 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-800">Declaro que sou maior de 18 anos. *</span>
        </label>
        {[
          { name: 'final_verdadeiro', label: 'Respondi este formulário com sinceridade.' },
          { name: 'final_ciente_avaliacao', label: 'Estou ciente de que minha inscrição será avaliada pela equipe responsável.' },
          { name: 'final_sem_garantia', label: 'Estou ciente de que o preenchimento não garante automaticamente minha aceitação.' },
          { name: 'final_autorizo_contato', label: 'Autorizo o contato com as referências indicadas neste formulário.' },
          { name: 'final_documentos_adicionais', label: 'Estou ciente de que poderei ser solicitado(a) a enviar informações ou documentos complementares.' },
        ].map(d => (
          <label key={d.name} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-indigo-200 cursor-pointer">
            <input type="checkbox" name={d.name} value="sim" required className="mt-0.5 accent-indigo-600 flex-shrink-0" />
            <span className="text-sm text-gray-700">{d.label} *</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

type SectionDef = { id: number; component: React.ReactNode }

export function FormularioInscricao({ token, schoolName, className, prefill, initialSection = 1 }: Props) {
  const [current, setCurrent] = useState(initialSection)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const sections: SectionDef[] = [
    { id: 1,  component: <S1Email prefill={prefill} /> },
    { id: 3,  component: <S3Termo /> },
    { id: 4,  component: <S4Escola schoolName={schoolName} className={className} /> },
    { id: 5,  component: <S5Dados prefill={prefill} /> },
    { id: 6,  component: <S6Historia /> },
    { id: 7,  component: <S7Familia /> },
    { id: 8,  component: <S8Igreja /> },
    { id: 9,  component: <S9Referencia /> },
    { id: 10, component: <S10Historico /> },
    { id: 11, component: <S11Espiritual /> },
    { id: 12, component: <S12Saude /> },
    { id: 13, component: <S13Legal /> },
    { id: 14, component: <S14Financeiro /> },
    { id: 15, component: <S15Documentos /> },
    { id: 16, component: <S16Aceite /> },
  ]

  const currentIndex = sections.findIndex(s => s.id === current)
  const isLast = currentIndex === sections.length - 1
  const progress = Math.round(((currentIndex + 1) / sections.length) * 100)

  async function handleNext(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    try {
      const fd = new FormData(e.currentTarget)
      const data: Record<string, unknown> = {}
      fd.forEach((v, k) => { data[k] = v })
      await salvarSecao(token, sections[currentIndex].id, data)

      if (isLast) {
        await enviarFormulario(token)
        setSubmitted(true)
      } else {
        setCurrent(sections[currentIndex + 1].id)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } finally {
      setSaving(false)
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-20 px-8">
        <div className="text-6xl mb-6">🙏</div>
        <h2 className="text-3xl font-black text-gray-900 mb-3">Formulário enviado!</h2>
        <p className="text-gray-600 max-w-md mx-auto text-lg leading-relaxed">
          Obrigado por preencher sua inscrição. A equipe responsável pela <strong>{schoolName}</strong> entrará em contato com os próximos passos.
        </p>
        <p className="text-sm text-gray-400 mt-6">
          Avise seu pastor/líder e sua referência pessoal — eles podem receber um formulário de recomendação.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-500">
            Seção {currentIndex + 1} de {sections.length}
          </span>
          <span className="text-xs font-semibold text-indigo-600">{progress}%</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }} />
        </div>
      </div>

      <form onSubmit={handleNext} className="space-y-6">
        {sections[currentIndex].component}

        <div className="flex items-center justify-between pt-6 border-t border-gray-100">
          {currentIndex > 0 ? (
            <button type="button"
              onClick={() => { setCurrent(sections[currentIndex - 1].id); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              className="px-6 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              ← Anterior
            </button>
          ) : <div />}

          <button type="submit" disabled={saving}
            className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors">
            {saving ? 'Salvando…' : isLast ? 'Enviar formulário ✓' : 'Próximo →'}
          </button>
        </div>
      </form>
    </div>
  )
}
