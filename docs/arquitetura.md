# App Débora — Arquitetura do back-end

Back-end de uma secretária pessoal **multiusuário**: qualquer pessoa se cadastra e cada uma vê
apenas os próprios dados (a Débora é a primeira usuária). O front é um PWA desenvolvido
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
| lembrete_envio | origem_tipo, origem_id, ocorrencia, canal, agendado_para, enviado_em?, status, tentativas, erro? | unique (origem_tipo, origem_id, ocorrencia, canal); idx (status, agendado_para) |
| push_inscricao | endpoint (unique), p256dh, auth, user_agent | |

## Lembretes

1. Agendador (a cada minuto) roda os geradores (evento, medicamento, pagamento, rotina) para as
   próximas 24h e faz upsert em `lembrete_envio`, uma linha por canal ativo.
2. Envia as linhas `pendente` com `agendado_para <= agora` via `canais[canal].enviar(lembrete)`.
3. Novo canal (ex.: WhatsApp) = `src/lembretes/canais/whatsapp.js` + registro + migration do CHECK.
4. Editar/excluir a origem cancela os pendentes e regenera.
