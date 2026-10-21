# Minha Assistente — Arquitetura do back-end

Back-end de uma secretária pessoal **multiusuário**: qualquer pessoa se cadastra e cada uma vê
apenas os próprios dados. O front é um PWA desenvolvido
separadamente e depende do contrato de API descrito aqui.

## Stack

- Node.js + Express 5
- PostgreSQL + **Knex** (migrations e query builder) — JS puro e consultas de agregação
  pedem SQL explícito, sem etapa de geração de client.
- Zod (validação e geração do OpenAPI), JWT, bcrypt (`bcryptjs`, sem compilação nativa)
- Swagger UI em `/docs`

## Contrato geral

- JSON em camelCase; banco em snake_case (conversão central no Knex).
- Datas sem hora: `"2026-10-13"`. Data/hora: ISO 8601 com offset, `"2026-10-13T14:00:00-03:00"`.
  Hora do dia: `"08:00"`. Fuso de referência: `America/Sao_Paulo`.
- Dinheiro: inteiro em centavos (`15990` = R$ 159,90), colunas `bigint` (migration 23): sem teto de
  negócio, só o maior inteiro exato do JavaScript.
- Erros: `{ "erro": { "codigo": "STRING", "mensagem": "texto" } }`.
- Listagens devolvem array direto, sem paginação (volume de uma pessoa).
- Todas as rotas exceto `GET`/`POST /auth/cadastro` e `POST /auth/login` exigem
  `Authorization: Bearer <jwt>`. Toda consulta é filtrada pelo usuário do token; recurso de
  outro usuário responde `404` (não revela que existe).

## Rotas

```
GET/POST /auth/cadastro (acrescentada) | POST /auth/login | GET /auth/me | PUT /auth/senha
GET  /hoje | PATCH /hoje/:id  (tarefas do dia, decisão 24)
GET/POST /pagamentos (inicio, fim, status, categoriaId, imovelId, destino) | GET/PUT/DELETE /pagamentos/:id
PATCH /pagamentos/:id/pagar
POST /pagamentos/:id/comprovantes | GET/DELETE /pagamentos/:id/comprovantes/:comprovanteId  (decisão 22)
GET/POST /imoveis | GET/PUT/DELETE /imoveis/:id  (escrita acrescentada; GET /:id e endereço na decisão 27)
GET/POST /categorias-pagamento | PUT/DELETE /categorias-pagamento/:id
GET/POST /cartoes | GET/PUT/DELETE /cartoes/:id | GET /cartoes/:id/faturas/:AAAA-MM   (acrescentadas)
POST /cartoes/:id/compras | GET/PUT/DELETE /cartoes/:id/compras/:compraId            (acrescentadas)
GET/POST /equipe | GET/PUT/DELETE /equipe/:id                                          (acrescentadas)
GET /relatorios/gastos?inicio=&fim=&agruparPor=imovel|categoria
GET /relatorios/financeiro?inicio=&fim=  (visão financeira do período, decisão 25)
GET /relatorios/imoveis/:id?inicio=&fim=  (resumo de um imóvel, decisão 27)
GET/POST /recebiveis (inicio, fim, status, origem) | GET/PUT/DELETE /recebiveis/:id  (decisão 26)
POST /recebiveis/:id/recebimentos | DELETE /recebiveis/:id/recebimentos/:recebimentoId
POST /recebiveis/:id/comprovantes | GET/DELETE /recebiveis/:id/comprovantes/:comprovanteId
GET/POST /eventos (inicio, fim, tipo) | GET/PUT/DELETE /eventos/:id
GET/POST /rotinas | PUT/DELETE /rotinas/:id | GET /rotinas/hoje | POST /rotinas/:id/concluir | GET /rotinas/:id/historico
GET/POST /tarefas (inicio, fim, situacao) | GET/PUT/DELETE /tarefas/:id | PATCH /tarefas/:id/concluir  (decisão 28)
GET/POST /medicamentos | GET/PUT/DELETE /medicamentos/:id | GET /medicamentos/hoje
POST /medicamentos/registros
GET/POST /viagens | GET/PUT/DELETE /viagens/:id | POST /viagens/:id/anexos
GET/DELETE /viagens/:id/anexos/:anexoId                      (acrescentada)
GET/POST /compras | PUT/DELETE /compras/:id | PATCH /compras/:id/comprado
POST /notificacoes/inscricoes | DELETE /notificacoes/inscricoes  (acrescentada, Web Push)
GET /notificacoes/chave-publica | POST /notificacoes/teste       (acrescentadas)
GET/PUT /notificacoes/resumo  (resumo da manhã, decisão 21)
GET/PUT /notificacoes/avisos  (o que avisar, por categoria, decisão 29)
```

## Decisões acordadas

1. **Web Push**: o canal `app` usa Web Push; a inscrição do navegador é salva via
   `POST /notificacoes/inscricoes` (tabela `push_inscricao`, chaves VAPID no `.env`).
2. **Parcelamento**: `POST /pagamentos` com `"parcelamento": { "totalParcelas": N }` cria as N
   parcelas (vencimentos mensais a partir de `vencimento`, mesmo `parcelamentoGrupoId`) e
   responde `201` com **array**. Sem `parcelamento`, responde objeto.
3. **Eventos recorrentes**: guardados como uma linha e expandidos na leitura. Cada ocorrência
   vem com o `id` da série, `inicio`/`fim` da ocorrência e `"recorrente": true`. Editar/excluir
   afeta a série inteira.
4. **Anexos de viagem**: `multipart/form-data`, campo `arquivo`, até 10 MB, PDF e imagens,
   disco local em `uploads/` (abstraído para trocar por S3).
