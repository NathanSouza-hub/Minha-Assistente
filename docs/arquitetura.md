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
- Dinheiro: inteiro em centavos (`15990` = R$ 159,90).
- Erros: `{ "erro": { "codigo": "STRING", "mensagem": "texto" } }`.
- Listagens devolvem array direto, sem paginação (volume de uma pessoa).
- Todas as rotas exceto `POST /auth/cadastro` e `POST /auth/login` exigem
  `Authorization: Bearer <jwt>`. Toda consulta é filtrada pelo usuário do token; recurso de
  outro usuário responde `404` (não revela que existe).

## Rotas

```
POST /auth/cadastro (acrescentada, aberta) | POST /auth/login | GET /auth/me
GET  /hoje
GET/POST /pagamentos (inicio, fim, status, categoriaId, imovelId) | GET/PUT/DELETE /pagamentos/:id
PATCH /pagamentos/:id/pagar
GET/POST /imoveis | PUT/DELETE /imoveis/:id  (escrita acrescentada) | GET /categorias-pagamento
GET /relatorios/gastos?inicio=&fim=&agruparPor=imovel|categoria
GET/POST /eventos (inicio, fim, tipo) | GET/PUT/DELETE /eventos/:id
GET/POST /rotinas | PUT/DELETE /rotinas/:id | GET /rotinas/hoje | POST /rotinas/:id/concluir
GET/POST /medicamentos | GET/PUT/DELETE /medicamentos/:id | GET /medicamentos/hoje
POST /medicamentos/registros
GET/POST /viagens | GET/PUT/DELETE /viagens/:id | POST /viagens/:id/anexos
GET/DELETE /viagens/:id/anexos/:anexoId                      (acrescentada)
GET/POST /compras | PUT/DELETE /compras/:id | PATCH /compras/:id/comprado
POST /notificacoes/inscricoes | DELETE /notificacoes/inscricoes  (acrescentada, Web Push)
GET /notificacoes/chave-publica | POST /notificacoes/teste       (acrescentadas)
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
9. **Multiusuário**: cadastro aberto (`POST /auth/cadastro` com `{ nome, email, senha }`, devolve
   o token como o login). Imóveis são de cada usuário (CRUD em `/imoveis`); categorias são
   globais (seed). Apagar um imóvel usado por pagamentos responde `409 REFERENCIA_INVALIDA`.

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
    - `GET /medicamentos/hoje?data=` (padrão hoje): diários + semanais do dia da semana, só ativos.
      Item: `{ horarioId, medicamentoId, nome, dose, observacoes, periodo, hora, data, tomado, tomadoEm }`.
    - `POST /medicamentos/registros` `{ horarioId, data?, tomado? }` responde o item atualizado;
      é idempotente e `tomado: false` desmarca. Semanal fora do dia da semana → `400`.

13. **Rotina (etapa 7)**:
    - Tarefa: `{ titulo, hora?, diasSemana (padrão todos), ativo, ordem, lembrete }`; `lembrete`
      exige `hora`.
    - `GET /rotinas/hoje?data=` (padrão hoje): ativas previstas para o dia da semana, ordenadas por
      `ordem`, hora e título. Item: `{ rotinaId, titulo, hora, ordem, data, concluida, concluidaEm }`.
    - `POST /rotinas/:id/concluir` `{ data?, concluida? }` responde o item; idempotente;
      `concluida: false` desfaz; dia fora de `diasSemana` → `400`.

14. **Painel Hoje (etapa 8)**: `GET /hoje?data=` (padrão hoje) responde
    `{ data, resumo, eventos, medicamentos, rotina, pagamentos: { vencidos, aVencer,
    totalVencidoCentavos, totalAVencerCentavos } }`. Cada lista tem o mesmo formato do seu módulo;
    `aVencer` = pendentes com vencimento do dia até 7 dias depois; `resumo` traz as contagens
    (`eventos`, `remediosPendentes`, `tarefasPendentes`, `pagamentosVencidos`, `pagamentosAVencer`).

15. **Viagens (etapa 9)**:
    - Viagem traz `anexos: [{ id, nomeOriginal, mimeType, tamanhoBytes, criadoEm }]`; listagem
      com a ida mais recente primeiro.
    - Upload: o tipo é detectado pelo **conteúdo** (PDF, JPG, PNG, WEBP, HEIC), não pelo
      Content-Type; até 10 MB e 20 anexos por viagem. Erros: `413 ARQUIVO_GRANDE_DEMAIS`,
      `415 TIPO_NAO_SUPORTADO`, `409 LIMITE_ANEXOS`, `400 UPLOAD_INVALIDO` (campo errado).
    - Arquivo salvo com nome aleatório em `UPLOADS_DIR` (`src/lib/armazenamento.js`, trocável por
      S3); download sempre como `attachment` com o nome original.

16. **Compras (etapa 10)**: item `{ id, nome, categoria, quantidade, comprado, compradoEm }`.
    `GET /compras?comprado=true|false` lista pendentes primeiro (categoria, nome) e depois os
    comprados (mais recentes primeiro). `PATCH /compras/:id/comprado` sem corpo marca;
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
      p256dh, auth } }`, endpoint https) e responde `201 { id, endpoint }`; o mesmo endpoint
      atualiza a inscrição e, se for de outro usuário, passa para quem enviou.
      `DELETE /notificacoes/inscricoes` `{ endpoint }` é idempotente (`204`).
    - `GET /notificacoes/chave-publica` → `{ chavePublica }` (o `applicationServerKey`).
      `POST /notificacoes/teste` manda uma notificação para os aparelhos do usuário (`204`;
      `409 SEM_INSCRICAO` sem aparelho). Sem chaves VAPID no servidor → `503
      NOTIFICACOES_DESLIGADAS`.
    - Carga do push (JSON): `{ titulo, corpo, url, tag }`; `tag` repete para o mesmo lembrete da
      mesma ocorrência (o aparelho substitui em vez de empilhar).

