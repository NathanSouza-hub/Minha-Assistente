# Prompt — Front-end (PWA) do Minha Assistente

> Cole o bloco abaixo no Claude Code (ou Lovable) num repositório novo, ex.: `minha-assistente-pwa`.
> O contrato completo da API está em `docs/arquitetura.md` deste repositório (back-end).

---

Você vai construir o front-end do **Minha Assistente**, uma secretária pessoal **multiusuário**:
qualquer pessoa cria conta e organiza pagamentos, agenda, remédios, rotina, viagens e compras.
Cada usuário só vê os próprios dados. O back-end (Node + Express + PostgreSQL) é feito
separadamente e já tem contrato de API definido. Todo texto da interface em português do Brasil.

## Stack
- React + Vite + TypeScript
- PWA com `vite-plugin-pwa` (instalável no iPhone, Android e computador; funciona como app)
- React Router, TanStack Query (cache e estados de carregamento), React Hook Form + Zod
- Tailwind + shadcn/ui
- Luxon ou date-fns-tz para datas (fuso `America/Sao_Paulo`)
- Variável `VITE_API_URL` (dev: `http://localhost:3000`)

## Público e experiência
- Uso principal no **celular**, com uma mão. Também precisa ficar bom no computador.
- Pessoas sem intimidade com tecnologia: textos grandes, botões com área de toque de 44px,
  poucos passos, linguagem simples, nada de jargão.
- Navegação inferior no celular (Hoje, Agenda, Pagamentos, Remédios, Mais) e lateral no desktop.

## Contrato da API (seguir exatamente)
- JSON em **camelCase**.
- Datas sem hora: `"2026-10-13"` (NUNCA passar por `new Date("2026-10-13")`: interpreta como
  UTC e mostra o dia anterior no Brasil; use `DateTime.fromISO` / `parseISO`).
- Data e hora: `"2026-10-13T14:00:00-03:00"`. Hora do dia: `"08:00"`.
- **Dinheiro em centavos inteiros**: `15990` = R$ 159,90. Formate com
  `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` e converta o que o usuário
  digita para centavos antes de enviar.
- Erros: `{ "erro": { "codigo": "STRING", "mensagem": "texto" } }`. Mostre `mensagem` num toast;
  use `codigo` para decidir comportamento (ex.: `NAO_AUTORIZADO` → logout e ir ao login;
  `VALIDACAO` → mostrar no formulário).
- Autenticação: `Authorization: Bearer <token>` em todas as rotas, exceto cadastro e login.
- Listagens devolvem **array direto** (sem paginação).

## Rotas
```
POST /auth/cadastro  { nome, email, senha }  → { token, usuario }
POST /auth/login     { email, senha }        → { token, usuario }
GET  /auth/me                                 → usuario
GET  /hoje                                    → painel do dia (ver abaixo)
GET/POST /pagamentos (filtros: inicio, fim, status, categoriaId, imovelId)
GET/PUT/DELETE /pagamentos/:id | PATCH /pagamentos/:id/pagar
GET/POST /imoveis | PUT/DELETE /imoveis/:id | GET /categorias-pagamento
GET /relatorios/gastos?inicio=&fim=&agruparPor=imovel|categoria
GET/POST /eventos (filtros: inicio, fim, tipo) | GET/PUT/DELETE /eventos/:id
GET/POST /rotinas | PUT/DELETE /rotinas/:id | GET /rotinas/hoje | POST /rotinas/:id/concluir
GET/POST /medicamentos | GET/PUT/DELETE /medicamentos/:id | GET /medicamentos/hoje
POST /medicamentos/registros
GET/POST /viagens | GET/PUT/DELETE /viagens/:id
POST /viagens/:id/anexos (multipart, campo "arquivo", até 10 MB, PDF/imagem)
GET/DELETE /viagens/:id/anexos/:anexoId
GET/POST /compras | PUT/DELETE /compras/:id | PATCH /compras/:id/comprado
POST/DELETE /notificacoes/inscricoes (Web Push)
```
Os exemplos exatos de request/response de cada rota ficam no Swagger do back-end em `/docs`
(liberado módulo a módulo). Até lá, use os campos abaixo e **mocke a API com MSW**, para trocar
pelo back-end real sem mexer nas telas.

## Telas e regras

**1. Cadastro e login**
- Cadastro: nome, e-mail, senha (mín. 8). Login: e-mail e senha. Após sucesso, guardar o token e
  ir para "Hoje". Logout no menu. Rotas internas protegidas.