5. **Relatório de gastos**: gasto = pagamento `pago` com `dataPagamento` no período; também
   devolve previsto (pendentes com vencimento no período). Formato:
   `{ inicio, fim, agruparPor, totalPagoCentavos, totalPrevistoCentavos,
   itens: [{ id, nome, pagoCentavos, previstoCentavos }] }`; sem imóvel → `{ id: null, nome: "Sem imóvel" }`.
6. **Sem paginação** nas listagens.
7. **Pagamento recorrente**: cada série tem sempre uma ocorrência real; ao pagar, cria-se a
   próxima (mês/ano seguinte) ligada por `recorrencia_origem_id`.
8. **Lembretes de evento em lista**: `lembretesMinutosAntes: [1080, 120]` (ex.: véspera e 2h
   antes); `[]` = sem lembrete. Até 5 valores positivos, sem repetição.
9. **Multiusuário**: cadastro pelo app (`POST /auth/cadastro` com `{ nome, email, senha }`, devolve
   o token como o login) só com `CADASTRO_ABERTO=true`; sem a variável, fica fechado em produção
   e aberto no resto. Fechado, responde `403 CADASTRO_FECHADO` e as contas são criadas pelo
   administrador (`src/cli/criar-conta.js`, com senha temporária). `GET /auth/cadastro` devolve
   `{ aberto }` para o front esconder o "Criar conta". Imóveis e categorias são de cada usuário (CRUD em `/imoveis` e
   `/categorias-pagamento`, decisão 18). Apagar um imóvel usado por pagamentos responde
   `409 REFERENCIA_INVALIDA`.

10. **Pagamentos (etapa 4)**:
    - Resposta inclui `categoriaNome`, `imovelNome` e `vencido` (pendente com vencimento < hoje),
      além das colunas da tabela (sem `usuarioId`).
    - No parcelamento, `valorCentavos` é o valor **de cada parcela**; vencimentos mensais a partir
      da data base (31/jan → 28/fev → 31/mar).
    - Próxima ocorrência recorrente é gerada quando o pagamento passa a pago (PATCH `/pagar`, PUT
      ou criação já paga), calculada a partir do início da série; nunca duplica (índice único).
    - `PATCH /pagar` sem corpo usa a data de hoje; pagar de novo → `409 JA_PAGO`.
    - Filtros `inicio`/`fim` da listagem usam o vencimento. Imóvel com nome repetido no mesmo
      usuário → `409 IMOVEL_DUPLICADO`.

11. **Agenda (etapa 5)**:
    - `inicio`/`fim` exigem ISO 8601 **com fuso** (`-03:00` ou `Z`); a resposta vem em `-03:00`.
    - `GET /eventos` sem período lista de hoje até 30 dias; período máximo 366 dias.
    - Cada ocorrência traz também `inicioSerie` (início da primeira ocorrência): é o `inicio` a
      enviar no PUT, para editar a série sem deslocá-la.
    - Editar ou excluir um evento cancela os lembretes ainda pendentes dele.
    - `link` aceita só http(s); texto vazio vira `null`.

12. **Medicamentos (etapa 6)**:
    - Medicamento traz `horarios: [{ id, periodo, hora, diaSemana }]` (`diaSemana` 0 = domingo,
      obrigatório só no semanal). No PUT, horário com `id` é mantido (com o histórico de "tomei"),
      sem `id` é criado, e os ausentes são removidos.
    - `GET /medicamentos/hoje?data=` (padrão hoje): diários + semanais do dia da semana, só ativos e
      dentro do período de uso (decisão 31).
      Item: `{ horarioId, medicamentoId, nome, dose, observacoes, periodo, hora, data, tomado, tomadoEm }`.
    - `POST /medicamentos/registros` `{ horarioId, data?, tomado?, situacao? }` responde o item atualizado;
      é idempotente e `tomado: false` desmarca. Semanal fora do dia da semana → `400`.

13. **Rotina (etapa 7)**:
    - Tarefa: `{ titulo, hora?, diasSemana (padrão todos), ativo, ordem, lembrete }`; `lembrete`
      exige `hora`.
    - `GET /rotinas/hoje?data=` (padrão hoje): ativas previstas para o dia da semana, ordenadas por
      `ordem`, hora e título. Item: `{ rotinaId, titulo, hora, ordem, data, concluida, concluidaEm }`.
    - `POST /rotinas/:id/concluir` `{ data?, concluida? }` responde o item; idempotente;
      `concluida: false` desfaz; dia fora de `diasSemana` → `400`.

14. **Painel Hoje (etapa 8)**: substituído pelas tarefas do dia (decisão 24). O painel agrupado
    por módulo continua em `src/modules/hoje/service.js` (`painel()`), só para o resumo da manhã:
    `{ data, resumo, eventos, medicamentos, rotina, pagamentos: { vencidos, aVencer, ... } }`, com
    `aVencer` = pendentes com vencimento do dia até 7 dias depois.

15. **Viagens (etapa 9)**:
    - Viagem traz `anexos: [{ id, nomeOriginal, mimeType, tamanhoBytes, criadoEm }]`; listagem
      com a ida mais recente primeiro.
    - Upload: o tipo é detectado pelo **conteúdo** (PDF, JPG, PNG, WEBP, HEIC), não pelo
      Content-Type; até 10 MB e 20 anexos por viagem. Erros: `413 ARQUIVO_GRANDE_DEMAIS`,
      `415 TIPO_NAO_SUPORTADO`, `409 LIMITE_ANEXOS`, `400 UPLOAD_INVALIDO` (campo errado).
    - Arquivo salvo com nome aleatório em `UPLOADS_DIR` (`src/lib/armazenamento.js`, trocável por
      S3); download sempre como `attachment` com o nome original.

