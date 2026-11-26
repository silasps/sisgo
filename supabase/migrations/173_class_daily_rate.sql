-- Valor da diária por pessoa (hospedagem com refeições) por turma. Com ela
-- preenchida, a tela de pagamento do formulário calcula o total pelas datas
-- de chegada/saída (noites × diária × pessoas), limitado ao valor base da
-- turma por pessoa (o pacote do período completo) — ver
-- src/lib/school/lodgingPrice.ts. Null = sem cálculo (só o texto de
-- pagamento da escola, como antes).
alter table school_classes
  add column if not exists daily_rate numeric(10,2);
