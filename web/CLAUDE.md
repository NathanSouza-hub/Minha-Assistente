# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

PWA do **Minha Assistente** (React 19 + Vite 8 + TypeScript, Tailwind 4 + shadcn/ui, React
Router 8, TanStack Query 5, React Hook Form + Zod 4, Luxon, MSW 3). Código, nomes e textos da
interface em **português do Brasil**. Fica em `web/` do mesmo repositório do back-end (raiz);
o contrato da API está em `../docs/arquitetura.md` e o escopo/ordem das entregas em
`../docs/prompt-front.md` (pare ao fim de cada entrega para revisão). Rode os comandos abaixo
dentro de `web/`.

## Comandos

```bash
npm run dev                                   # VITE_API_MOCK=true no .env.local liga o MSW
npm test                                      # vitest run
npx vitest run src/lib/datas.test.ts          # um arquivo
npx vitest run -t "não desloca o dia"         # um teste pelo nome
npm run build                                 # tsc -b + vite build (gera sw.js)
npm run lint                                  # oxlint
```

## Regras do contrato (já encapsuladas — use as funções, não reimplemente)

- **Dinheiro em centavos inteiros**: `src/lib/dinheiro.ts` (`formatarCentavos`, `paraCentavos`).
- **Datas**: nunca `new Date("2026-10-13")` (vira o dia anterior no Brasil). Use
  `src/lib/datas.ts` (Luxon, fuso `America/Sao_Paulo`). Os testes rodam com
  `TZ=America/Sao_Paulo` (`src/test/setup.ts`) justamente para pegar esse erro.
- **Chamadas à API**: sempre via `api()` de `src/lib/api.ts`. Ela põe o Bearer token, ignora
  filtros vazios na query, manda `FormData` como multipart e converte
  `{ erro: { codigo, mensagem } }` em `ApiError`. `NAO_AUTORIZADO` dispara o callback de
  `definirAoPerderSessao` (logout).
- **Erros na tela**: `src/app/consultas.ts` mostra toast com a `mensagem` de qualquer erro de
  query/mutation, exceto `NAO_AUTORIZADO` (logout) e `VALIDACAO` (exibir no formulário).
- Tipos do contrato em `src/lib/tipos.ts`.
- **Agenda**: `inicio`/`fim` sempre com fuso (`combinarDataHora`/`separarDataHora` de
  `src/lib/datas.ts`). A listagem devolve cada ocorrência de série separada (mesmo `id`); para
  editar, abra `GET /eventos/:id` (a série) — o PUT precisa do início da série, não da ocorrência.
  A visão Dia busca a semana inteira (a faixa de dias marca os que têm agendamento) e filtra com
  `eventosDoDia` (`porDia.ts`, fim exclusivo como na API). Cada item tem a fita na cor da área do
  tipo (rádio, atividade física, fisioterapia; o resto na cor da Agenda).
  Lembretes: a API guarda minutos antes; "Na véspera às 18h" depende do horário e é convertido
  em `src/paginas/agenda/lembretes.ts`.
- **Remédios** (decisão 31): período de uso (`dataInicio`/`dataFim`) e "Tomar a cada" — `montarHorarios`
  (`paginas/remedios/formulario.ts`) só roda no toque em "Montar horários", reaproveitando os `id` na
  ordem; nunca mude horários sozinho. A dose tem `situacao` (Tomei / Não tomei / Desfazer, otimista).
  Consulta, exame e fisioterapia mostram Profissional e Especialidade (`TIPOS_SAUDE` em `agenda/textos.ts`).
  No PUT, mande o `id` dos horários que continuam — sem ele o back-end recria o
  horário e o histórico de "tomei" se perde (o formulário guarda o `id` em cada linha do
  `useFieldArray`). `diaSemana` 0 = domingo. "Tomei" é otimista (`useRegistrarDose`): muda a tela
  na hora e volta atrás se o servidor recusar.
- **Vocabulário de quem usa o app**: itens da Agenda são "agendamentos" ("Novo agendamento",
  "Agendar") e a Rotina aparece como **"Compromissos"** (rota `/rotina`, API `/rotinas`, código
  continua `rotina`). Não use "compromisso" para evento da agenda.