16. **Compras (etapa 10)**: item `{ id, nome, categoria, quantidade, comprado, compradoEm }`.
    `GET /compras?comprado=true|false` lista pendentes primeiro (categoria, nome, na ordem do
    português: collation ICU `pt-BR-x-icu`) e depois os comprados (mais recentes primeiro). `PATCH /compras/:id/comprado` sem corpo marca;
    `{ "comprado": false }` desmarca. PUT edita nome/categoria/quantidade sem mudar o status.

17. **Lembretes e notificações (etapa 11)**:
    - Quando: evento → cada valor de `lembretesMinutosAntes` antes de cada ocorrência; remédio →
      na hora de cada horário **com hora** de remédio em uso; rotina → na hora, se `lembrete`;
      pagamento pendente → véspera e dia do vencimento, às 9h.
    - Na hora de enviar, o lembrete é conferido de novo: remédio já tomado, tarefa feita, conta
      paga (ou com vencimento mudado), origem apagada ou pausada → `cancelado`, sem enviar.
      Mais de 15 min atrasado (ex.: servidor parado) → `cancelado`. Erro do serviço de push →
      tenta de novo no minuto seguinte; na 3ª falha, `falhou`.
    - Só gera lembretes para quem tem um aparelho inscrito. Inscrição que o serviço de push
      responde 404/410 é apagada.
    - O único de `lembrete_envio` inclui `agendado_para` (migration 11): um evento pode ter vários
      lembretes da mesma ocorrência.
    - `POST /notificacoes/inscricoes` recebe `PushSubscription.toJSON()` (`{ endpoint, keys: {
      p256dh, auth } }`, endpoint https de um serviço de push conhecido — FCM, Mozilla, Apple ou
      WNS, lista em `src/lib/push.js`; outro host → `400`) e responde `201 { id, endpoint }`; o mesmo endpoint
      atualiza a inscrição e, se for de outro usuário, passa para quem enviou.
      `DELETE /notificacoes/inscricoes` `{ endpoint }` é idempotente (`204`).
    - `GET /notificacoes/chave-publica` → `{ chavePublica }` (o `applicationServerKey`).
      `POST /notificacoes/teste` manda uma notificação para os aparelhos do usuário (`204`;
      `409 SEM_INSCRICAO` sem aparelho). Sem chaves VAPID no servidor → `503
      NOTIFICACOES_DESLIGADAS`.
    - Carga do push (JSON): `{ titulo, corpo, url, tag }`; `tag` repete para o mesmo lembrete da
      mesma ocorrência (o aparelho substitui em vez de empilhar).

18. **Categorias de cada usuário** (migration 12; spec
    `docs/superpowers/specs/2026-10-14-contas-abas-cartoes-design.md`):
    - O cadastro cria as 2 padrão — Contas residenciais e Outros ("Outros" veio na migration 16; "Consultas", "Exames" e "Parcelamentos" saíram na migration 22, que moveu as contas e compras de cartão delas para "Outros") (`src/modules/categorias/padrao.js`); não há mais seed. A
      migration copiou as categorias globais para cada usuário e repontou as contas dele.
    - `GET /categorias-pagamento` → `[{ id, nome, ordem }]` por ordem. `POST { nome, ordem? }`
      (sem ordem vai para o fim) → `201`. `PUT /:id { nome?, ordem? }` (pelo menos um).
      `DELETE /:id` → `204`.
    - Nome: 1–40 caracteres, aparado; único por usuário sem diferenciar maiúsculas
      (`409 CATEGORIA_DUPLICADA`). Apagar categoria com contas → `409 REFERENCIA_INVALIDA`.
      De outro usuário → `404`; numa conta → `400` ("categoria não encontrada").
    - No front cada categoria é uma aba da tela Contas (`/pagamentos?aba=<id>`).

19. **Cartões de crédito** (migration 13; mesma spec da decisão 18):
    - `cartao` (nome, final?, cor, dia_fechamento, dia_vencimento, limite_centavos?, ordem) e
      `cartao_compra` (descricao, categoria_id?, valor_total_centavos, parcelas 1–48, data_compra).
      As parcelas não são guardadas: saem de `src/lib/fatura.js` (funções puras).
    - **Competência** = mês do vencimento (dia 1). A fatura da competência M fecha no dia de
      fechamento de M se `dia_vencimento > dia_fechamento`, senão de M−1; dia que não existe no mês
      vira o último. A compra entra na primeira fatura que fecha **depois** dela (no dia do
      fechamento vai para a seguinte); a parcela k cai k−1 meses depois; o resto dos centavos vai
      para a parcela 1.
    - **A fatura é uma conta**: `pagamento` ganhou `cartao_id` + `competencia` (sem categoria,
      recorrência nem parcelamento; `categoria_id` passou a aceitar nulo só nela; uma por cartão e
      mês). Toda escrita de cartão ou compra recalcula todas as faturas do cartão na mesma
      transação (cria, atualiza valor/vencimento/descrição ou apaga a pendente). Se o valor de uma
      fatura **paga** mudaria, a operação é recusada: `409 FATURA_PAGA`.
    - Em `/pagamentos` a fatura vem com `cartaoId`, `cartaoNome`, `competencia` (nulos nas outras
      contas) e `categoriaNome` nulo; `PUT`/`DELETE` → `409 FATURA_AUTOMATICA`; `PATCH /pagar`
      funciona. Painel Hoje e lembretes tratam a fatura como qualquer conta pendente. No relatório
      por categoria as faturas somam num item `{ id: null, nome: "Cartão de crédito" }`.
    - `GET /cartoes` traz `limiteDisponivelCentavos` (limite − parcelas em faturas não pagas) e
      `faturaAtual` `{ competencia, totalCentavos, vencimento, situacao }` (a primeira não paga a
      partir do mês atual). `GET /cartoes/:id/faturas/:AAAA-MM` → `{ competencia, fechamento,
      vencimento, situacao: aberta|fechada|paga, totalCentavos, pagamentoId, parcelas[] }`; mês sem
      compras vem zerado. Apagar cartão com fatura paga → `409 REFERENCIA_INVALIDA`; sem, leva
      compras e faturas pendentes. Nome único por usuário sem diferenciar maiúsculas
      (`409 CARTAO_DUPLICADO`).
    - No front é a aba "Cartões" de Contas (`/pagamentos?aba=cartoes&cartao=<id>&mes=AAAA-MM`).

