const LAST_UPDATED = '28 de setembro de 2026'
const PLATFORM_EMAIL = 'privacidade@sisgomission.com'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg sm:text-xl font-bold text-white mb-3">{title}</h2>
      <div className="space-y-3 text-sm sm:text-base text-zinc-400 leading-relaxed">
        {children}
      </div>
    </section>
  )
}

type Org = { name: string; email: string | null } | null

/**
 * Corpo da Política de Privacidade — reaproveitado em `/privacidade`
 * (genérica, plataforma) e `/[slug]/privacidade` (com o contato da própria
 * organização). Passe `org` pra contextualizar a seção 11 com o e-mail da
 * base; sem `org`, mostra só o contato da plataforma.
 */
export function PrivacyPolicyContent({ org }: { org?: Org }) {
  return (
    <>
      <section className="px-5 sm:px-8 pt-16 pb-4 max-w-3xl mx-auto w-full">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-3">Legal</p>
        <h1 className="text-3xl sm:text-5xl font-bold mb-3">Política de Privacidade</h1>
        <p className="text-zinc-500 text-sm">
          {org ? `${org.name} · ` : ''}Última atualização: {LAST_UPDATED}
        </p>
      </section>

      <section className="px-5 sm:px-8 pb-20 max-w-3xl mx-auto w-full">
        <p className="mt-6 text-sm sm:text-base text-zinc-400 leading-relaxed">
          O SISGO é um sistema de gestão usado por organizações missionárias e
          educacionais (bases, escolas, ministérios) para administrar pessoas,
          inscrições, finanças e demais atividades internas. Esta política
          explica quais dados coletamos por meio da plataforma, para que
          servem, com quem podem ser compartilhados e quais direitos você tem
          sobre eles, em conformidade com a Lei Geral de Proteção de Dados
          (LGPD — Lei nº 13.709/2018).
        </p>

        <Section title="1. Controlador e operador dos dados">
          <p>
            {org ? (
              <>A <strong className="text-zinc-200">{org.name}</strong>, organização com quem você está se
              inscrevendo ou já faz parte, é a{' '}</>
            ) : (
              <>Cada organização que usa o SISGO (a base, escola ou ministério com
              quem você está se inscrevendo ou já faz parte) é a{' '}</>
            )}
            <strong className="text-zinc-200">controladora</strong> dos seus
            dados — é ela quem decide coletar suas informações e para quais
            finalidades, dentro do próprio processo de inscrição, matrícula ou
            vínculo como obreiro. O SISGO atua como{' '}
            <strong className="text-zinc-200">operador</strong>: fornecemos a
            plataforma técnica onde esses dados são armazenados e
            processados, seguindo as instruções e finalidades definidas por
            {org ? ' ela' : ' cada organização'}, sem usá-los para finalidades próprias alheias
            a isso.
          </p>
          <p>
            {org
              ? <>Dúvidas sobre os dados que a {org.name} coletou de você devem ser
                direcionadas primeiro a ela (contato na seção 11). Dúvidas sobre a
                plataforma em si podem ser enviadas pelo contato da SISGO, também
                na seção 11.</>
              : <>Dúvidas sobre os dados que uma organização específica coletou de
                você devem ser direcionadas primeiro a ela — a maioria das
                páginas públicas de cada base/escola no SISGO traz um contato
                direto. Dúvidas sobre a plataforma em si podem ser enviadas pelo
                contato ao final desta página.</>}
          </p>
        </Section>

        <Section title="2. Quais dados coletamos">
          <p>Dependendo do seu vínculo (visitante, aluno, obreiro, voluntário, líder), podemos tratar:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong className="text-zinc-200">Identificação:</strong> nome completo, data de nascimento, sexo, estado civil, nacionalidade, foto.</li>
            <li><strong className="text-zinc-200">Documentos:</strong> RG, CPF, CNH e/ou passaporte (imagens enviadas por você).</li>
            <li><strong className="text-zinc-200">Contato:</strong> e-mail, telefone e endereço.</li>
            <li><strong className="text-zinc-200">Saúde:</strong> informações sobre condições médicas relevantes, quando o formulário de inscrição solicitar — dado sensível, tratado com controle de acesso restrito à equipe responsável.</li>
            <li><strong className="text-zinc-200">Formação e experiência:</strong> escolaridade, profissão, idiomas, experiências e habilidades relevantes para a função ou escola.</li>
            <li><strong className="text-zinc-200">Financeiro:</strong> lançamentos, cobranças e comprovantes de pagamento relacionados à sua participação.</li>
            <li><strong className="text-zinc-200">Uso da plataforma:</strong> presença/check-in, reservas, refeições, uso de lavanderia, mensagens em canais internos de comunicação, conforme os módulos ativados pela organização.</li>
          </ul>
          <p>
            Você preenche a maior parte desses dados diretamente nos
            formulários de inscrição ou cadastro. Alguns registros de uso
            (presença, reservas etc.) são gerados automaticamente pela
            plataforma conforme sua interação com ela.
          </p>
        </Section>

        <Section title="3. Para que usamos seus dados">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Avaliar e processar sua inscrição como aluno, obreiro ou voluntário;</li>
            <li>Organizar turmas, escalas, hospedagem, refeições e demais logística interna;</li>
            <li>Emitir carteirinhas, controlar presença e gerir finanças relacionadas à sua participação;</li>
            <li>Comunicar avisos, eventos e informações relevantes da organização;</li>
            <li>Cumprir obrigações legais e regulatórias aplicáveis à organização.</li>
          </ul>
        </Section>

        <Section title="4. Com quem compartilhamos">
          <p>
            Dentro da organização, o acesso aos seus dados é restrito por
            papel — por exemplo, apenas a liderança da sua escola/ministério e
            o Departamento Humano (DH) costumam ver o formulário completo de
            inscrição; outros papéis só enxergam o necessário para sua
            função. Não vendemos nem compartilhamos seus dados com terceiros
            para fins de marketing.
          </p>
          <p>
            Usamos prestadores de serviço para operar a plataforma — hospedagem
            e banco de dados (Supabase) e, quando aplicável, processadores de
            pagamento para cobranças e refeições. Esses prestadores tratam os
            dados apenas para viabilizar o funcionamento do sistema, sob as
            mesmas obrigações de confidencialidade.
          </p>
        </Section>

        <Section title="5. Armazenamento e segurança">
          <p>
            Os dados ficam armazenados em banco de dados com controle de
            acesso por autenticação e por papel (cada pessoa só acessa o que
            sua função permite), e o tráfego entre seu dispositivo e o SISGO
            é criptografado (HTTPS). Documentos e fotos enviados ficam em
            armazenamento próprio, com acesso restrito. Nenhum sistema é
            infalível, mas adotamos práticas razoáveis de segurança e as
            revisamos continuamente.
          </p>
        </Section>

        <Section title="6. Por quanto tempo guardamos">
          <p>
            Mantemos seus dados enquanto durar seu vínculo com a organização
            e pelo tempo adicional necessário para cumprir obrigações legais,
            fiscais ou contratuais (por exemplo, registros financeiros). Após
            esse período, ou mediante solicitação de exclusão válida, os
            dados são removidos ou anonimizados, ressalvado o que a lei
            exigir manter.
          </p>
        </Section>

        <Section title="7. Seus direitos">
          <p>Conforme a LGPD, você pode solicitar, a qualquer momento:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Confirmação de que tratamos seus dados, e acesso a eles;</li>
            <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
            <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade com a lei;</li>
            <li>Portabilidade dos dados a outro fornecedor, quando aplicável;</li>
            <li>Revogação do consentimento e eliminação dos dados tratados com base nele;</li>
            <li>Informação sobre com quem seus dados foram compartilhados.</li>
          </ul>
          <p>
            Para exercer esses direitos, entre em contato com a organização
            responsável pelo seu cadastro (ela é quem pode alterar/excluir os
            dados na prática) ou conosco, pelo contato abaixo — vamos
            encaminhar sua solicitação.
          </p>
        </Section>

        <Section title="8. Cookies e dados de navegação">
          <p>
            Usamos apenas o essencial para o funcionamento da plataforma:
            cookies/armazenamento local para manter sua sessão logada e
            lembrar preferências de exibição (como tema ou visualização
            escolhida). Não usamos cookies de rastreamento publicitário.
          </p>
        </Section>

        <Section title="9. Menores de idade">
          <p>
            Alguns programas (ex.: escolas) podem aceitar participantes
            menores de 18 anos. Nesses casos, a coleta de dados segue as
            exigências adicionais da LGPD para crianças e adolescentes,
            incluindo consentimento de um responsável legal quando exigido
            pela organização.
          </p>
        </Section>

        <Section title="10. Alterações desta política">
          <p>
            Podemos atualizar esta política conforme a plataforma evolui. A
            data no topo desta página sempre indica a versão mais recente.
            Mudanças relevantes serão comunicadas de forma visível dentro do
            sistema.
          </p>
        </Section>

        <Section title="11. Contato">
          {org?.email && (
            <p>
              Dúvidas sobre seu cadastro na <strong className="text-zinc-200">{org.name}</strong>: {' '}
              <a href={`mailto:${org.email}`} className="text-brand-400 hover:underline">{org.email}</a>.
            </p>
          )}
          <p>
            Dúvidas sobre esta política ou sobre o tratamento de dados pela
            plataforma SISGO: <a href={`mailto:${PLATFORM_EMAIL}`} className="text-brand-400 hover:underline">{PLATFORM_EMAIL}</a>.
            {!org?.email && ' Para tratar de dados específicos do seu cadastro em uma organização, procure primeiro o contato dela.'}
          </p>
        </Section>
      </section>
    </>
  )
}
