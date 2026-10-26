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
  A tela (decisão 34) tem as abas Mês (calendário de 6 semanas, segunda a domingo, com pontos na cor
  de cada agendamento e das viagens de `useViagens`; o dia escolhido fica em `?data=` e aparece ao lado
  ou embaixo), Semana e Próximos (`?visao=`). O mês busca as 6 semanas e filtra cada dia com
  `eventosDoDia` (`porDia.ts`, fim exclusivo como na API). Cadastro só pelo "+ Novo"
  (`NovoNaAgenda.tsx`, 7 opções; Viagens vai para `/viagens/nova`). Cada item (`ItemEvento`) tem o ponto na cor da área
  do tipo (rádio, atividade física, fisioterapia; o resto na cor da Agenda), como as linhas do Início.
  Em cima das abas, os atalhos "Agenda por tipo" (Consultas, Exames, Fisioterapia, Atividade física,
  Programa de rádio, Viagens; um `nav`, que os testes ignoram ao procurar links da lista). No
  calendário, hoje tem o anel âmbar e o dia aberto fica em grafite; na lista de hoje (Mês e Semana),
  `ListaEventos comAgora` põe a linha âmbar "Agora" entre o que já começou e o que vem.
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
- **Formulário por tipo** (decisões 30 e 34): `paginas/agenda/perfis.ts` dá a cada opção do "+" (pelo
  `?tipo=` ou pelo tipo salvo) o título da tela, os rótulos e os campos (ex.: rádio = "Nome do programa"
  e "Emissora" em `local`; exame = "Tipo de exame" e "Orientações"). Só "Compromissos e eventos" tem o
  campo "Tipo" (`TIPOS_DE_COMPROMISSO`). Na consulta e na fisioterapia o título é opcional e, em branco,
  vira `tituloPadrao()` ("Consulta de Cardiologia com Dra. Lima"). "Outro tipo" mostra "Descreva o
  compromisso" (obrigatório no front, na API e no banco) e `nomeDoTipo()` exibe essa descrição no lugar
  do tipo. Videoconferência mostra o link sem escolher modalidade.
- **Compromissos = "Novo lembrete"** (decisão 32): `QuantasVezes` (em `paginas/rotina/PaginaRotina.tsx`) troca
  entre `/tarefas/nova` (só uma vez) e `/rotina/nova` (repete) levando o título; a edição da rotina
  mostra o histórico (`useHistoricoRotina`) e tem observações. As sugestões aparecem nas duas listas.
- **Rotina/Compromissos**: não existe `GET /rotinas/:id`; a tela de edição pega a tarefa da lista
  (`useRotinas`). As sugestões (`paginas/rotina/sugestoes.ts`) abrem `/rotina/nova?titulo=...`.
- **Áreas por tipo**: Programa de rádio (`/radio`, fora do menu desde a decisão 34), Atividade física e Fisioterapia são a agenda só
  daquele tipo (`AgendaDoTipo`, `AREAS_DO_TIPO` em `paginas/agenda/textos.ts`). O formulário aceita
  `?tipo=` e `?voltar=<rota da área>`. A modalidade oferecida depende do tipo (`MODALIDADES_DO_TIPO`).
- **Finanças → Visão geral** (`/financas`, primeira aba de `paginas/Relatorio.tsx`; o conteúdo é `VisaoGeral`
  em `paginas/inicio/PainelFinanceiro.tsx`, com `?mes=`; decisão 36): o painel do mês: "Pede atenção" (vencidas, recebíveis atrasados, contas a definir), `BlocoFinancas`
  (saldo num bloco grafite, Despesas e Recebíveis com o critério de cada número; os que têm lista com o
  mesmo critério levam a ela no mesmo mês), os gráficos e Por residência. Os totais vêm de
  `GET /relatorios/financeiro` (decisão 25; um por mês nos gráficos, com a mesma chave de
  `useRelatorioFinanceiro`) e `/relatorios/gastos` — nunca some valores no front além de pôr meses lado
  a lado. Gráficos em `paginas/financas/graficos.tsx` (SVG à mão, sem biblioteca; cores validadas):
  A Entradas e saídas (recebido × pago no mês, até o mês atual), C Resultado mês a mês (realizado até o
  mês atual, projetado do mês atual em diante; não é saldo bancário) e B Despesas por categoria (barras
  ordenadas, valor e %, sobre o total da API; acima de 8 categorias, "Ver todas"). Todo gráfico tem
  legenda (≥ 2 séries), tooltip e "Ver os números" (tabela). Mês sem nada recebido nem pago aparece
  como "sem movimento" (traço no eixo, na dica e na tabela), com os R$ 0,00 reais: nunca preencha
  mês vazio com valor. O mês atual leva "(até hoje)" nas tabelas.
  O detalhe de cada área continua nas telas dela (`ProximasContas`, `ProximosRecebiveis`, Residências,
  `ResumoPessoais`, explicados abaixo).