20. **Trocar senha** (migrations 14 e 15): `PUT /auth/senha` com `{ senhaAtual, novaSenha }` (nova com
    as regras do cadastro e diferente da atual) devolve uma sessão nova `{ token, usuario }`. Senha
    atual errada → `400 SENHA_INCORRETA`; as tentativas contam no limite do login. O token leva
    a versão da sessão (claim `v`; sem ela = 0) e a troca incrementa `usuario.versao_sessao` no
    mesmo UPDATE do hash (só se o hash ainda é o conferido; senão `409 CONFLITO`). `autenticar`
    recusa token de outra versão (`401 "A senha foi trocada. Entre novamente."`): os outros
    aparelhos saem. (A 14 usava horário, `sessoes_desde`; a 15 trocou por versão para não depender
    de relógio.) As inscrições de push
    da conta são apagadas; o aparelho que trocou reenvia a dele ao receber o token novo. "Esqueci
    minha senha" (por e-mail) ainda não existe.

21. **Resumo da manhã** (migration 17): um aviso por dia na hora escolhida (`usuario.resumo_ativo`,
    `resumo_hora`; vem ligado às 07:00), gerador `resumo` (`origem_id` = o usuário). O texto sai
    do mesmo `painel` de `/hoje` na hora de enviar: agendamentos (o 1º horário), remédios e
    compromissos pendentes, contas que vencem no dia e vencidas. Dia sem nada não envia.
    `GET/PUT /notificacoes/resumo` `{ ativo, hora }`; salvar cancela os resumos pendentes e o
    agendador gera os do horário novo. Front: seção "Resumo da manhã" em Notificações.

22. **Comprovantes de conta** (migration 18): foto ou PDF anexado a qualquer conta (inclusive fatura
    de cartão), até 5 por conta, com as regras dos anexos de viagem (`src/lib/anexos.js`: tipo pelo
    conteúdo, 10 MB, nome seguro). Toda conta traz `totalComprovantes`; `GET /pagamentos/:id` traz
    também `comprovantes[]`. Apagar contas (excluir, fatura que zera, cartão excluído) apaga os
    arquivos depois que a transação confirma (`comprovantes.aoApagarContas`).

23. **Equipe e salários** (migration 19; substitui as categorias "Salários" e "Honorários médicos",
    que deixaram de ser padrão — o cadastro cria só 5; a migration 20 apaga as duas de quem já
    tinha conta e move as contas delas para "Outros"):
    - `membro_equipe` (nome único por usuário sem diferenciar maiúsculas → `409 MEMBRO_DUPLICADO`,
      funcao?, forma_pagamento `mensal|plantao|honorario`, chave_pix?, ativo) e
      `membro_equipe_dia` (dia 1–31, valor_previsto_centavos?, `desde`). `POST/PUT /equipe`
      recebem `dias: [{ dia, valorPrevistoCentavos? }]` (1 a 10, sem repetir).
    - **Contas automáticas** (`src/modules/equipe/contas.js`, `garantirContas`): para cada pessoa
      ativa e cada dia, a conta do mês atual e do seguinte em `pagamento` (`membro_id`, descrição =
      nome, valor = previsto ou **nulo = a definir**). Só a partir de `desde` (cadastro novo não
      cria conta vencida); dia 31 em mês curto vira o último dia. Idempotente
      (`unique (membro_id, vencimento)` + `ON CONFLICT`); roda ao salvar a pessoa e na manutenção do
      servidor (`src/jobs/manutencao.js`, ao subir e a cada 6 h, `garantirContasDeTodos`). **Abrir
      uma tela nunca grava**: `/pagamentos`, `/hoje` e os relatórios só leem.
    - Mudar dias/valores ou desativar apaga as contas pendentes de hoje em diante e recria as que
      couberem; vencidas e pagas ficam. Reativar volta a criar só a partir de hoje. Excluir a pessoa
      só se nunca recebeu (senão `409 REFERENCIA_INVALIDA`: desative).
    - Em `/pagamentos` a conta vem com `membroId`/`membroNome` e pode ter `valorCentavos: null`.
      `PUT` nela grava só valor, vencimento, status/dataPagamento e observações (categoria e
      descrição ficam). Nas outras contas o `PUT` continua exigindo categoria e valor (`400`).
      `PATCH /pagar` aceita `valorCentavos` na conta da equipe (obrigatório se estava a definir).
      Apagar a conta, ou mudar a data dela, registra o dia em `membro_equipe_dispensa` para não ser
      criado de novo. Totais (Hoje, relatório) ignoram valor nulo; no relatório por categoria a
      equipe soma em `{ id: null, nome: "Salários equipe" }`. Lembrete sem valor diz "valor a definir".
    - No front é a aba "Salários equipe" de Contas (`/pagamentos?aba=equipe`); a conta da equipe abre
      um formulário próprio em `/pagamentos/:id` (com a chave PIX para copiar); pessoas em
      `/equipe/novo` e `/equipe/:id`.

