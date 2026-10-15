# Contas em abas, categorias próprias e cartões de crédito — especificação

Data: 2026-10-14 · Escopo: back-end (raiz) e front (`web/`) · Afeta produção (migration com dados reais)

## Objetivo

A área de pagamentos ("Contas") passa a ser organizada em **abas**, uma por categoria. A usuária
**cria as próprias categorias** digitando o nome (não sabemos todas de antemão). Ganha uma aba
**Cartões**, com os cartões de crédito desenhados, as compras (à vista e parceladas) e o total da
fatura do mês, que vira automaticamente uma **conta a pagar**.

Todos os valores aqui são despesas: salários e honorários médicos são pagos pela usuária.

Critérios de aceite:
- Cada usuária tem suas categorias; uma conta nova recebe as 6 padrão; quem já usa o app não perde
  nenhuma conta nem categoria.
- Categoria nova criada na tela vira uma aba na hora.
- Compras no cartão aparecem na fatura certa (pelo dia de fechamento), com o selo da parcela.
- A fatura aparece em Contas, no painel Hoje, nos lembretes e no relatório sem tratamento especial
  nesses módulos além do descrito aqui.
- Testes do back e do front, lint e build passando; `docs/arquitetura.md` e os `CLAUDE.md`
  atualizados.

## 1. Categorias de cada usuário

**Banco** (migration nova; migrations antigas não mudam):
- `categoria_pagamento` ganha `usuario_id` (FK `usuario`, `ON DELETE CASCADE`). O `unique (nome)`
  sai e entra `unique (usuario_id, lower(nome))`; índice começando por `usuario_id`.
- Migração dos dados, na mesma transação: para cada usuário existente, copiar as categorias globais
  (mesmo nome e ordem) e repontar `pagamento.categoria_id` de cada conta dele para a cópia. Depois
  apagar as globais e tornar `usuario_id` `NOT NULL`. O `down` faz o caminho inverso (recria as
  globais e reaponta por nome).
- `pagamento.categoria_id` passa a aceitar nulo (só faturas, ver seção 2). FK composta
  `(categoria_id, usuario_id) → categoria_pagamento (id, usuario_id)`, como já é com imóvel, para
  impedir usar categoria de outro usuário.

**Padrão para contas novas**: `POST /auth/cadastro` cria as 6 categorias padrão para o usuário
(Salários, Honorários médicos, Consultas, Exames, Parcelamentos, Contas residenciais), na mesma
transação. A lista fica em `src/modules/categorias/padrao.js`; o seed `01_catalogos.js` deixa de
inserir categorias globais.

**API** (`src/modules/categorias`, montado como hoje em `/categorias-pagamento`):
- `GET /categorias-pagamento` → `[{ id, nome, ordem }]` do usuário, por `ordem`.
- `POST` `{ nome }` → cria no fim da ordem. `PUT /:id` `{ nome?, ordem? }`. `DELETE /:id`.
- Nome: texto de 1 a 40 caracteres, aparado. Repetido (sem diferenciar maiúsculas) → `409 CONFLITO`.
- Apagar categoria usada por alguma conta ou compra → `409 REFERENCIA_INVALIDA` (FK, como imóveis).
- Categoria de outro usuário → `404`.

## 2. Cartões de crédito

**Banco** (migration nova):
- `cartao`: `usuario_id`, `nome` (1–40), `final` (4 dígitos, opcional), `cor` (uma de uma lista
  fixa: `azul`, `roxo`, `verde`, `laranja`, `vermelho`, `grafite`; `CHECK`), `dia_fechamento` e
  `dia_vencimento` (1–31, `CHECK`), `limite_centavos` (opcional, > 0), `ordem`.
  `unique (usuario_id, lower(nome))`; `unique (id, usuario_id)` para FKs compostas.
- `cartao_compra`: `cartao_id` (FK, cascade), `descricao`, `categoria_id` (opcional; FK para a
  categoria; o dono vem do cartão), `valor_total_centavos` (> 0), `parcelas` (1–48),
  `data_compra` (`date`), `observacoes`. Índice `(cartao_id, data_compra)`.
- `pagamento` ganha `cartao_id` (FK composta com `usuario_id` → `cartao`) e `competencia`
  (`date`, sempre dia 1 do mês da fatura). `CHECK`: `cartao_id` e `competencia` são ambos nulos
  ou ambos preenchidos; fatura não tem categoria, recorrência nem parcelamento
  (`cartao_id IS NULL OR (categoria_id IS NULL AND recorrencia = 'nenhuma' AND parcelamento_grupo_id IS NULL)`);
  conta comum tem categoria (`cartao_id IS NOT NULL OR categoria_id IS NOT NULL`).
  `unique (cartao_id, competencia)`: uma fatura por cartão por mês.

As parcelas não são guardadas: são calculadas a partir da compra (são determinísticas). A fatura
é guardada porque é uma conta (status, data de pagamento, lembretes).