- **Abas internas** (decisão 33): `components/Abas.tsx` (Tabs do Radix, aba em `?vista=`, a primeira
  é a padrão e não vai para a URL; `contador` opcional). Usadas em Despesas pessoais, detalhe do
  imóvel, Equipe, Recebíveis, Finanças (Visão geral e as partes do relatório, `?vista=`). O conteúdo de aba fechada não é montado: nos testes,
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
- **Relatório** (decisão 36: não é mais tela nem item do menu; `/relatorio` redireciona para
  `/financas?vista=balanco`): são as abas Balanço (comparação com o período anterior — `trechosComparaveis` de
  `lib/datas.ts`: período que ainda não terminou compara do início até hoje com o mesmo trecho do
  anterior, nunca o mês pela metade com o mês inteiro; só o realizado, buscado só nessa aba —, entradas, saídas e saldo), Recebíveis e pessoais (de `GET /relatorios/financeiro`) e Por imóvel ou categoria
  (`/relatorios/gastos`, com o "Separar por") de Finanças, depois da Visão geral. O período aparece
  em cada uma dessas três (estado único da página) e o relatório só é buscado nelas. "Gerar PDF" (só nessas abas) usa `lib/relatorioPdf.ts` (jsPDF +
  autotable, importados só ao gerar) com os dados já carregados do período — nunca recalcule; o
  botão espera os dados do período escolhido (`isPlaceholderData`).
- **Recebíveis** (`/recebiveis`, `/recebiveis/novo`, `/recebiveis/:id`; `paginas/recebiveis/`, decisão 26):
  valores a receber do mês (pela data prevista): previsto/recebido/a receber em cima e as abas Do mês,
  A receber (status ≠ recebido, inclui parcial), Recebidos e Resumo (por origem e próximos 30 dias);
  "Novo recebível" no cabeçalho. Origem "Outros" mostra "Especifique a origem" logo abaixo (obrigatório
  só nela; trocar de origem apaga o texto) e `nomeDaOrigem()` (`formulario.ts`) exibe "Outros · <descrição>"
  (decisão 35). Status, saldo e atrasado vêm da API, derivados do
  histórico de recebimentos — não recalcule. No detalhe: situação, "Registrar recebimento" (o valor
  já vem com o que falta; abaixo do saldo aparece "Foi o valor final", que manda `encerrar`),
  histórico com "Desfazer" e comprovantes (`ListaArquivos`). Toda mutação invalida `recebiveis` e os
  relatórios (entradas e saldo do painel). Mock em `mocks/recebiveis.ts` (o relatório do mock usa o
  `entradasDoPeriodo` dele).
- **Início = atividades do dia** (`/`, `paginas/Hoje.tsx`; atrasadas numa seção em cima, "Nova" escolhe o módulo em `hoje/NovaAtividade.tsx`; `GET /hoje?data=`, `PATCH /hoje/:id`, decisão 24 de
  `../docs/arquitetura.md`; `consultas/hoje.ts`, `paginas/Hoje.tsx`, `paginas/hoje/LinhaTarefa.tsx`):
  saudação, a frase da assistente (`FraseDoDia`, só com os dados do dia) e a barra de progresso no
  cabeçalho; o resumo das áreas (`hoje/ResumoDasAreas.tsx`: doses, próximo da agenda, lembretes, tirados
  da mesma lista) e o **Verso do dia** (`hoje/VersoDoDia.tsx`, versos de domínio público em
  `lib/versos.ts` — nunca escreva verso de memória; para incluir, copie da bible-api.com `almeida`); o bloco "Agora" (a atividade com horário que começou há
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
  sai do cache, a tela desmonta e o `onSuccess` do `mutate` não roda. Desenho: o contador "X de Y
  itens comprados" no cabeçalho, o anotar rápido numa pílula (nome + "+"; quantidade e categoria
  embaixo no celular, tudo numa linha no computador), "A comprar" com cada categoria no seu bloco e
  "Já comprados" mais apagado embaixo.
- **O que foi feito** (`/produtividade`, item do menu de Lembretes; `paginas/produtividade/`): totais e
  colunas de `GET /relatorios/produtividade` (decisão 37), 7 dias / 30 dias / 12 semanas (`?periodo=`;
  12 semanas começam numa segunda e usam `semanas` da API). Só o que foi concluído: nunca mostre
  pendente nem taxa. Só o que muda a contagem invalida `chavesProdutividade` (`invalidarProdutividade`:
  concluir/reabrir/excluir tarefa, concluir e excluir compromisso; a marcação pelo Início recarrega
  tudo). Rótulos e agrupamento seguem o período dos **dados** (durante a troca, o anterior fica com os
  rótulos dele). Peças comuns dos gráficos: `components/grafico/pecas.tsx` (Legenda, TabelaDoGrafico,
  Dica, Coluna) e `lib/grafico.ts` (`escala`, `escalaInteira`, `useLargura`). Tocar numa coluna só
  destaca (não alterna: o toque dispara `mouseenter` e `click` juntos).
