# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

PWA do **Minha Assistente** (React 19 + Vite 8 + TypeScript, Tailwind 4 + shadcn/ui, React
Router 8, TanStack Query 5, React Hook Form + Zod 4, Luxon, MSW 3). Código, nomes e textos da
interface em **português do Brasil**. O back-end é o repositório irmão `../Minha-Assistente`;
o contrato da API está em `../Minha-Assistente/docs/arquitetura.md` e o escopo/ordem das
entregas em `../Minha-Assistente/docs/prompt-front.md` (pare ao fim de cada entrega para revisão).

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

## Estrutura

- `src/app/navegacao.ts` define as áreas; a barra inferior (celular) e a lateral (desktop) em
  `components/layout/LayoutApp.tsx` são geradas dela. No celular as áreas secundárias ficam em
  "Mais", que fica marcado quando uma delas está aberta.
- Rotas em `src/app/rotas.tsx`; cada tela usa `components/layout/Pagina.tsx` (título da aba +
  cabeçalho). Áreas ainda não feitas usam `paginas/EmBreve.tsx`.
- **MSW** (`src/mocks/handlers.ts`): cada rota nova do back-end ganha um handler que segue o
  contrato à risca, para trocar pelo servidor real sem mexer nas telas. Os testes do cliente
  (`src/lib/api.test.ts`) usam os mesmos handlers com `msw/node`.
- `src/components/ui/` é gerado pelo shadcn (`npx shadcn@latest add <comp>`); os tamanhos de
  botão/input foram aumentados (mín. 44px de toque) — ao adicionar componentes, mantenha isso.

## Design

Público com pouca intimidade com tecnologia, uso no celular com uma mão: base de 18px, fonte
Atkinson Hyperlegible Next, áreas de toque ≥ 44px, linguagem simples. Paleta "agenda de capa
dura" em `src/index.css`: papel `--papel`, tinta azul-petróleo `--primary`, açafrão `--hoje`
(só para marcar o dia/item ativo — a "fita" marcadora) e `--atraso` para vencidos.