24. **Tarefas do dia** (migration 21, `src/modules/hoje/tarefas.js`; tela Hoje): uma lista só com
    o que ocorre no dia, cada item com ✓ (feito) e ✗ (não feito).
    - `GET /hoje?data=` (padrão hoje) → `{ data, resumo: { programadas, concluidas, pendentes,
      atrasadas }, tarefas: [{ id, categoria, titulo, detalhe, horario, status, link,
      concluirNoFormulario }] }`, em ordem de `horario`; sem horário (dia todo) no fim. No mesmo
      horário, a ordem das categorias e, dentro delas, a do módulo.
    - Entram: remédios (um item por horário cadastrado, `detalhe` = a dose como foi digitada),
      eventos (`radio`, `atividade`, `fisioterapia` pelo tipo; o resto `agenda`; recorrentes
      expandidos; evento que começou em outro dia fica sem horário), compromissos do dia da
      semana, viagens com ida ou volta no dia e contas com vencimento no dia (`detalhe` = valor ·
      imóvel). Olhando hoje, entram também as contas vencidas antes e pendentes (`detalhe` termina em
      "Venceu em dd/MM") e as vencidas antes que foram pagas hoje (para o ✓ poder ser desfeito).
      Compras não entram: o item não tem data.
    - `id` = `"<categoria>:<idItem>:<ocorrência>"`, ocorrência `AAAA-MM-DD` ou `AAAA-MM-DDTHH:MM`
      (idItem: horário do remédio, evento, rotina, viagem ou pagamento). Títulos com inicial maiúscula.
    - `status`: `feito`, `nao_feito`, `pendente` ou `atrasado` (pendente com horário — ou, sem
      horário, a data — já passado, no fuso de São Paulo).
    - `PATCH /hoje/:id` com `{ status: "feito" | "nao_feito" | "pendente" }` responde a tarefa.
      `pendente` desfaz. A ocorrência é conferida recalculando o dia dela: de outro usuário ou que
      não ocorre naquele dia → `404`; id fora do formato → `400`.
    - O "feito" de remédio, compromisso e despesa fica no próprio módulo (`medicamento_registro`,
      `rotina_conclusao`, `pagamento` pago com a data de hoje — o mesmo `pagar()` de `PATCH
      /pagar`, que cria a próxima da série). Desfazer ou ✗ desmarca lá (a conta volta a pendente; a
      próxima da série, se criada, fica). Em `tarefa_registro` ficam o ✗ deles e o ✓/✗ das outras
      categorias; sem linha = pendente.
    - Conta da equipe com valor a definir: `concluirNoFormulario: true` e o ✓ responde `400`
      (o valor pago é informado no formulário da conta); o ✗ vale normalmente.

25. **Visão financeira e painel** (`GET /relatorios/financeiro?inicio=&fim=`, ambos obrigatórios;
    front: tela Início em `/`, a tela Hoje passou para `/hoje`):
    - Critérios explícitos. **Contas do período** = `vencimento` no período (competência = mês do
      vencimento), pagas ou não, separadas em `pagoCentavos`, `pendenteCentavos` e
      `vencidoCentavos` (pendente com vencimento antes de hoje). **Realizado**
      (`saidas.pagoNoPeriodoCentavos`) = pagas com `dataPagamento` no período, de qualquer
      vencimento. Valor nulo (equipe a definir) soma 0 e é contado em `saidas.contasADefinir`.
    - Resposta: `{ inicio, fim, saidas: { totalCentavos, pagoCentavos, pendenteCentavos,
      vencidoCentavos, pagoNoPeriodoCentavos, contasADefinir }, entradas: { totalCentavos,
      recebidoCentavos, pendenteCentavos, vencidoCentavos, recebidoNoPeriodoCentavos, porOrigem: [{
      origem, totalCentavos, recebidoCentavos, pendenteCentavos }] }, saldo: { realizadoCentavos,
      projetadoCentavos }, imoveis: [{ id, nome, ...valores }], pessoal: { ...valores, categorias:
      [{ id, nome, totalCentavos }] } }`.
    - **Entradas** = recebíveis com `dataPrevista` no período (previsto, já recebido deles, saldo a
      receber e saldo atrasado); `recebidoNoPeriodoCentavos` = recebimentos com data no período, de
      qualquer recebível. **Saldo realizado** = recebido no período − pago no período (só o que de
      fato entrou e saiu). **Saldo projetado** = entradas previstas − contas do período. `imoveis` traz todos os
      imóveis do usuário (na ordem dele, zerados se não têm contas).
    - **Destino** da despesa: imóvel = conta com `imovelId`; **pessoal** = sem imóvel (faturas de
      cartão e salários da equipe incluídos). Cada conta tem no máximo um imóvel e as compras de
      cartão só entram pela fatura, então imóveis + pessoal = total, sem contar nada duas vezes.
      Rateio de uma conta entre imóveis não existe. `GET /pagamentos?destino=pessoal|imovel` filtra
      pelo mesmo critério.
    - Só lê. As contas da equipe já existem (criadas ao salvar a pessoa e pela manutenção do
      servidor, decisão 23), então entram no total sem a consulta gravar nada.

