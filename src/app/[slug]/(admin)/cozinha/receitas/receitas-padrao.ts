type IngredienteSeed = { nome: string; unidade: string; qtdPorPorcao: number }
type ReceitaSeed = {
  nome: string
  categoria: string
  rendimentoPorcoes: number
  tempoMinutos: number | null
  mealIds: string[]
  instrucoes: string
  ingredientes: IngredienteSeed[]
}

export const RECEITAS_PADRAO: ReceitaSeed[] = [
  // ════════════════ CAFÉ DA MANHÃ ════════════════

  {
    nome: 'Café com leite',
    categoria: 'Bebida',
    rendimentoPorcoes: 1,
    tempoMinutos: 10,
    mealIds: ['breakfast'],
    instrucoes: 'Ferver o leite. Preparar o café coado ou na cafeteira. Misturar na proporção desejada. Adoçar a gosto.',
    ingredientes: [
      { nome: 'Café em pó', unidade: 'g', qtdPorPorcao: 10 },
      { nome: 'Leite integral', unidade: 'mL', qtdPorPorcao: 200 },
      { nome: 'Açúcar', unidade: 'g', qtdPorPorcao: 15 },
    ],
  },
  {
    nome: 'Pão francês com manteiga',
    categoria: 'Acompanhamento',
    rendimentoPorcoes: 1,
    tempoMinutos: null,
    mealIds: ['breakfast'],
    instrucoes: 'Servir pão cortado ao meio com manteiga.',
    ingredientes: [
      { nome: 'Pão francês', unidade: 'un', qtdPorPorcao: 2 },
      { nome: 'Manteiga', unidade: 'g', qtdPorPorcao: 10 },
    ],
  },
  {
    nome: 'Vitamina de banana',
    categoria: 'Bebida',
    rendimentoPorcoes: 1,
    tempoMinutos: 5,
    mealIds: ['breakfast'],
    instrucoes: 'Bater no liquidificador o leite, a banana e o açúcar até ficar homogêneo.',
    ingredientes: [
      { nome: 'Leite integral', unidade: 'mL', qtdPorPorcao: 250 },
      { nome: 'Banana', unidade: 'un', qtdPorPorcao: 1 },
      { nome: 'Açúcar', unidade: 'g', qtdPorPorcao: 15 },
    ],
  },

  // ════════════════ BASES (ARROZ / FEIJÃO) ════════════════

  {
    nome: 'Arroz branco',
    categoria: 'Acompanhamento',
    rendimentoPorcoes: 1,
    tempoMinutos: 25,
    mealIds: ['lunch', 'dinner'],
    instrucoes: 'Refogar o alho no óleo. Adicionar o arroz lavado e escorrido, refogar 2 min. Acrescentar água fervente (2:1) e sal. Cozinhar em fogo baixo tampado por 20 min.',
    ingredientes: [
      { nome: 'Arroz branco', unidade: 'g', qtdPorPorcao: 80 },
      { nome: 'Óleo de soja', unidade: 'mL', qtdPorPorcao: 5 },
      { nome: 'Alho', unidade: 'g', qtdPorPorcao: 2 },
      { nome: 'Sal', unidade: 'g', qtdPorPorcao: 1.5 },
    ],
  },
  {
    nome: 'Feijão carioca',
    categoria: 'Acompanhamento',
    rendimentoPorcoes: 1,
    tempoMinutos: 60,
    mealIds: ['lunch', 'dinner'],
    instrucoes: 'Deixar o feijão de molho por 8h. Cozinhar na panela de pressão por 25 min. Refogar alho e cebola no óleo, temperar o feijão com o refogado. Cozinhar mais 10 min.',
    ingredientes: [
      { nome: 'Feijão carioca', unidade: 'g', qtdPorPorcao: 60 },
      { nome: 'Óleo de soja', unidade: 'mL', qtdPorPorcao: 3 },
      { nome: 'Alho', unidade: 'g', qtdPorPorcao: 2 },
      { nome: 'Cebola', unidade: 'g', qtdPorPorcao: 10 },
      { nome: 'Sal', unidade: 'g', qtdPorPorcao: 1 },
      { nome: 'Louro (folha)', unidade: 'un', qtdPorPorcao: 0.1 },
    ],
  },
  {
    nome: 'Feijão preto',
    categoria: 'Acompanhamento',
    rendimentoPorcoes: 1,
    tempoMinutos: 60,
    mealIds: ['lunch', 'dinner'],
    instrucoes: 'Mesmo procedimento do feijão carioca. Opcionalmente, engrossar amassando parte dos grãos.',
    ingredientes: [
      { nome: 'Feijão preto', unidade: 'g', qtdPorPorcao: 60 },
      { nome: 'Óleo de soja', unidade: 'mL', qtdPorPorcao: 3 },
      { nome: 'Alho', unidade: 'g', qtdPorPorcao: 2 },
      { nome: 'Cebola', unidade: 'g', qtdPorPorcao: 10 },
      { nome: 'Sal', unidade: 'g', qtdPorPorcao: 1 },
      { nome: 'Louro (folha)', unidade: 'un', qtdPorPorcao: 0.1 },
    ],
  },

  // ════════════════ PRATOS PRINCIPAIS ════════════════

  {
    nome: 'Frango grelhado',
    categoria: 'Prato principal',
    rendimentoPorcoes: 1,
    tempoMinutos: 30,
    mealIds: ['lunch', 'dinner'],
    instrucoes: 'Temperar o frango com sal, alho, limão e pimenta. Deixar marinar 30 min. Grelhar em chapa ou frigideira quente com óleo, 6 min cada lado.',
    ingredientes: [
      { nome: 'Peito de frango', unidade: 'g', qtdPorPorcao: 150 },
      { nome: 'Alho', unidade: 'g', qtdPorPorcao: 3 },
      { nome: 'Limão', unidade: 'mL', qtdPorPorcao: 5 },
      { nome: 'Sal', unidade: 'g', qtdPorPorcao: 2 },
      { nome: 'Óleo de soja', unidade: 'mL', qtdPorPorcao: 5 },
    ],
  },
  {
    nome: 'Strogonoff de frango',
    categoria: 'Prato principal',
    rendimentoPorcoes: 1,
    tempoMinutos: 40,
    mealIds: ['lunch', 'dinner'],
    instrucoes: 'Cortar o frango em cubos. Refogar com alho, cebola e óleo. Adicionar extrato de tomate, ketchup, mostarda e creme de leite. Cozinhar 15 min. Servir com arroz e batata palha.',
    ingredientes: [
      { nome: 'Peito de frango', unidade: 'g', qtdPorPorcao: 150 },
      { nome: 'Cebola', unidade: 'g', qtdPorPorcao: 20 },
      { nome: 'Alho', unidade: 'g', qtdPorPorcao: 3 },
      { nome: 'Extrato de tomate', unidade: 'g', qtdPorPorcao: 10 },
      { nome: 'Creme de leite', unidade: 'mL', qtdPorPorcao: 30 },
      { nome: 'Ketchup', unidade: 'g', qtdPorPorcao: 10 },
      { nome: 'Mostarda', unidade: 'g', qtdPorPorcao: 5 },
      { nome: 'Óleo de soja', unidade: 'mL', qtdPorPorcao: 5 },
      { nome: 'Sal', unidade: 'g', qtdPorPorcao: 1 },
    ],
  },
  {
    nome: 'Carne moída refogada',
    categoria: 'Prato principal',
    rendimentoPorcoes: 1,
    tempoMinutos: 30,
    mealIds: ['lunch', 'dinner'],
    instrucoes: 'Refogar alho e cebola no óleo. Adicionar a carne moída, mexendo para não empelotar. Temperar com sal e extrato de tomate. Cozinhar 15 min.',
    ingredientes: [
      { nome: 'Carne moída', unidade: 'g', qtdPorPorcao: 120 },
      { nome: 'Cebola', unidade: 'g', qtdPorPorcao: 20 },
      { nome: 'Alho', unidade: 'g', qtdPorPorcao: 3 },
      { nome: 'Extrato de tomate', unidade: 'g', qtdPorPorcao: 10 },
      { nome: 'Óleo de soja', unidade: 'mL', qtdPorPorcao: 5 },
      { nome: 'Sal', unidade: 'g', qtdPorPorcao: 1.5 },
    ],
  },
  {
    nome: 'Bife acebolado',
    categoria: 'Prato principal',
    rendimentoPorcoes: 1,
    tempoMinutos: 25,
    mealIds: ['lunch', 'dinner'],
    instrucoes: 'Temperar os bifes com sal e alho. Fritar em óleo quente dos dois lados. Reservar. Na mesma panela, refogar a cebola em rodelas até dourar. Servir sobre os bifes.',
    ingredientes: [
      { nome: 'Bife bovino (acém ou patinho)', unidade: 'g', qtdPorPorcao: 130 },
      { nome: 'Cebola', unidade: 'g', qtdPorPorcao: 40 },
      { nome: 'Alho', unidade: 'g', qtdPorPorcao: 3 },
      { nome: 'Óleo de soja', unidade: 'mL', qtdPorPorcao: 8 },
      { nome: 'Sal', unidade: 'g', qtdPorPorcao: 2 },
    ],
  },
  {
    nome: 'Frango assado ao forno',
    categoria: 'Prato principal',
    rendimentoPorcoes: 1,
    tempoMinutos: 90,
    mealIds: ['lunch'],
    instrucoes: 'Temperar as coxas com sal, alho, limão, páprica e azeite. Marinar 1h. Assar em forno 200°C por 50-60 min, virando na metade.',
    ingredientes: [
      { nome: 'Coxa e sobrecoxa de frango', unidade: 'g', qtdPorPorcao: 200 },
      { nome: 'Alho', unidade: 'g', qtdPorPorcao: 3 },
      { nome: 'Limão', unidade: 'mL', qtdPorPorcao: 5 },
      { nome: 'Azeite de oliva', unidade: 'mL', qtdPorPorcao: 5 },
      { nome: 'Sal', unidade: 'g', qtdPorPorcao: 2 },
    ],
  },
  {
    nome: 'Macarrão ao molho de tomate',
    categoria: 'Prato principal',
    rendimentoPorcoes: 1,
    tempoMinutos: 30,
    mealIds: ['lunch', 'dinner'],
    instrucoes: 'Cozinhar o macarrão em água fervente com sal até al dente. Preparar o molho refogando alho e cebola, adicionando o molho de tomate e temperos. Misturar.',
    ingredientes: [
      { nome: 'Macarrão espaguete', unidade: 'g', qtdPorPorcao: 100 },
      { nome: 'Molho de tomate', unidade: 'mL', qtdPorPorcao: 60 },
      { nome: 'Cebola', unidade: 'g', qtdPorPorcao: 15 },
      { nome: 'Alho', unidade: 'g', qtdPorPorcao: 2 },
      { nome: 'Óleo de soja', unidade: 'mL', qtdPorPorcao: 3 },
      { nome: 'Sal', unidade: 'g', qtdPorPorcao: 2 },
    ],
  },
  {
    nome: 'Feijoada',
    categoria: 'Prato principal',
    rendimentoPorcoes: 1,
    tempoMinutos: 120,
    mealIds: ['lunch'],
    instrucoes: 'Dessalgar as carnes salgadas 24h. Cozinhar o feijão preto na pressão com louro. Em panela separada, dourar as carnes. Juntar tudo e cozinhar com alho, cebola e temperos por 30 min.',
    ingredientes: [
      { nome: 'Feijão preto', unidade: 'g', qtdPorPorcao: 80 },
      { nome: 'Linguiça calabresa', unidade: 'g', qtdPorPorcao: 40 },
      { nome: 'Carne seca (charque)', unidade: 'g', qtdPorPorcao: 30 },
      { nome: 'Costela suína', unidade: 'g', qtdPorPorcao: 40 },
      { nome: 'Cebola', unidade: 'g', qtdPorPorcao: 20 },
      { nome: 'Alho', unidade: 'g', qtdPorPorcao: 5 },
      { nome: 'Louro (folha)', unidade: 'un', qtdPorPorcao: 0.2 },
      { nome: 'Óleo de soja', unidade: 'mL', qtdPorPorcao: 5 },
      { nome: 'Sal', unidade: 'g', qtdPorPorcao: 1 },
    ],
  },

  // ════════════════ ACOMPANHAMENTOS ════════════════

  {
    nome: 'Farofa simples',
    categoria: 'Acompanhamento',
    rendimentoPorcoes: 1,
    tempoMinutos: 15,
    mealIds: ['lunch', 'dinner'],
    instrucoes: 'Refogar alho e cebola na manteiga. Adicionar a farinha de mandioca aos poucos, mexendo sem parar até dourar levemente. Temperar com sal.',
    ingredientes: [
      { nome: 'Farinha de mandioca', unidade: 'g', qtdPorPorcao: 40 },
      { nome: 'Manteiga', unidade: 'g', qtdPorPorcao: 8 },
      { nome: 'Cebola', unidade: 'g', qtdPorPorcao: 10 },
      { nome: 'Alho', unidade: 'g', qtdPorPorcao: 2 },
      { nome: 'Sal', unidade: 'g', qtdPorPorcao: 0.5 },
    ],
  },
  {
    nome: 'Purê de batata',
    categoria: 'Acompanhamento',
    rendimentoPorcoes: 1,
    tempoMinutos: 30,
    mealIds: ['lunch', 'dinner'],
    instrucoes: 'Cozinhar as batatas descascadas até ficarem macias. Escorrer e amassar. Adicionar leite quente, manteiga e sal. Mexer até ficar cremoso.',
    ingredientes: [
      { nome: 'Batata', unidade: 'g', qtdPorPorcao: 150 },
      { nome: 'Leite integral', unidade: 'mL', qtdPorPorcao: 30 },
      { nome: 'Manteiga', unidade: 'g', qtdPorPorcao: 8 },
      { nome: 'Sal', unidade: 'g', qtdPorPorcao: 1 },
    ],
  },
  {
    nome: 'Salada verde mista',
    categoria: 'Salada',
    rendimentoPorcoes: 1,
    tempoMinutos: 10,
    mealIds: ['lunch', 'dinner'],
    instrucoes: 'Lavar e higienizar as folhas em solução clorada (1 colher de água sanitária/L por 15 min). Enxaguar. Picar o tomate e a cebola. Montar e temperar na hora de servir.',
    ingredientes: [
      { nome: 'Alface', unidade: 'g', qtdPorPorcao: 30 },
      { nome: 'Tomate', unidade: 'g', qtdPorPorcao: 40 },
      { nome: 'Cebola', unidade: 'g', qtdPorPorcao: 10 },
      { nome: 'Azeite de oliva', unidade: 'mL', qtdPorPorcao: 5 },
      { nome: 'Vinagre', unidade: 'mL', qtdPorPorcao: 3 },
      { nome: 'Sal', unidade: 'g', qtdPorPorcao: 0.5 },
    ],
  },

  // ════════════════ SOPAS ════════════════

  {
    nome: 'Sopa de legumes com macarrão',
    categoria: 'Prato principal',
    rendimentoPorcoes: 1,
    tempoMinutos: 45,
    mealIds: ['dinner'],
    instrucoes: 'Refogar alho e cebola. Adicionar os legumes em cubos e cobrir com água. Cozinhar até amolecer. Adicionar o macarrão e cozinhar mais 10 min. Temperar.',
    ingredientes: [
      { nome: 'Batata', unidade: 'g', qtdPorPorcao: 60 },
      { nome: 'Cenoura', unidade: 'g', qtdPorPorcao: 40 },
      { nome: 'Chuchu', unidade: 'g', qtdPorPorcao: 30 },
      { nome: 'Macarrão parafuso', unidade: 'g', qtdPorPorcao: 30 },
      { nome: 'Cebola', unidade: 'g', qtdPorPorcao: 15 },
      { nome: 'Alho', unidade: 'g', qtdPorPorcao: 2 },
      { nome: 'Óleo de soja', unidade: 'mL', qtdPorPorcao: 3 },
      { nome: 'Sal', unidade: 'g', qtdPorPorcao: 2 },
    ],
  },
  {
    nome: 'Canja de galinha',
    categoria: 'Prato principal',
    rendimentoPorcoes: 1,
    tempoMinutos: 50,
    mealIds: ['dinner'],
    instrucoes: 'Cozinhar o frango com temperos até soltar dos ossos. Desfiar. No caldo, cozinhar o arroz e a cenoura. Adicionar o frango desfiado. Finalizar com salsinha.',
    ingredientes: [
      { nome: 'Coxa e sobrecoxa de frango', unidade: 'g', qtdPorPorcao: 100 },
      { nome: 'Arroz branco', unidade: 'g', qtdPorPorcao: 30 },
      { nome: 'Cenoura', unidade: 'g', qtdPorPorcao: 20 },
      { nome: 'Cebola', unidade: 'g', qtdPorPorcao: 10 },
      { nome: 'Alho', unidade: 'g', qtdPorPorcao: 2 },
      { nome: 'Sal', unidade: 'g', qtdPorPorcao: 2 },
      { nome: 'Salsinha', unidade: 'g', qtdPorPorcao: 2 },
    ],
  },

  // ════════════════ SOBREMESAS ════════════════

  {
    nome: 'Gelatina',
    categoria: 'Sobremesa',
    rendimentoPorcoes: 1,
    tempoMinutos: 10,
    mealIds: ['lunch'],
    instrucoes: 'Dissolver o pó de gelatina em água quente (250mL). Adicionar água fria (250mL). Levar à geladeira por 4h.',
    ingredientes: [
      { nome: 'Gelatina em pó', unidade: 'g', qtdPorPorcao: 10 },
      { nome: 'Açúcar', unidade: 'g', qtdPorPorcao: 5 },
    ],
  },
  {
    nome: 'Suco natural de laranja',
    categoria: 'Bebida',
    rendimentoPorcoes: 1,
    tempoMinutos: 10,
    mealIds: ['lunch', 'dinner'],
    instrucoes: 'Espremer as laranjas. Adicionar água e açúcar a gosto. Coar e servir com gelo.',
    ingredientes: [
      { nome: 'Laranja', unidade: 'un', qtdPorPorcao: 3 },
      { nome: 'Açúcar', unidade: 'g', qtdPorPorcao: 20 },
    ],
  },
]

