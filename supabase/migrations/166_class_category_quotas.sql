-- Cotas de vaga por categoria, por turma — ajustáveis a qualquer momento
-- pelo admin em Escolas > turma > Vagas por categoria. Null = sem limite
-- nessa categoria (mesmo padrão de max_students). quota_casais é contado em
-- NÚMERO DE CASAIS (cada casal ocupa 2 vagas de pessoas, já que cada cônjuge
-- preenche uma inscrição separada — ver classifyApplicationCategory em
-- src/lib/students/classCapacity.ts).
alter table school_classes
  add column if not exists quota_homens int,
  add column if not exists quota_mulheres int,
  add column if not exists quota_casais int;