26. **Recebíveis** (valores a receber — "receitas" aqui nunca é receita médica; migration 24,
    `src/modules/recebiveis/`):
    - `recebivel` (descricao, origem `dividendos|aluguel|rendimentos|honorarios|outros`,
      valor_previsto_centavos, data_prevista, encerrado, recorrencia `nenhuma|mensal|anual`,
      recorrencia_origem_id, observacoes) e o histórico em `recebimento` (valor_centavos > 0, data,
      observacoes). Comprovantes em `recebivel_comprovante`, com as regras dos de conta
      (`src/lib/comprovantes.js`, a mesma fábrica dos comprovantes de conta).
    - **Situação derivada, nada em dobro**: `recebidoCentavos` = soma dos recebimentos; `status`
      `recebido` quando a soma ≥ previsto **ou** encerrado (ex.: dividendo menor que o esperado:
      `POST /recebimentos` com `encerrar: true`), `parcial` com algo recebido, senão `pendente`;
      `saldoCentavos` = previsto − recebido (0 quando recebido); `atrasado` = não recebido com
      `dataPrevista` < hoje. Receber mais que o previsto é aceito.
    - `POST /recebiveis/:id/recebimentos` `{ valorCentavos, data? (hoje), observacoes?, encerrar? }`
      → `201` com o detalhe; já recebido → `409 JA_RECEBIDO`. `DELETE .../recebimentos/:id` desfaz
      (o recebível volta a aberto e perde o "encerrado"). Listagem pela `dataPrevista`, filtros
      `status` e `origem`. De outro usuário → `404`.
    - **Recorrência só quando configurada**: ao ficar `recebido`, o recorrente ganha a próxima
      ocorrência (data a partir do início da série, como nas contas; índice único em
      `recorrencia_origem_id`, então desfazer e receber de novo não duplica). O `PUT` muda só aquela
      ocorrência; as próximas nascem dela.

27. **Residências** (migration 25): `imovel` ganhou `endereco` e `complemento` (identificação
    complementar, ex.: "Apto 302"), ambos opcionais. No `POST`/`PUT /imoveis`, campo **ausente** não
    muda (quem só renomeia — inclusive uma versão antiga do app — não apaga o endereço); vazio ou
    `null` apaga. `GET /imoveis/:id` devolve um imóvel.
    - `GET /relatorios/imoveis/:id?inicio=&fim=` (ambos obrigatórios): só as contas do imóvel com
      `vencimento` no período → `{ inicio, fim, imovel, totalCentavos, pagoCentavos, pendenteCentavos,
      vencidoCentavos, totalComprovantes, categorias: [{ id, nome, totalCentavos, pagoCentavos }],
      meses: [{ mes: "AAAA-MM", totalCentavos, pagoCentavos }] }` (todo mês do período, mesmo
      zerado). Mesmos critérios da decisão 25; imóvel de outro usuário → `404`.
    - Tudo calculado das contas vinculadas: não existe total digitado à mão. Rateio de uma conta
      entre imóveis não existe (cada conta tem no máximo um imóvel), então nada conta duas vezes.

28. **Tarefas avulsas** (migration 26, `src/modules/tarefas/`): algo a fazer num dia, sem agenda nem
    rotina (ler e-mails, conferir o banco, ligar para alguém). `{ titulo, detalhes?, data, hora?,
    lembrete }` (`lembrete` exige `hora`). `concluida_em` guarda quando foi feita (histórico
    mínimo); `PATCH /tarefas/:id/concluir` `{ concluida? = true }` conclui ou reabre e é idempotente
    (concluir de novo mantém a hora da primeira vez). Resposta traz `concluida` e `atrasada`
    (pendente com data antes de hoje). Listagem por data, hora e título; filtro `situacao`.
    - **Tela Hoje** (decisão 24): categoria `tarefa` (a migration 26 troca o CHECK de
      `tarefa_registro.categoria`). Entram as do dia e, olhando hoje, as de dias anteriores ainda
      abertas (sem horário, `detalhe` termina em "Era para dd/MM") e as anteriores concluídas hoje
      (para o ✓ poder ser desfeito). O ✓ conclui a própria tarefa; ✗ e desfazer reabrem e o ✗ fica
      em `tarefa_registro`. Concluir uma tarefa não marca evento, remédio nem conta.
    - **Lembrete** (origem `tarefa`, mesmo CHECK trocado em `lembrete_envio`): na data e hora da
      tarefa com `lembrete`; tarefa concluída, apagada, sem lembrete ou com dia/hora mudados não é
      avisada. Editar ou excluir cancela os pendentes (o agendador gera de novo).

29. **Avisos por categoria** (migration 27, `src/lembretes/categorias.js`): `usuario.avisos_desligados`
    guarda as categorias desligadas (`agenda` = evento, `remedios` = medicamento_horario, `contas` =
    pagamento, `compromissos` = rotina, `tarefas` = tarefa); vazio = tudo ligado, como antes. O
    resumo da manhã continua com a preferência própria (decisão 21).
    - `GET /notificacoes/avisos` → `{ agenda, remedios, contas, compromissos, tarefas }` (booleans).
      `PUT` aceita qualquer subconjunto (ausente fica como está; vazio → `400`).
    - Desligar cancela na hora os lembretes pendentes daquelas origens; o agendador não gera mais
      para quem desligou (`quemRecebe` em `agendador.js`) e, na hora de enviar, confere de novo
      (cancelado com "Aviso desta categoria desligado.") — sem aviso duplicado nem atrasado. Religar
      volta a gerar no ciclo seguinte. Editar ou excluir a origem continua cancelando os pendentes.