export const INSUMOS_PADRAO: Array<{ nome: string; unidade: string; categoria: string }> = (() => {
  const map = new Map<string, { unidade: string; categoria: string }>()
  const categoriaPorNome: Record<string, string> = {
    'Arroz branco': 'Grãos e cereais',
    'Feijão carioca': 'Grãos e cereais',
    'Feijão preto': 'Grãos e cereais',
    'Farinha de mandioca': 'Grãos e cereais',
    'Macarrão espaguete': 'Grãos e cereais',
    'Macarrão parafuso': 'Grãos e cereais',
    'Pão francês': 'Padaria',
    'Café em pó': 'Mercearia',
    'Açúcar': 'Mercearia',
    'Sal': 'Mercearia',
    'Óleo de soja': 'Mercearia',
    'Azeite de oliva': 'Mercearia',
    'Vinagre': 'Mercearia',
    'Extrato de tomate': 'Mercearia',
    'Molho de tomate': 'Mercearia',
    'Ketchup': 'Mercearia',
    'Mostarda': 'Mercearia',
    'Gelatina em pó': 'Mercearia',
    'Leite integral': 'Laticínios',
    'Manteiga': 'Laticínios',
    'Creme de leite': 'Laticínios',
    'Peito de frango': 'Carnes',
    'Coxa e sobrecoxa de frango': 'Carnes',
    'Carne moída': 'Carnes',
    'Bife bovino (acém ou patinho)': 'Carnes',
    'Linguiça calabresa': 'Carnes',
    'Carne seca (charque)': 'Carnes',
    'Costela suína': 'Carnes',
    'Alho': 'Hortifruti',
    'Cebola': 'Hortifruti',
    'Tomate': 'Hortifruti',
    'Batata': 'Hortifruti',
    'Cenoura': 'Hortifruti',
    'Chuchu': 'Hortifruti',
    'Alface': 'Hortifruti',
    'Salsinha': 'Hortifruti',
    'Banana': 'Hortifruti',
    'Laranja': 'Hortifruti',
    'Limão': 'Hortifruti',
    'Louro (folha)': 'Temperos',
  }
  for (const r of RECEITAS_PADRAO) {
    for (const i of r.ingredientes) {
      if (!map.has(i.nome)) {
        map.set(i.nome, { unidade: i.unidade, categoria: categoriaPorNome[i.nome] ?? 'Outros' })
      }
    }
  }
  return [...map.entries()].map(([nome, v]) => ({ nome, ...v }))
})()