- **Tipos de agendamento** (decisão 30): o campo "Tipo" usa `TIPOS_DO_FORMULARIO` (`textos.ts`);
  "Outro tipo" mostra "Descreva o compromisso" (obrigatório no front, na API e no banco) e
  `nomeDoTipo()` exibe essa descrição no lugar do tipo. "Viagem" no campo navega para
  `/viagens/nova`. Videoconferência mostra o link sem escolher modalidade.
- **Compromissos = "Novo lembrete"** (decisão 32): `QuantasVezes` (em `paginas/rotina/PaginaRotina.tsx`) troca
  entre `/tarefas/nova` (só uma vez) e `/rotina/nova` (repete) levando o título; a edição da rotina
  mostra o histórico (`useHistoricoRotina`) e tem observações. As sugestões aparecem nas duas listas.
- **Rotina/Compromissos**: não existe `GET /rotinas/:id`; a tela de edição pega a tarefa da lista
  (`useRotinas`). As sugestões (`paginas/rotina/sugestoes.ts`) abrem `/rotina/nova?titulo=...`.
- **Áreas por tipo**: Programa de rádio (`/radio`), Atividade física e Fisioterapia são a agenda só
  daquele tipo (`AgendaDoTipo`, `AREAS_DO_TIPO` em `paginas/agenda/textos.ts`). O formulário aceita
  `?tipo=` e `?voltar=<rota da área>`. A modalidade oferecida depende do tipo (`MODALIDADES_DO_TIPO`).
- **Finanças → Visão geral** (`/financas`, `paginas/inicio/PainelFinanceiro.tsx`, com `?mes=`): só os
  indicadores do mês (`BlocoFinancas`: despesas, recebíveis e saldo). Os totais vêm de
  `GET /relatorios/financeiro` (decisão 25): nunca some valores no front. Cada número diz o critério
  ("Contas que vencem em outubro", "Pela data do pagamento") e, quando a lista tem o mesmo critério,
  o cartão leva a ela no mesmo mês (despesas → `/despesas?mes=&status=`, recebíveis →
  `/recebiveis?mes=`); "Pago/Recebido no mês" e os saldos não levam a lugar nenhum. O detalhe fica na
  tela de cada área, em blocos de `components/Bloco.tsx` (carregando/erro/conteúdo, link opcional):
  `ProximasContas` (pendentes até +30 dias) no topo de Contas a pagar, `ProximosRecebiveis` e o
  previsto por origem em Recebíveis, o valor do mês em cada imóvel de Residências (`?mes=`) e
  `ResumoPessoais` (por categoria) na Lista de despesas com `?imovel=pessoal` (vira `destino=pessoal`
  e o título "Despesas pessoais", em abas Despesas do mês / A pagar / Por categoria e sem o filtro de
  imóvel). Não volte a pôr esses detalhes na Visão geral.
- **Abas internas** (decisão 33): `components/Abas.tsx` (Tabs do Radix, aba em `?vista=`, a primeira
  é a padrão e não vai para a URL; `contador` opcional). Usadas em Despesas pessoais, detalhe do
  imóvel, Equipe, Recebíveis e Relatório. O conteúdo de aba fechada não é montado: nos testes,
  clique na aba (`getByRole('tab')`) ou abra com `?vista=`.
- **Ocultos do menu** (decisão 33): `CARTOES_VISIVEIS` e `CATEGORIAS_VISIVEIS` em `app/navegacao.ts`
  tiram Cartões e Categorias do menu e do "Grupo de contas"; rotas, telas e dados continuam (para
  reativar, `true`). A categoria nova se cria no cadastro com `paginas/categorias/CampoCategoria.tsx`
  ("+ Nova categoria…", usado na conta e na compra do cartão).
- **Tarefas avulsas** (`/tarefas`, `/tarefas/nova`, `/tarefas/:id`; `paginas/tarefas/`, decisão 28): lista
  "A fazer" (Atrasadas, Hoje, Próximas) e "Feitas", com o ✓ grande em cada linha e "Nova tarefa para
  hoje" em uma linha; o formulário completo tem dia, hora, lembrete (só liga com hora; depois de
  salvar chama `convidar()`) e detalhes. Na tela Hoje é a categoria `tarefa` (`LinhaTarefa`); o mock
  dela fica em `mocks/tarefas.ts` (`tarefasAvulsasDoDia`, usado por `mocks/hoje.ts`).
