# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Back-end do **Minha Assistente**, secretária pessoal multiusuário (Node 20+, Express 5, PostgreSQL
via Knex, Zod 4, JWT). Código, comentários, nomes e mensagens são em **português do Brasil**.
O front (PWA) fica em `web/`, com `package.json` e `CLAUDE.md` próprios; o escopo e a ordem das
entregas dele estão em `docs/prompt-front.md`. Os comandos abaixo são do back-end (raiz).

`docs/arquitetura.md` é o contrato da API (rotas, decisões acordadas, schema, lembretes). Leia
antes de criar um módulo e mantenha-o atualizado quando o contrato mudar.

## Comandos

```bash
docker compose up -d          # Postgres 18 local na porta 5433 (não 5432)
cp .env.example .env          # JWT_SECRET precisa de ≥ 32 caracteres
npm run db:setup              # migrations (não há seed)
npm run dev                   # node --watch; Swagger em http://localhost:3000/docs
npm test                      # todos os testes (node:test, sequenciais)
node --test test/auth.test.js                     # um arquivo
node --test --test-name-pattern="409" test/auth.test.js   # um teste pelo nome
npm run migrate:reset         # desfaz tudo e reaplica as migrations (APAGA os dados locais)
npm run senha:redefinir -- email  # senha temporária para quem esqueceu (encerra as sessões)
npm run conta:criar -- email "Nome"  # conta nova com senha temporária (cadastro fechado em produção)
```

**Deploy**: VPS com Docker Compose (`docker-compose.prod.yml`: Postgres + API + Caddy com HTTPS
servindo o front e repassando `/api`). Push na `main` roda os testes e, se passarem, publica sozinho
(`.github/workflows/ci.yml` → `deploy/atualizar.sh`). Passo a passo, atualização e backups em `docs/deploy.md`;
modelo do `.env` de produção em `.env.producao.example`.

Não há build nem lint configurados. Os testes usam o banco de `DATABASE_URL_TEST`, que é
**apagado e recriado** a cada arquivo (`prepararBanco`); o nome dele precisa conter `test` e ser
diferente de `DATABASE_URL`. Todo arquivo de teste começa com `require('./setup')`.

## Arquitetura

**Módulos** em `src/modules/<recurso>/` com `routes.js` → `controller.js` → `service.js`, mais
`schema.js` (Zod) e `docs.js` (OpenAPI). Ao criar um módulo:
- montar em `src/app.js` como `app.use('/<recurso>', autenticar, rotas<Recurso>())`;
- registrar o `docs.js` na lista `modulos` de `src/docs/openapi.js`. O OpenAPI é gerado dos
  mesmos esquemas Zod da validação (`src/docs/helpers.js`), então não escreva JSON Schema à mão.

**Multiusuário**: `autenticar` coloca o usuário em `req.usuario`. Todo service filtra por
`usuario_id`; recurso de outro usuário responde `404` (`naoEncontrado()`), nunca `403`. Tabelas
filhas não têm `usuario_id`: o dono vem da tabela pai via join.

**Validação**: `validar({ body, query, params })` guarda os valores convertidos em
`req.validado` (no Express 5 `req.query` é somente leitura); controllers leem de lá. Importe o Zod
de `src/lib/zod.js` (mensagens em pt-BR), não de `'zod'`.

**Erros**: lance `AppError(status, codigo, mensagem)` ou os atalhos de `src/lib/erros.js`. O
Express 5 repassa exceções de handlers async, então não use try/catch + `next(erro)`.
`middlewares/erro.js` converte `ZodError` e códigos do Postgres (23505 → `409 CONFLITO`,
23503 → `409 REFERENCIA_INVALIDA`, 23514 → `400 VALIDACAO`) no formato
`{ erro: { codigo, mensagem } }`. Prefira `CHECK`/FK no banco a validações duplicadas no service.

**camelCase ↔ snake_case é automático** (`src/config/database.js`): `wrapIdentifier` converte
identificadores e `postProcessResponse` converte os resultados, inclusive de `knex.raw()`.
No JS escreva sempre camelCase (`where({ usuarioId })`, `.returning(['criadoEm'])`); só as
migrations e o SQL dentro de `raw` usam snake_case.

**Datas e fuso** (`America/Sao_Paulo`): a sessão do Postgres é criada nesse fuso e
`src/config/pg-tipos.js` faz o driver devolver `date` como `"2026-10-13"`, `time` como `"08:00"`
e `timestamptz` como ISO com offset sem milissegundos. Nunca passe datas sem hora por `new Date`;
use os helpers de `src/lib/tempo.js` (Luxon). `bigint`/`numeric` voltam como `Number`. Dinheiro é
sempre inteiro em centavos.

**Migrations** (`db/migrations/`) usam os helpers de `db/helpers.js`: `criarTabela` (id uuid,
`criado_em`/`atualizado_em` e trigger), `donoUsuario`, `checkIn` para "enums" (`text` + `CHECK`
chamado `<tabela>_<coluna>_check`). Migrations são histórico imutável: para mudar valores de um
enum, crie uma nova migration que troca o CHECK. Índices de tabelas raiz começam por
`usuario_id`. Categorias de pagamento são de cada usuário; as 7 padrão (com "Outros") são criadas no cadastro
(`src/modules/categorias/padrao.js`).

**Rate limit** (`middlewares/limitar.js`): os limitadores guardam o contador em memória e são
fábricas, chamadas ao montar as rotas (cada app de teste tem contadores novos).

## Próximas etapas

Prontos: `/auth`, `/imoveis`, `/categorias-pagamento` (de cada usuário), `/pagamentos`, `/relatorios/gastos`,
`/eventos`, `/medicamentos`, `/rotinas`, `/hoje` (agrega os services dos outros módulos),
`/cartoes` (faturas viram contas em `pagamento`; regras em `src/lib/fatura.js`, decisão 19 de
`docs/arquitetura.md`), `/equipe` (os dias de pagamento viram contas em `pagamento`, criadas por
`garantirContas` ao listar; conta da equipe pode ter valor nulo = a definir; decisão 23), `/viagens` (anexos via `middlewares/upload.js` + `lib/armazenamento.js`; os testes gravam numa pasta
temporária definida em `test/setup.js`), `/compras`, `/notificacoes` e os lembretes
(`src/lembretes/`). Rotas fixas (`/hoje`, `/registros`) vêm antes de `/:id` no router. Séries recorrentes são expandidas por `src/lib/recorrencia.js`. Campos compartilhados (id, data, centavos, texto opcional) ficam
em `src/lib/esquemas.js`; `test/helpers/sessao.js` cria um usuário com token para os testes.

**Lembretes** (seção "Lembretes" e decisão 17 de `docs/arquitetura.md`): sem `VAPID_*` no `.env`
ficam desligados (gere com `npx web-push generate-vapid-keys`). Origem nova com lembrete = um
gerador em `src/lembretes/geradores/` + valor no CHECK de `origem_tipo`, e o service dela cancela
os pendentes ao editar/excluir. Os testes recebem chaves VAPID de `test/setup.js`, chamam
`gerar`/`enviarPendentes` com um `agora` fixo e um canal falso, e simulam o push com
`t.mock.method(webpush, 'sendNotification')` — nenhum push sai de verdade.