- **WhatsApp** (`/whatsapp`, item de Configurações, `paginas/Whatsapp.tsx`, decisão 38): passo a passo,
  "Gerar código" (mostra o código, "Abrir o WhatsApp" = link `wa.me` e relê `GET /whatsapp` a cada 3 s
  até o número aparecer ligado), ligado (número mascarado, "Trocar de número", "Desligar" com
  confirmação) e "Ainda não disponível" sem as chaves no servidor. No mock não há webhook: os testes
  ligam o número com `vincularNoMock` (`mocks/whatsapp.ts`).
- **Relógio** (`lib/relogio.ts`, `useMinutoAtual`): "HH:mm" que avança na virada do minuto (um timer
  só, nada com a aba escondida, limpo ao desmontar). A linha "Agora" da Agenda usa.
- **Lembretes** (`/tarefas` e `/rotina`): anotar rápido no mesmo molde da Compras (rótulo oculto
  "Nova tarefa para hoje", botão "Anotar"); a hora (e o sino do lembrete) fica à direita, na linha do
  título. Atrasadas num bloco tingido de vermelho com "Era para …"; Próximas separadas por dia
  (`rotuloDoDia`). A API não tem prioridade: a ordem pelo prazo faz esse papel (não invente campo).
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
  com os selects e "Nova categoria"; recolhido mostra o que está escolhido), `ResumoContas`, as
  contas por urgência (`ContasPorUrgencia`: Vencidas, Vencem hoje, Próximas, Pagas, cada linha um
  `ItemPagamento` com o círculo de pagar; a conta aberta volta para o grupo) e, no fim, `ProximasContas`.
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
  (filtrados de `/pagamentos` por `membroId`) e Integrantes (cartões; "Adicionar pessoa" no cabeçalho; o
  formulário da pessoa volta para `&vista=integrantes`) (`/equipe/novo`, `/equipe/:id`, com
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
  Finanças (`/financas` e as telas de dinheiro; sem item Relatório, que virou aba da Visão geral), Agenda
  (só "Agendamentos"; viagens, rádio, consultas, exames, fisioterapia e atividade física pelo "+ Novo"
  e no calendário — as rotas continuam e pertencem à Agenda), Medicamentos (`/remedios`, tela única:
  anel das doses, doses por período e "Últimos 7 dias"), Lembretes (rota `/rotina`: lembretes que
  repetem, de uma vez, compras) e Configurações. Cada seção tem `itens` (o menu interno; `rota` pode ter
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

Público com pouca intimidade com tecnologia, uso no celular com uma mão: base de 17px, títulos em
Bricolage Grotesque (`h1`, `h2`, `.font-heading`) e texto em Figtree, áreas de toque ≥ 44px,
linguagem simples. A identidade ("Vivo suave": paleta, estados, cor por área, gráficos, marca) está em
`../docs/identidade-visual.md`; os tokens em `src/index.css`. Na prática:
- Cores: fundo quente `bg-papel`, superfícies `bg-folha` (listas em `.superficie` + `divide-y`),
  texto e ação em grafite (`--primary`), `bg-noite` só no bloco "Agora", `bg-ambar` com texto grafite
  no botão do "Agora", na área ativa da barra e no "Vence hoje", `--atraso` para vencidos, `--ok` para
  feito/pago. Blocos de resumo de área com `area-<nome>` + `bg-area-fundo`/`text-area`. Sem gradiente.
- **Estados**: `MarcaEstado` e `SeloEstado` de `components/Estado.tsx`. Cor sempre com ícone ou texto.
- **Cabeçalho** (`Pagina`): título grande e a ação de criar à direita (`variant="secondary"`). No
  celular, as telas da área viram pílulas. Barra de baixo: pílula grafite flutuante (área atual em
  âmbar com o nome; as outras só ícone, com o nome em `sr-only`). Lateral em `--suave`, ativo grafite.
- **Cor por área**: `areaDaRota()` em `app/navegacao.ts`; `Pagina` põe `area-<nome>`. Rota nova fora
  do menu: incluir em `outrasRotas`.
- Ícones: Phosphor (`@phosphor-icons/react`, sufixo `Icon`; `weight="fill"` no ativo). Botão
  `variant="confirmar"` = verde ("Pagar", "Recebi"). Botões são `rounded-full`.