30. **Tipos da Agenda** (migration 28): além dos antigos (`reuniao_pessoal` — "Reunião" —,
    `consulta`, `exame`, `fisioterapia`, `atividade_fisica`, `programa_radio` e `video`, que continua
    valendo nos antigos mas não é mais oferecido), entram `videoconferencia`, `podcast`, `gravacao`,
    `entrevista` e `outro`. No `outro`, `tipoDescricao` ("Descreva o compromisso") é obrigatório:
    `400` com `tipoDescricao: Descreva o compromisso.` (vazio ou só espaços) e, no banco,
    `evento_tipo_descricao_check`. Nos outros tipos o service grava `tipoDescricao` nulo (trocar de
    tipo apaga a descrição). **Viagem** não é tipo de evento: no formulário, escolher "Viagem" leva
    ao cadastro de viagem (`/viagens/nova`), que é da área Agenda — sem segundo cadastro.
31. **Saúde** (migration 29): o remédio ganha `dataInicio`/`dataFim` (período de uso, opcionais e
    inclusivos; sem eles vale todo dia, como os cadastrados antes) e `intervaloHoras` (1–24, só
    registro do "a cada N horas"). Fora do período a dose não entra em `/medicamentos/hoje`, na tela
    Hoje nem nos lembretes, e `POST /medicamentos/registros` responde `400`. O back-end **não gera
    nem muda horários**: o formulário monta a lista (`montarHorarios`) quando a pessoa toca em
    "Montar horários", e ela confere antes de salvar. A dose tem `situacao` (`tomado`, `nao_tomado`,
    `pendente`): o "não tomado" é a linha `nao_feito` de `tarefa_registro` (o mesmo ✗ da tela Hoje), e
    `registros` aceita `situacao` no lugar de `tomado`; dose marcada (tomada ou não) não é lembrada.
    Consulta, exame e fisioterapia ganham `profissional` e `especialidade` (nulos nos outros tipos);
    presencial usa `local` (endereço) e online o `link`. Continuam sendo eventos da Agenda, mostrados
    também nas telas de Saúde (sem segundo cadastro).