## Convenções de banco

- IDs `uuid` (`gen_random_uuid()`).
- "Enums" como `text` + `CHECK` (adicionar valor = migration trocando o CHECK).
- `date` para datas sem hora (driver configurado para devolver string), `timestamptz` para
  instantes, `time` para hora do dia. Sessão do Postgres em `America/Sao_Paulo`.
- Tabelas raiz têm `usuario_id` (FK, `ON DELETE CASCADE`): imovel, pagamento, evento, rotina,
  medicamento, viagem, compra_item, lembrete_envio, push_inscricao. Tabelas filhas (conclusões,
  horários, registros, anexos) herdam o dono pela tabela pai. Índices começam por `usuario_id`.
- `pagamento (imovel_id, usuario_id)` → `imovel (id, usuario_id)`: FK composta impede apontar
  para imóvel de outro usuário.
- `criado_em` / `atualizado_em` (trigger) nas tabelas de domínio.

## Schema

| Tabela | Colunas principais | Restrições / índices |
|---|---|---|
| usuario | id, nome, email (citext unique), senha_hash | |
| imovel | id, usuario_id, nome, ordem | unique (usuario_id, nome); unique (id, usuario_id) |
| categoria_pagamento | id, nome (unique), ordem | seed |
| pagamento | descricao, categoria_id, imovel_id?, valor_centavos, vencimento, status, data_pagamento?, recorrencia, recorrencia_origem_id?, parcelamento_grupo_id?, parcela_atual?, parcela_total?, observacoes | status=pago ⇔ data_pagamento; parcelas tudo-ou-nada e 1≤atual≤total; não parcelado+recorrente; idx vencimento, (status,vencimento), data_pagamento, categoria_id, imovel_id, parcelamento_grupo_id |
| evento | titulo, tipo, modalidade?, inicio, fim?, local, link, observacoes, recorrencia, recorrencia_fim?, lembretes_minutos_antes int[] | fim>inicio; lembretes >0, até 5, sem repetição; idx inicio, (tipo,inicio), parcial recorrentes |
| rotina | titulo, hora?, dias_semana smallint[], ativo, ordem, lembrete | |
| rotina_conclusao | rotina_id, data, concluida_em | unique (rotina_id, data) |
| medicamento | nome, dose, observacoes, ativo | |
| medicamento_horario | medicamento_id, periodo, hora?, dia_semana? | semanal ⇒ dia_semana |
| medicamento_registro | medicamento_horario_id, data, tomado_em | unique (horario, data) |
| viagem | destino, ida, volta?, hospedagem, transporte, observacoes | volta≥ida; idx ida |
| viagem_anexo | viagem_id, nome_original, caminho, mime_type, tamanho_bytes | |
| compra_item | nome, categoria?, quantidade?, comprado, comprado_em? | idx comprado |
| lembrete_envio | origem_tipo, origem_id, ocorrencia, canal, agendado_para, enviado_em?, status, tentativas, erro? | unique (origem_tipo, origem_id, ocorrencia, agendado_para, canal); idx (status, agendado_para) |
| push_inscricao | endpoint (unique), p256dh, auth, user_agent | |

## Lembretes

1. Agendador (a cada minuto) roda os geradores (evento, medicamento, pagamento, rotina) para as
   próximas 24h e faz upsert em `lembrete_envio`, uma linha por canal ativo.
2. Envia as linhas `pendente` com `agendado_para <= agora` via `canais[canal].enviar(lembrete)`.
3. Novo canal (ex.: WhatsApp) = `src/lembretes/canais/whatsapp.js` + registro + migration do CHECK.
4. Editar/excluir a origem cancela os pendentes e regenera (o upsert devolve a `pendente` os
   cancelados que continuam valendo).
5. Código em `src/lembretes/`: `agendador.js` (ciclo), `geradores/` (um por `origem_tipo`, com
   `gerar` e `mensagem`) e `canais/` (`app` = Web Push). O agendador roda dentro do processo da API
   (`src/server.js`) só quando há canal ativo (chaves VAPID no `.env`).