**Regras** (funções puras em `src/lib/fatura.js`, com testes próprios):
- **Competência** = mês do vencimento da fatura. Dias que não existem no mês (31 em fevereiro)
  viram o último dia do mês, para fechamento e vencimento.
- **Fechamento da fatura da competência M**: dia `dia_fechamento` de M se
  `dia_vencimento > dia_fechamento`; senão, de M−1.
- **Primeira fatura de uma compra** = a de menor competência cujo fechamento é **depois** da data
  da compra (compra no dia do fechamento já vai para a seguinte).
- **Parcela k** (1..n) cai na competência da primeira fatura + (k−1) meses.
- **Valor das parcelas**: `floor(total / n)`; o resto dos centavos vai para a parcela 1.
- **Valor da fatura** = soma das parcelas de todas as compras do cartão que caem na competência.
- **Situação da fatura**: `paga` (conta paga), `fechada` (hoje ≥ fechamento, não paga) ou `aberta`.

**Sincronização da conta da fatura** (no service de cartões, na mesma transação de cada escrita
de compra ou de cartão): para cada competência afetada (as das parcelas antes e depois da mudança),
recalcular o valor e:
- valor > 0 e não existe conta → criar `pagamento` pendente com `descricao` "Fatura <nome do cartão>",
  `vencimento` = vencimento da competência, `cartao_id`, `competencia`, `categoria_id` nulo;
- valor > 0 e conta pendente → atualizar `valor_centavos` (e o vencimento, se o dia do cartão mudou);
- valor = 0 e conta pendente → apagar a conta;
- competência com conta **paga** afetada pela mudança → recusar toda a operação com
  `409 FATURA_PAGA` ("Essa compra cai na fatura de <mês>, que já foi paga.").
Mudar `dia_fechamento`/`dia_vencimento` de um cartão reprocessa todas as competências com conta
pendente; se a mudança mexer numa fatura paga, também `409 FATURA_PAGA`.

**Fatura na área de pagamentos** (`src/modules/pagamentos`):
- As consultas que hoje fazem `join` com categoria passam a `leftJoin`; a resposta ganha
  `cartaoId`, `cartaoNome` e `competencia` (nulos em conta comum) e `categoriaNome` nulo na fatura.
- `PUT /pagamentos/:id` e `DELETE /pagamentos/:id` numa fatura → `409 FATURA_AUTOMATICA`
  ("O valor da fatura vem das compras do cartão."). `PATCH /pagar` funciona normalmente; desfazer
  o pagamento, se existir, também.
- Relatório (`src/modules/relatorios`): no agrupamento por categoria, faturas entram num item
  `{ id: null, nome: "Cartão de crédito" }`, como já é feito com "Sem imóvel".
- Painel Hoje e lembretes não mudam: a fatura é um pagamento pendente com vencimento.

**API** (`src/modules/cartoes`, montado em `/cartoes`):
- `GET /cartoes` → `[{ id, nome, final, cor, diaFechamento, diaVencimento, limiteCentavos, ordem,
  limiteDisponivelCentavos, faturaAtual: { competencia, totalCentavos, vencimento, situacao } }]`.
  `limiteDisponivelCentavos` = limite − soma das parcelas em faturas não pagas (nulo sem limite).
  `faturaAtual` = a primeira fatura ainda não paga cuja competência é ≥ o mês atual.
- `POST /cartoes`, `GET/PUT/DELETE /cartoes/:id`. `DELETE` apaga compras e faturas pendentes;
  com alguma fatura paga → `409 REFERENCIA_INVALIDA` ("O cartão tem faturas pagas no histórico.").
- `GET /cartoes/:id/faturas/:competencia` (`AAAA-MM`) → `{ competencia, fechamento, vencimento,
  situacao, totalCentavos, pagamentoId, parcelas: [{ compraId, descricao, categoriaId,
  categoriaNome, dataCompra, parcela, totalParcelas, valorCentavos }] }`, parcelas por data da
  compra. Mês sem compras → total 0 e lista vazia (não é 404).
- `POST /cartoes/:id/compras` `{ descricao, valorTotalCentavos, parcelas, dataCompra,
  categoriaId?, observacoes? }` → `201` com a compra e as competências afetadas.
  `PUT/DELETE /cartoes/:id/compras/:compraId`.
- Tudo de outro usuário → `404`. Rotas, esquemas Zod e `docs.js` seguem o padrão dos módulos.

## 3. Front (`web/`)

**Tela Contas** (`paginas/pagamentos/Pagamentos.tsx`):
- Título e rótulo da navegação passam a "Contas" (a rota `/pagamentos` não muda).
- Faixa de abas que rola na horizontal, logo abaixo do título: **Todas**, uma aba por categoria
  (na ordem do usuário), **Cartões** e um botão **"+ Nova"**. A aba ativa fica na URL
  (`?aba=<categoriaId>` ou `?aba=cartoes`) para voltar no mesmo lugar.