32. **Compromissos** (migration 30): continuam sendo dois cadastros — `rotina` (repete nos dias da
    semana) e `tarefa` (uma vez, com dia) —, que no app são o mesmo "Novo lembrete" ("Quantas
    vezes? Só uma vez / Repete" troca de formulário levando o texto). A rotina ganha `observacoes`.
    `GET /rotinas/:id/historico?inicio&fim` (padrão: 60 dias até hoje) lista os dias marcados:
    `feito` (de `rotina_conclusao`) e `nao_feito` (o ✗ da tela Hoje, em `tarefa_registro`; no
    mesmo dia, o feito vale). As sugestões (Leitura de e-mails, WhatsApp, Enviar mensagens,
    Verificar pagamentos bancários) só abrem o formulário preenchido: **não há integração** com
    e-mail, WhatsApp ou banco (uma futura API de WhatsApp seria só para enviar lembretes).
33. **Finanças em abas; Cartões e Categorias fora do menu** (só front, nenhuma rota ou tabela
    mudou): Despesas pessoais (Despesas do mês / A pagar / Por categoria, sem o filtro de imóvel),
    detalhe do imóvel (Resumo / Contas / Dados do imóvel), Equipe (Pagamentos do mês / Pessoas),
    Recebíveis (Do mês / A receber / Recebidos / Resumo) e Relatório (Balanço / Recebíveis e pessoais /
    Por imóvel ou categoria). A aba fica em `?vista=`. Cartões e Categorias estão **ocultos** da
    navegação (`CARTOES_VISIVEIS`/`CATEGORIAS_VISIVEIS` no front): rotas, telas, dados, faturas e o
    back-end continuam; categoria nova se cria no próprio cadastro ("+ Nova categoria…" na conta e na
    compra do cartão). Recebíveis não usam categoria (têm a `origem`, fixa). "Gerar PDF" no Relatório
    é feito no navegador (jsPDF, carregado só ao gerar) com os números já devolvidos por
    `/relatorios/financeiro` e `/relatorios/gastos` — nada recalculado.
34. **Agenda com calendário e um "+ Novo" só** (só front, nenhuma rota ou tabela mudou): a Agenda
    abre num calendário mensal (agendamentos e viagens marcados; o dia escolhido embaixo/ao lado),
    com Semana e Próximos em abas. O único botão de cadastro oferece 7 opções — Compromissos e
    eventos, Consultas, Exames, Fisioterapia, Atividades físicas, Viagens e Programas de rádio —, cada
    uma com formulário próprio sobre o mesmo `POST /eventos` (a viagem usa o cadastro de viagens).
    No rádio, a emissora vai em `local`; na consulta e na fisioterapia sem título, o front monta um
    ("Consulta de Cardiologia"). Viagens e Programa de rádio saíram do menu; `/viagens` e `/radio`
    continuam. Na Equipe a aba de pessoas chama "Integrantes" e Recebíveis mostra também o atrasado.

## Convenções de banco

- IDs `uuid` (`gen_random_uuid()`).
- "Enums" como `text` + `CHECK` (adicionar valor = migration trocando o CHECK).
- `date` para datas sem hora (driver configurado para devolver string), `timestamptz` para
  instantes, `time` para hora do dia. Sessão do Postgres em `America/Sao_Paulo`.
- Tabelas raiz têm `usuario_id` (FK, `ON DELETE CASCADE`): imovel, categoria_pagamento, pagamento, evento, rotina,
  medicamento, viagem, compra_item, lembrete_envio, push_inscricao, tarefa_registro, recebivel, tarefa. Tabelas filhas (conclusões,
  horários, registros, anexos) herdam o dono pela tabela pai. Índices começam por `usuario_id`.
- `pagamento (imovel_id, usuario_id)` → `imovel (id, usuario_id)` e `pagamento (categoria_id,
  usuario_id)` → `categoria_pagamento (id, usuario_id)`: FKs compostas impedem apontar para imóvel
  ou categoria de outro usuário.
- `criado_em` / `atualizado_em` (trigger) nas tabelas de domínio.

## Schema

| Tabela | Colunas principais | Restrições / índices |
|---|---|---|
| usuario | id, nome, email (citext unique), senha_hash, versao_sessao, resumo_ativo, resumo_hora, avisos_desligados text[] | avisos_desligados ⊆ categorias de aviso |
| imovel | id, usuario_id, nome, ordem, endereco?, complemento? | unique (usuario_id, nome); unique (id, usuario_id) |
| categoria_pagamento | id, usuario_id, nome, ordem | unique (usuario_id, lower(nome)); unique (id, usuario_id) |
| cartao | id, usuario_id, nome, final?, cor, dia_fechamento, dia_vencimento, limite_centavos?, ordem | unique (usuario_id, lower(nome)); unique (id, usuario_id); dias 1–31 |
| cartao_compra | cartao_id, descricao, categoria_id?, valor_total_centavos, parcelas, data_compra, observacoes | parcelas 1–48; idx (cartao_id, data_compra) |
| membro_equipe | id, usuario_id, nome, funcao?, forma_pagamento, chave_pix?, ativo | unique (usuario_id, lower(nome)); unique (id, usuario_id) |
| membro_equipe_dia | membro_id, dia, valor_previsto_centavos?, desde | unique (membro_id, dia); dia 1–31 |
| membro_equipe_dispensa | membro_id, vencimento | pk (membro_id, vencimento) |
| pagamento | descricao, categoria_id? (nulo na fatura e na equipe), cartao_id?, competencia?, membro_id?, valor_centavos? (nulo só na equipe pendente), imovel_id?, valor_centavos, vencimento, status, data_pagamento?, recorrencia, recorrencia_origem_id?, parcelamento_grupo_id?, parcela_atual?, parcela_total?, observacoes | status=pago ⇔ data_pagamento; parcelas tudo-ou-nada e 1≤atual≤total; não parcelado+recorrente; idx vencimento, (status,vencimento), data_pagamento, categoria_id, imovel_id, parcelamento_grupo_id |
| evento | titulo, tipo, tipo_descricao?, modalidade?, inicio, fim?, local, profissional?, especialidade?, link, observacoes, recorrencia, recorrencia_fim?, lembretes_minutos_antes int[] | fim>inicio; lembretes >0, até 5, sem repetição; idx inicio, (tipo,inicio), parcial recorrentes |
| rotina | titulo, hora?, dias_semana smallint[], ativo, ordem, lembrete, observacoes? | |
| rotina_conclusao | rotina_id, data, concluida_em | unique (rotina_id, data) |
| medicamento | nome, dose, observacoes, ativo, data_inicio?, data_fim?, intervalo_horas? | fim >= início; intervalo 1–24 |
| medicamento_horario | medicamento_id, periodo, hora?, dia_semana? | semanal ⇒ dia_semana |
| medicamento_registro | medicamento_horario_id, data, tomado_em | unique (horario, data) |
| viagem | destino, ida, volta?, hospedagem, transporte, observacoes | volta≥ida; idx ida |
| pagamento_comprovante | pagamento_id, nome_original, caminho, mime_type, tamanho_bytes | cascade com o pagamento |
| viagem_anexo | viagem_id, nome_original, caminho, mime_type, tamanho_bytes | |
| compra_item | nome, categoria?, quantidade?, comprado, comprado_em? | idx comprado |
| lembrete_envio | origem_tipo, origem_id, ocorrencia, canal, agendado_para, enviado_em?, status, tentativas, erro? | unique (origem_tipo, origem_id, ocorrencia, agendado_para, canal); idx (status, agendado_para) |
| push_inscricao | endpoint (unique), p256dh, auth, user_agent | |
| recebivel | usuario_id, descricao, origem, valor_previsto_centavos (bigint), data_prevista, encerrado, recorrencia, recorrencia_origem_id?, observacoes | CHECKs de origem, recorrência e valor > 0; único parcial (recorrencia_origem_id); idx (usuario_id, data_prevista) |
| recebimento | recebivel_id, valor_centavos (bigint), data, observacoes | valor > 0; cascade com o recebível; idx (recebivel_id, data) |
| recebivel_comprovante | recebivel_id, nome_original, caminho, mime_type, tamanho_bytes | cascade com o recebível |
| tarefa | usuario_id, titulo, detalhes?, data, hora?, lembrete, concluida_em? | lembrete ⇒ hora; idx (usuario_id, data) |
| tarefa_registro | usuario_id, categoria, item_id (sem FK), data_ocorrencia, horario?, status (feito, nao_feito) | unique nulls not distinct (usuario_id, categoria, item_id, data_ocorrencia, horario) |

## Lembretes

1. Agendador (a cada minuto) roda os geradores (evento, medicamento, pagamento, rotina, tarefa, resumo) para as
   próximas 24h e faz upsert em `lembrete_envio`, uma linha por canal ativo.
2. Envia as linhas `pendente` com `agendado_para <= agora` via `canais[canal].enviar(lembrete)`.
3. Novo canal (ex.: WhatsApp) = `src/lembretes/canais/whatsapp.js` + registro + migration do CHECK.
4. Editar/excluir a origem cancela os pendentes e regenera (o upsert devolve a `pendente` os
   cancelados que continuam valendo).
5. Código em `src/lembretes/`: `agendador.js` (ciclo), `geradores/` (um por `origem_tipo`, com
   `gerar` e `mensagem`) e `canais/` (`app` = Web Push). O agendador roda dentro do processo da API
   (`src/server.js`) só quando há canal ativo (chaves VAPID no `.env`).