- **Residências** (`/imoveis/:id`, `paginas/imoveis/DetalheImovel.tsx`, decisão 27): período (Este mês /
  6 meses / Este ano, em `?periodo=`) e as abas Resumo (total, por categoria e mês a mês lado a lado),
  Contas (`ItemPagamento`) e Dados do imóvel (nome, endereço, identificação). A lista `/imoveis`
  mostra um cartão por imóvel (valor do mês, situação, Renomear/Excluir) e o "Novo imóvel" no cabeçalho. Os números vêm de `GET /relatorios/imoveis/:id`. Cada
  imóvel da lista de Imóveis (com o valor do mês) leva para cá. Situação, barra de
  pago e pago/pendente ficam em `components/ResumoValores.tsx` (lista de Imóveis, detalhe e Pessoais usam os mesmos).
- **Relatório** (`/relatorio`): o período em cima e as abas Balanço (entradas, saídas e saldo),
  Recebíveis e pessoais (de `GET /relatorios/financeiro`) e Por imóvel ou categoria
  (`/relatorios/gastos`, com o "Separar por"). "Gerar PDF" usa `lib/relatorioPdf.ts` (jsPDF +
  autotable, importados só ao gerar) com os dados já carregados do período — nunca recalcule; o
  botão espera os dados do período escolhido (`isPlaceholderData`).
- **Recebíveis** (`/recebiveis`, `/recebiveis/novo`, `/recebiveis/:id`; `paginas/recebiveis/`, decisão 26):
  valores a receber do mês (pela data prevista): previsto/recebido/a receber em cima e as abas Do mês,
  A receber (status ≠ recebido, inclui parcial), Recebidos e Resumo (por origem e próximos 30 dias);
  "Novo recebível" no cabeçalho. Status, saldo e atrasado vêm da API, derivados do
  histórico de recebimentos — não recalcule. No detalhe: situação, "Registrar recebimento" (o valor
  já vem com o que falta; abaixo do saldo aparece "Foi o valor final", que manda `encerrar`),
  histórico com "Desfazer" e comprovantes (`ListaArquivos`). Toda mutação invalida `recebiveis` e os
  relatórios (entradas e saldo do painel). Mock em `mocks/recebiveis.ts` (o relatório do mock usa o
  `entradasDoPeriodo` dele).
- **Início = atividades do dia** (`/`, `paginas/Hoje.tsx`; atrasadas numa seção em cima, "Nova" escolhe o módulo em `hoje/NovaAtividade.tsx`; `GET /hoje?data=`, `PATCH /hoje/:id`, decisão 24 de
  `../docs/arquitetura.md`; `consultas/hoje.ts`, `paginas/Hoje.tsx`, `paginas/hoje/LinhaTarefa.tsx`):
  saudação e barra de progresso no cabeçalho; o bloco "Agora" (a atividade com horário que começou há
  menos de 1 h, senão a próxima: `destaqueDoDia` em `hoje/tarefas.ts`) com "Feito", "Não fiz" e o que
  vem depois; atrasadas numa seção em cima (sem a que está no "Agora") e a lista do dia. Cada linha tem
  o círculo de concluir e o ⋯ (folha com "Não fiz", "Voltar para pendente" e "Abrir"); os textos de
  cada categoria ficam em `CATEGORIAS` e a marcação em `useMarcar` (`hoje/tarefas.ts`). `useMarcarTarefa` é otimista (linha e resumo) e, ao terminar a
  última marcação, invalida tudo (o ✓ de remédio, compromisso e conta vale nas áreas). A data fica
  em `?data=`. Toda mutação de agendamento, remédio, compromisso, viagem ou conta chama
  `invalidarPainel`; ao criar uma área nova que apareça em Hoje, faça o mesmo (e inclua no
  `tarefas.js` do back e no `mocks/hoje.ts`).
- **Viagens**: anexos só existem numa viagem já salva — o cadastro leva para `/viagens/:id`, onde
  se anexa. Upload por `FormData` (`useEnviarAnexo`, um arquivo por vez; o limite de 10 MB é checado
  antes de enviar). Download por `baixarArquivo()` de `src/lib/api.ts` (um `<a href>` comum não
  manda o token) e entregue com `nomeOriginal`. Nos testes, `src/test/setup.ts` troca o `FormData`
  do jsdom pelo do Node (o `fetch` do Node não envia o do jsdom), os arquivos são `File` de
  `'node:buffer'` e o mock lê o multipart à mão (`request.formData()` falha nesse ambiente).
