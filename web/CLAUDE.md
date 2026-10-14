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
  Lembretes: a API guarda minutos antes; "Na véspera às 18h" depende do horário e é convertido
  em `src/paginas/agenda/lembretes.ts`.
- **Remédios**: no PUT, mande o `id` dos horários que continuam — sem ele o back-end recria o
  horário e o histórico de "tomei" se perde (o formulário guarda o `id` em cada linha do
  `useFieldArray`). `diaSemana` 0 = domingo. "Tomei" é otimista (`useRegistrarDose`): muda a tela
  na hora e volta atrás se o servidor recusar.
- Após salvar, atualize a lista em cache com a resposta (além de invalidar), para a lista não
  mostrar o dado antigo por um instante ao voltar do formulário.
- **Formulários**: esquema Zod em `src/lib/esquemas/` espelhando o `schema.js` do módulo no
  back-end; campos com `components/Campo.tsx`; erro da API com `aplicarErroApi()`
  (`src/lib/formulario.ts`), que liga códigos a campos (ex.: `EMAIL_EM_USO → email`) e distribui
  o `VALIDACAO` ("campo: mensagem; ...") pelos campos. Mutations de formulário usam
  `meta: { semAviso: true }` para não duplicar o erro num toast.

## Estrutura

- `src/app/navegacao.ts` define as áreas; a barra inferior (celular) e a lateral (desktop) em
  `components/layout/LayoutApp.tsx` são geradas dela. No celular as áreas secundárias ficam em
  "Mais", que fica marcado quando uma delas está aberta.
- **Sessão** (`src/app/sessao.tsx`): `useSessao()` dá `token`, `usuario` (de `/auth/me`),
  `entrar(sessao)` e `sair()`. Ambos limpam o cache do TanStack Query (aparelho compartilhado).
  Token vencido é descartado ao abrir o app; `NAO_AUTORIZADO` da API chama `sair()`.
- Guardas em `src/app/guardas.tsx`: `RotaProtegida` manda para `/entrar` guardando a tela
  pedida em `state.de`; `RotaVisitante` (login/cadastro) é quem redireciona depois de entrar —
  não navegue manualmente no `onSuccess` do login, isso cria corrida com a guarda.
- Rotas em `src/app/rotas.tsx` (`definicaoRotas`, reaproveitado nos testes por
  `src/test/renderizarApp.tsx`, que monta o app inteiro com `createMemoryRouter`); cada tela usa `components/layout/Pagina.tsx` (título da aba +
  cabeçalho). Áreas ainda não feitas usam `paginas/EmBreve.tsx`.
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

Público com pouca intimidade com tecnologia, uso no celular com uma mão: base de 18px, fonte
Atkinson Hyperlegible Next, áreas de toque ≥ 44px, linguagem simples. Paleta "agenda de capa
dura" em `src/index.css`: papel `--papel`, tinta azul-petróleo `--primary`, açafrão `--hoje`
(só para marcar o dia/item ativo — a "fita" marcadora) e `--atraso` para vencidos.