**2. Hoje (tela inicial)** — `GET /hoje`
- Eventos do dia, remédios do dia com status (tomado/pendente) e botão "Tomei",
  tarefas da rotina com check, pagamentos vencidos e que vencem nos próximos 7 dias.
- Vencidos em destaque vermelho. Tudo marcável sem sair da tela.

**3. Pagamentos**
- Lista por mês com filtros (status, categoria, imóvel). Campos: descrição, categoria,
  imóvel (opcional), valor, vencimento, status, data de pagamento, recorrência
  (nenhuma/mensal/anual), observações.
- Parcelamento: no cadastro, opção "parcelado em N vezes" → envia
  `"parcelamento": { "totalParcelas": N }`; a resposta é um **array** com as N parcelas.
  Mostrar "3/10" nas parcelas.
- Botão "Marcar como pago" (`PATCH /pagar`). Pagamento recorrente: ao pagar, o back-end cria o
  próximo automaticamente — recarregar a lista.
- Categorias fixas: Salários, Honorários médicos, Consultas, Exames, Parcelamentos,
  Contas residenciais.

**4. Imóveis** (em "Mais" ou Configurações)
- CRUD simples (ex.: "Apartamento cobertura", "Casa da Serra"). Excluir imóvel com pagamentos
  retorna `409 REFERENCIA_INVALIDA`: avisar que há pagamentos ligados.

**5. Relatório de gastos**
- Período + agrupar por imóvel ou categoria. Mostrar total pago, total previsto e lista/gráfico
  de barras por grupo (`itens: [{ id, nome, pagoCentavos, previstoCentavos }]`).

**6. Agenda**
- Visão de dia/semana/lista. Campos: título, tipo (reunião pessoal, exame, consulta, vídeo,
  programa de rádio, fisioterapia, atividade física), modalidade (presencial, telemedicina,
  videoconferência, podcast, gravação), início, fim, local, link, observações, recorrência
  (nenhuma/diária/semanal/mensal/anual) e lembretes.
- Lembretes: lista de minutos antes, `lembretesMinutosAntes: [1080, 120]`. Ofereça atalhos
  ("Na véspera às 18h", "2h antes", "30 min antes") — até 5.
- Evento recorrente vem expandido com `recorrente: true` e o `id` da série: editar/excluir
  afeta **a série inteira** (avisar antes de confirmar).
- Link de telemedicina/videoconferência com botão "Entrar".

**7. Remédios**
- Campos: nome, dose, observações, horários (manhã/tarde/noite/semanal, com hora e dia da
  semana no semanal). Tela "Hoje" dos remédios com botão "Tomei" (`POST /medicamentos/registros`).

**8. Rotina**
- Tarefas recorrentes (ex.: ler e-mails, ler WhatsApp, enviar mensagens), dias da semana, hora
  opcional. Check diário (`POST /rotinas/:id/concluir`).

**9. Viagens**
- Destino, ida, volta, hospedagem, transporte, observações e anexos (upload de PDF/foto da
  passagem, voucher do hotel). Baixar e excluir anexo.

**10. Compras**
- Lista com nome, categoria, quantidade; marcar comprado; itens comprados vão para o fim.

**11. Notificações (Web Push)**
- Pedir permissão em momento oportuno (ao criar o primeiro lembrete), nunca na abertura do app.
- Registrar a inscrição em `POST /notificacoes/inscricoes` com `{ endpoint, keys: { p256dh, auth } }`.
- **iPhone:** push só funciona com o app **instalado na tela inicial** (iOS 16.4+). Mostrar um
  passo a passo "Compartilhar → Adicionar à Tela de Início" quando estiver no Safari.

## Qualidade
- Estados de carregamento (skeleton), vazio ("Nenhum pagamento este mês — adicionar") e erro.
- Formulários validados no front com as mesmas regras do back.
- Confirmação antes de excluir. Desfazer quando possível.
- Acessível: contraste AA, labels nos campos, navegação por teclado no desktop.
- Testes das regras críticas: conversão reais↔centavos, datas sem deslocamento de dia,
  expiração de token.

## Entregas (nesta ordem)
1. Setup do projeto, PWA instalável, layout com navegação, cliente da API + MSW.
2. Cadastro, login e rotas protegidas.
3. Pagamentos + imóveis + relatório.
4. Agenda. 5. Remédios. 6. Rotina. 7. Tela Hoje. 8. Viagens. 9. Compras. 10. Notificações.
Pare ao fim de cada entrega para revisão.