- **Arquivos** (anexos de viagem, comprovantes de conta): `components/ListaArquivos.tsx` (enviar
  vários, baixar, excluir; textos por `TextosArquivos`) e `lib/arquivos.ts` (limites, tipos,
  `salvarNoAparelho`). No mock, o upload é lido por `mocks/arquivos.ts`. Comprovantes só existem
  em conta já salva (`/pagamentos/:id#comprovantes` rola até a seção); a conta paga hoje sem
  comprovante mostra "Anexar comprovante" na lista.
- **Compras**: tudo numa tela (`/compras`); a edição (`/compras/:id`) pega o item da lista (não
  existe `GET /compras/:id`). A tela sempre ordena com `ordenarCompras` (`src/lib/compras.ts`), na mesma
  ordem do português que a API usa (collation ICU `pt-BR-x-icu` no back-end).
  Categorias são agrupadas sem diferenciar maiúsculas/acentos (`chaveCategoria`). Telas de edição
  que leem o item da lista (Rotina, Compras) navegam **antes** de a exclusão terminar: senão o item
  sai do cache, a tela desmonta e o `onSuccess` do `mutate` não roda.
- **Notificações (Web Push)**: tudo que fala com o navegador está em `src/lib/notificacoes.ts`
  (`lerEstado`, `ativar`, `desativar`); as telas usam `consultas/notificacoes.ts`. O push só existe
  na build (`npm run build && npx vite preview --port 5173`): em `npm run dev` não há o `sw.js` do
  app (o escopo é do worker do MSW) e o estado fica `indisponivel`. O `sw.js` do Workbox importa
  `public/sw-push.js` (eventos `push` e `notificationclick`). `ativar()` pede a permissão como
  primeira coisa, porque o Safari só pede dentro de um toque. Formulário que cria algo com
  lembrete chama `convidar()` de `useConvidarNotificacoes` depois de salvar (uma vez por aparelho,
  nunca ao abrir o app). Sair da conta desliga as notificações do aparelho. "O que avisar" liga/desliga cada categoria
  (`useAvisos`/`useSalvarAvisos`, otimista; decisão 29) — preferência da conta, não do aparelho. Nos testes,
  `src/test/pushFalso.ts` simula `Notification`, `PushManager` e o service worker.
- **Versão nova do app** (`registerType: 'prompt'` no `vite.config.ts`): o worker novo fica esperando
  e `components/AvisoAtualizacao.tsx` mostra "Nova versão do app disponível"; só o toque em
  "Atualizar" troca a versão e recarrega. Procura versão nova de hora em hora e ao voltar o app para
  a frente. Se há `<form>` com campo alterado (`lib/formularios.ts`, sem nada a fazer em cada tela),
  pergunta antes de recarregar. Não volte para `autoUpdate`: ele trocava o cache por baixo da tela
  aberta e o app antigo quebrava. Para testar: build + `npx vite preview`, abrir, gerar outro build.
- **Lista de despesas** (`/despesas`, "Despesas" na barra do celular, `paginas/pagamentos/ListaDespesas.tsx`):
  tudo do mês em tabela (`TabelaContas.tsx`: contas, faturas e equipe, com pagar/desfazer/editar/excluir
  na linha), com mês, status e filtros recolhidos de categoria (`?categoria=`) e imóvel. No celular a
  linha mostra só descrição, valor, vencimento e pagar (o resto a partir de `lg`). As contas abertas
  dela levam `?voltar=despesas` (`filtros.ts`) e o formulário volta para ela. Pagar e desfazer ficam em
  `marcarComoPago.ts` (também usado por `ItemPagamento`, no painel e na equipe).
- **Cadastro de despesas** (`/pagamentos`, "Contas a pagar" no menu): mesmo molde da Lista de
  despesas — mês, Todos/A pagar/Pagos, o painel recolhido "Grupo de contas e imóvel" (`PainelFiltros`,
  com os selects e "Nova categoria"; recolhido mostra o que está escolhido), `ResumoContas`, a
  `TabelaContas` com `voltar=""` (a conta aberta volta para o grupo) e, no fim, `ProximasContas`.
  O grupo é `?aba=` (categoria do usuário, `equipe` ou `cartoes`; sem aba ou aba apagada abre na
  primeira categoria — não há "Todas"); o imóvel é `?imovel=`. A conta nova vem com a categoria do
  grupo (e o imóvel, nas contas residenciais) e volta para ele. `paginas/categorias/FormCategoria.tsx`
  não é um `<form>` (também aparece dentro do formulário de conta): envia pelo botão ou Enter.
  A tela `/categorias` (renomear, subir/descer, excluir) existe, mas está fora do menu (decisão 33).
