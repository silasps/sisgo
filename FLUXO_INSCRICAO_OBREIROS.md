# Fluxo de Inscrição de Obreiros

> Descrição funcional combinada com o usuário em 2026-07-09. Ainda **não
> implementado** (ou parcialmente implementado) — usar este documento como
> especificação de referência antes de construir/alterar o fluxo.

## Visão geral das fases

1. **Pré-inscrição** (pública) → 2. **Formulário de obreiro** (preenchido
   pela pessoa) → 3. **Recomendações** (pastor + liderança de escola, se
   houver) → 4. **Verificações** (antecedentes, etc.) → 5. **Aprovação DH** →
   6. **Hospitalidade / chegada** (líder).

---

## 1. Pré-inscrição pública

- Pessoa externa preenche formulário público solicitando se tornar obreiro
  da base, selecionando um **ministério** (opcional).
- **Se selecionou ministério:** a pendência aparece na tela do **líder do
  ministério**.
- **Se não selecionou ministério:** a pendência vai direto para o **DH**
  (Departamento Humano).

## 2. Contato e alinhamento de expectativas

- Responsável (líder ou DH, conforme o caso) conversa com a pessoa até
  alinhar expectativas entre o que a pessoa quer e o que a instituição
  espera.
- **Quando é o líder que está conduzindo:**
  - DH visualiza a pré-inscrição e acompanha **há quanto tempo** está sem
    contato/resposta, para poder cobrar o líder ("você ainda não entrou em
    contato").
  - Se o líder estiver ausente ou não responder, **DH pode assumir** a
    conversa e dar prosseguimento no lugar dele.
- **Quando é o DH que está conduzindo** (sem ministério selecionado): ele
  mesmo faz todo esse processo.
- Ao alinhar expectativas, quem está conduzindo (líder ou DH) tem um botão
  de ação para **enviar o formulário definitivo de obreiro** para a pessoa.

## 3. Formulário de obreiro (definitivo)

- A partir daqui, quem **acompanha os próximos passos é o DH** (o líder
  passa a só visualizar).
- O formulário pede, entre outras coisas:
  - Contato (e-mail e telefone) do **pastor** da pessoa.
  - Se a pessoa já fez alguma **escola da instituição** (ex.: escola da
    JOCUM) — se sim, pede contato (e-mail e telefone) da **liderança
    daquela escola/período**.

## 4. Envio automático de recomendações

- Assim que a pessoa **finaliza** o formulário:
  - **Obrigatório:** e-mail automático enviado ao **pastor** pedindo
    recomendação.
  - **Condicional:** se a pessoa indicou uma escola cursada, e-mail também
    enviado à **liderança daquela escola**, com perguntas focadas no
    período da escola (o que o líder observou/avaliou naquele tempo).
  - Cada formulário de recomendação é **único por processo** (tem um ID
    vinculado à inscrição específica) — não é um link genérico reutilizável.
- **Na tela de confirmação**, depois de finalizar, a pessoa também vê o
  mesmo link do formulário do pastor, com uma mensagem sugerindo que ela
  mesma possa enviar por WhatsApp/outro meio para agilizar (útil quando o
  pastor não usa e-mail, ou em outras nações onde outro canal é mais
  rápido). O envio automático por e-mail acontece de qualquer forma.
- Perguntas do formulário do pastor (a refinar depois): quem é essa pessoa,
  há quanto tempo frequenta a igreja, se tem bom testemunho, forma de
  avaliação/recomendação.

## 5. Acompanhamento das recomendações

- DH e líder visualizam o status (ex.: "pendente resposta do pastor").
- **Exceção manual pelo DH:** se não for possível obter resposta do pastor
  (pessoa sem igreja vinculada no momento, etc.), o DH pode **avançar
  manualmente** essa etapa, mas precisa **descrever/justificar** a
  recomendação obtida por outra via. A recomendação do pastor é obrigatória
  por padrão — pular exige justificativa registrada.

## 6. Verificações

- Verificação de antecedentes criminais.
- Verificação em registros/sistemas de proteção (ex.: pedofilia).
- (Demais critérios a detalhar depois.)

## 7. Aprovação final e handoff para hospitalidade

- Concluídas as etapas do DH, o processo **volta para o líder**, que agora
  pode seguir os próximos passos operacionais:
  - Abrir requisições de **hospitalidade**: onde a pessoa vai ficar, data e
    horário de chegada, quem vai recebê-la, etc.
  - Essas informações ficam visíveis tanto para o **líder** quanto para o
    **DH** (acompanhamento da chegada).
- Assim que aprovada, a pessoa **já se torna obreiro vinculado à
  instituição**, ficando apenas aguardando a data de chegada.

---

## Pontos em aberto / a refinar depois

- Perguntas definitivas do formulário de recomendação do pastor.
- Perguntas definitivas do formulário de recomendação da liderança de
  escola.
- Regras exatas de SLA para o DH cobrar o líder por falta de contato.
- Detalhes das verificações de antecedentes (fonte, integração, etc.).