- "+ Nova" abre um campo inline ("Nome da categoria") com Salvar/Cancelar; ao salvar, a aba nova
  aparece e fica selecionada. Erro `409` aparece no campo.
- Abas de categoria: a listagem atual filtrada por `categoriaId` (navegação por mês, filtro de
  status e resumo continuam). "Todas" é a listagem atual, incluindo as faturas, que mostram o
  nome do cartão no lugar da categoria e não têm editar/excluir, só "Pagar".
- O filtro "Categoria" de dentro de "Categoria e imóvel" sai (as abas fazem esse papel); o de
  imóvel fica.
- O formulário de conta passa a buscar as categorias do usuário e oferece "Nova categoria…" no
  fim da lista, que abre o mesmo campo de digitar.

**Gerenciar categorias**: em Mais → "Categorias": lista para renomear, reordenar (subir/descer) e
apagar (com confirmação; `409` vira a mensagem "Essa categoria tem contas; mova-as antes de
apagar.").

**Aba Cartões**:
- Carrossel horizontal de cartões desenhados (proporção de cartão de crédito, cor do cartão,
  nome, "•••• 1234", total da fatura atual, "vence 10/nov" e barra do limite usado). Último item:
  "+ Novo cartão".
- Abaixo do cartão selecionado: navegação de mês (‹ outubro de 2026 ›), situação da fatura
  (Aberta / Fechada / Paga), total e lista das parcelas com descrição, data da compra, valor e o
  selo "3/10" (sem selo se à vista). Botão "Adicionar compra" e, com a fatura fechada e pendente,
  "Pagar fatura" (usa o `PATCH /pagamentos/:id/pagar`).
- Formulário de compra: descrição, valor total, parcelas (1–48, padrão 1, mostrando "10× de
  R$ 25,00"), data da compra (padrão hoje), categoria (opcional) e observações.
- Formulário de cartão: nome, final, cor (amostras), dia de fechamento, dia de vencimento, limite.
- Consultas novas em `src/consultas/` (`cartoes.ts`, `categorias.ts`); toda mutação de compra ou
  cartão invalida cartões, pagamentos e o painel Hoje (`invalidarPainel`). Tipos em
  `src/lib/tipos.ts`; MSW com os handlers novos.

## 4. Fora do escopo

Entradas de dinheiro/saldo; separar no relatório os gastos do cartão por categoria das compras (o
campo já fica guardado); importação de fatura do banco; antecipação ou estorno de parcelas;
juros; visual novo (spec `2026-10-14-visual-novo-design.md`, pausada — esta entrega usa os
componentes atuais).

## 5. Testes

Back-end (`node:test`, padrão de `test/`):
- `test/fatura.test.js` (funções puras): competência pelo fechamento (antes, no dia, depois),
  `dia_vencimento ≤ dia_fechamento` (vence no mês seguinte), dia 31 em fevereiro, divisão de
  centavos, parcela k na competência certa.
- `test/categorias.test.js`: cadastro cria as 6 padrão; CRUD; nome repetido sem diferenciar
  maiúsculas → 409; apagar usada → 409; isolamento entre usuários (404); conta não aceita
  categoria de outro usuário.
- `test/migration-categorias.test.js`: com dados no formato antigo (globais + contas de dois
  usuários), a migration cria as cópias por usuário e repõe as contas; o `down` volta.
- `test/cartoes.test.js`: CRUD e isolamento; compra cria/atualiza a conta da fatura; parcelada
  espalha nas competências; editar/apagar compra recalcula e apaga fatura zerada; compra em fatura
  paga → 409 `FATURA_PAGA`; mudar dias do cartão reprocessa; `GET faturas/:competencia`; limite
  disponível; apagar cartão com fatura paga → 409.
- `test/pagamentos.test.js` (ajustes): fatura na listagem com `cartaoNome`; PUT/DELETE na fatura →
  409 `FATURA_AUTOMATICA`; pagar fatura funciona. `test/relatorios.test.js`: item "Cartão de
  crédito". `test/hoje.test.js`: fatura pendente aparece em `aVencer`.

Front (Vitest + MSW): abas (troca, URL, criar categoria inline, erro 409), aba Cartões (carrossel,
troca de mês, selo de parcela, pagar fatura), formulário de compra (resumo "10× de"), tela de
categorias, e os testes atuais que esperam "Pagamentos" passando a "Contas".

## 6. Ordem de entrega

Cada etapa entrega back e front juntos:

1. **Categorias**: back (migration de dados, cadastro com padrão, CRUD, FK composta) + front
   (abas de categoria, "+ Nova", "Nova categoria…" no formulário, tela de categorias, "Contas").
2. **Cartões**: back (cartões, compras, regras de fatura, conta da fatura, ajustes em pagamentos e
   relatório) + front (aba Cartões: carrossel, fatura do mês, formulários).

Cada etapa termina com testes passando, docs atualizadas, commit e push. A etapa 1 mexe em dados
de produção: antes do deploy, backup do banco (`deploy/backup.sh`).