- **Cartões** (aba `?aba=cartoes&cartao=<id>&mes=AAAA-MM` de Contas, `paginas/cartoes/`): carrossel
  de cartões e a fatura do mês (sem `mes`, a fatura atual do cartão). A fatura é uma conta em
  `/pagamentos` mantida pelo back-end: na lista ela leva para a aba Cartões, não tem "Desfazer" nem
  edição (`PUT`/`DELETE` → `FATURA_AUTOMATICA`). Toda mutação de cartão ou compra invalida
  cartões, pagamentos, relatório e painel (`consultas/cartoes.ts`). As regras de competência e
  parcelas estão em `src/lib/fatura.ts` (cópia de `src/lib/fatura.js` do back-end, usada pelo mock
  e pelo resumo "10× de" do formulário).
- **Salários equipe** (aba `?aba=equipe` de Contas, `paginas/equipe/`): abas Pagamentos do mês
  (filtrados de `/pagamentos` por `membroId`) e Pessoas (cartões; "Adicionar pessoa" no cabeçalho; o
  formulário da pessoa volta para `&vista=pessoas`) (`/equipe/novo`, `/equipe/:id`, com
  os dias de pagamento num `useFieldArray`). As contas são criadas pelo back-end; a conta da equipe
  pode ter `valorCentavos: null` ("A definir"): some com `?? 0`, o item mostra "Pagar…" pedindo o
  valor (`usePagarPagamento` aceita `valorCentavos`) e `/pagamentos/:id` abre
  `FormularioContaEquipe` (valor, data, observações e a chave PIX). O mock cria as contas em
  `garantirContasEquipe` (`mocks/equipe.ts`), chamado ao salvar a pessoa e na "manutenção" do
  `resetarBancoMock` (`mocks/handlers.ts`), como o servidor; listar não grava.
- Após salvar, atualize a lista em cache com a resposta (além de invalidar), para a lista não
  mostrar o dado antigo por um instante ao voltar do formulário.
- **Formulários**: esquema Zod em `src/lib/esquemas/` espelhando o `schema.js` do módulo no
  back-end; campos com `components/Campo.tsx`; erro da API com `aplicarErroApi()`
  (`src/lib/formulario.ts`), que liga códigos a campos (ex.: `EMAIL_EM_USO → email`) e distribui
  o `VALIDACAO` ("campo: mensagem; ...") pelos campos. Mutations de formulário usam
  `meta: { semAviso: true }` para não duplicar o erro num toast.

## Estrutura

- **Navegação** (`src/app/navegacao.ts`, `SECOES`): 6 áreas — Início (`/`, só as atividades do dia),
  Finanças (`/financas` e as telas de dinheiro), Agenda (agendamentos, viagens, rádio), Saúde
  (remédios, consultas, exames, fisioterapia, atividade física), Compromissos (lembretes que repetem,
  lembretes do dia, compras) e Configurações. Cada seção tem `itens` (o menu interno; `rota` pode ter
  query, ex. `/pagamentos?aba=equipe`). `secaoDaTela()` diz a seção e o item da tela aberta: a barra
  de baixo (5 áreas; Configurações abre pela engrenagem do Início) e a lateral (que abre os itens da
  área) usam ela, e `Pagina` desenha sozinha no celular a fileira "Telas de <área>" nas telas de lista.
  Tela nova: incluir em `SECOES` (se for de menu) e em `AREAS_DAS_ROTAS` (cor). `/hoje` e `/mais` só
  redirecionam (`components/Redirecionar.tsx`) para `/` e `/configuracoes`.
- **Sessão** (`src/app/sessao.tsx`): `useSessao()` (em `src/app/useSessao.ts`) dá `token`, `usuario` (de `/auth/me`),
  `entrar(sessao)` e `sair()`. Ambos limpam o cache do TanStack Query (aparelho compartilhado).
  Token vencido é descartado ao abrir o app; `NAO_AUTORIZADO` da API chama `sair()`.
- Guardas em `src/app/guardas.tsx`: `RotaProtegida` manda para `/entrar` guardando a tela
  pedida em `state.de`; `RotaVisitante` (login/cadastro) é quem redireciona depois de entrar —
  não navegue manualmente no `onSuccess` do login, isso cria corrida com a guarda.
- Rotas em `src/app/rotas.tsx` (`definicaoRotas`, reaproveitado nos testes por
  `src/test/renderizarApp.tsx`, que monta o app inteiro com `createMemoryRouter`); cada tela usa `components/layout/Pagina.tsx` (título da aba +
  cabeçalho).
- Telas com formulário e as maiores entram com `lazy` em `rotas.tsx` (mantém o pacote principal
  abaixo de 500 kB); `hydrateFallbackElement` mostra `Carregando` enquanto baixam.
- **Dados** em `src/consultas/<area>.ts`: hooks do TanStack Query com as chaves em `chaves`.
  Mutations invalidam tudo que depende delas (pagamento → listas + relatório; imóvel → também
  pagamentos, que mostram o nome). Editar/excluir também atualizam as listas em cache na hora,
  para a lista não mostrar o dado antigo ao voltar do formulário.
- Filtros de lista (mês, status…) moram na URL (`useSearchParams`), não em estado.
- **MSW** (`src/mocks/`): `banco.ts` é o "banco" em memória com dados de exemplo da Maria
  (`maria@exemplo.com` / `uma-senha-forte`), relativos a hoje; um arquivo de handlers por área,
  reunidos em `handlers.ts`; `util.ts` tem `autenticado()` e `erro()`. Cada rota nova do back-end
  ganha um handler que segue o contrato e as regras do `service.js` dela à risca, para trocar
  pelo servidor real sem mexer nas telas.
- **Testes de tela**: `renderizarApp(rota)` monta o app inteiro com o MSW em `msw/node`;
  `entrarComoMaria()` salva a sessão antes. Telas com data fixam o relógio com
  `vi.useFakeTimers({ toFake: ['Date'] })` + `resetarBancoMock()` no `beforeEach` (só `Date`: o
  userEvent precisa de timers reais). `src/test/setup.ts` tem os substitutos de APIs do navegador
  que o Radix usa no jsdom.
- Componentes de formulário: `Campo` (com `prefixo`, ex. "R$"), `Selecao` (`<select>` nativo, de
  propósito), `Opcoes` (escolha única em cartões ou segmentos), `Confirmar` (antes de excluir;
  botão `variant="perigo"`).
- `src/components/ui/` é gerado pelo shadcn (`npx shadcn@latest add <comp>`); os tamanhos de
  botão/input foram aumentados (mín. 44px de toque) — ao adicionar componentes, mantenha isso.

## Design

Público com pouca intimidade com tecnologia, uso no celular com uma mão: base de 17px, fonte
Plus Jakarta Sans (400–700), áreas de toque ≥ 44px, linguagem simples. A identidade visual
(paleta, estados, cor por área, tipografia, marca) está em `../docs/identidade-visual.md`;
os tokens em `src/index.css`. Na prática:
- Cores: fundo `bg-papel`, superfícies brancas `bg-folha` (listas em `.superficie` + `divide-y`),
  texto `text-grafite`/`foreground`, azul `--primary` só para ação e "agora" (`bg-azul-fundo` no
  destaque claro), `bg-ambar` com texto grafite só no "Vence hoje", `text-alerta` para "Valor a
  definir", `--atraso` (vermelho) para vencidos, `--ok` (verde) para feito/pago. Sem gradiente.
- **Estados**: use `MarcaEstado` (círculo da linha) e `SeloEstado` de `components/Estado.tsx`; não
  monte a cor de estado à mão. Cor sempre com ícone ou texto junto.
- **Cabeçalho** (`Pagina`): leve, direto no fundo — rótulo da área pequeno na cor dela, título em
  grafite e a ação de criar à direita, sempre `variant="secondary"` ("+ Nova"). No celular, as telas
  da área viram abas de texto sublinhadas. Barra de baixo e lateral brancas, ativo em azul.
- **Cor por área**: `areaDaRota()` em `app/navegacao.ts` dá a área da tela; `Pagina` põe a classe
  `area-<nome>`, e quem está dentro usa `text-area`, `bg-area`, `bg-area-fundo` ou `.selo-area`
  (ícone num quadradinho na cor da área). Rota nova fora do menu: incluir em `outrasRotas`.
- Ícones: Phosphor (`@phosphor-icons/react`, nomes com sufixo `Icon`; `weight="fill"` no ativo).
  O Lucide sai aos poucos, tela a tela. Botão `variant="confirmar"` = verde ("Pagar", "Recebi").
