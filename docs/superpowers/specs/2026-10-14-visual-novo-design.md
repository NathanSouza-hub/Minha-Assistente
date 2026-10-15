# Visual novo do front — especificação

Data: 2026-10-14 · Escopo: só `web/` (o back-end não muda) · Maquete aprovada:
https://claude.ai/artifact/JQo8LijSz9FKTwTsLFvHtQ (telas Hoje claro/escuro, Contas, Mais)

## Objetivo

Trocar o visual "agenda de capa dura" (papel, azul-petróleo, fita açafrão, letra de 18px) por um
visual atual, **bento colorido com a linguagem do iPhone**: a usuária principal usa produtos Apple e
o app deve parecer nativo no iOS. Comportamento, rotas, chamadas à API e textos dos formulários não
mudam — é uma troca de pele, não de funcionalidade.

Critérios de aceite:
- As telas Hoje, Contas e Mais ficam como na maquete, em claro e escuro, a 390px de largura.
- O tema segue o sistema (`prefers-color-scheme`), sem botão de troca.
- Todos os testes, o lint e o build continuam passando (testes ajustados só onde o texto mudou).
- Contraste de texto ≥ 4,5:1 (≥ 3:1 em textos de 24px ou mais) nos dois temas; alvos de toque ≥ 44px.

## Decisões

| Tema | Decisão |
|---|---|
| Direção | Cartões coloridos (bento) + linguagem iOS |
| Letra | Base de 16px (sai o `font-size: 112.5%`); títulos grandes de 34px |
| Fonte | Do sistema: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif` (SF Pro no iPhone). Sai o pacote `@fontsource-variable/atkinson-hyperlegible-next` |
| Modo escuro | Automático, seguindo o celular |
| Rótulo da área de pagamentos | "Contas" na navegação e no título da tela (a rota `/pagamentos` não muda) |

## 1. Tokens de cor (`web/src/index.css`)

A paleta vira variáveis CSS em `:root` (claro) e em `@media (prefers-color-scheme: dark)` (escuro).
O `@custom-variant dark` passa a usar a media query: `@custom-variant dark (@media (prefers-color-scheme: dark));`.
Os nomes do shadcn (`--background`, `--card`, `--primary`…) continuam, para os componentes de
`components/ui` herdarem sem mudança.

Base:

| Token | Claro | Escuro |
|---|---|---|
| `--background` | `#F2F2F7` | `#000000` |
| `--card` / `--popover` | `#FFFFFF` | `#1C1C1E` |
| `--foreground` | `#111114` | `#F5F5F7` |
| `--muted-foreground` | `#5B5B63` | `#A1A1AA` |
| `--muted` | `#E9E9EE` | `#2C2C2E` |
| `--border` | `rgba(60,60,67,.14)` | `rgba(255,255,255,.12)` |
| `--input` | `rgba(60,60,67,.30)` | `rgba(255,255,255,.24)` |
| `--primary` / `--ring` | `#0A5FD8` | `#5AA2FF` |
| `--primary-foreground` | `#FFFFFF` | `#00152E` |
| `--destructive` / `--atraso` | `#B4231A` | `#FF8F85` |
| `--vidro` (barra flutuante) | `rgba(255,255,255,.74)` | `rgba(36,36,40,.72)` |
| `--radius` | `1.375rem` (22px) | igual |

Cores das áreas, cada uma com um fundo (`-bg`) e uma tinta (`-fg`, para ícone, número e link):

| Área | Claro bg / fg | Escuro bg / fg |
|---|---|---|
| `agenda` | `#E3EEFF` / `#0B4FB3` | `#12284A` / `#8DBBFF` |
| `remedios` | `#DFF6E6` / `#13733A` | `#10331F` / `#7FD99B` |
| `rotina` | `#EEE8FF` / `#5B36C4` | `#251D47` / `#B9A3FF` |
| `contas` | `#FFEBDB` / `#A84A06` | `#3A230F` / `#FFB27A` |
| `viagens` | `#DAF4F2` / `#0B6B66` | `#0E3432` / `#7ADBD3` |
| `compras` | `#FFF4CC` / `#7A5A00` | `#3A3110` / `#F3D46B` |
| `alerta` | `#FFE4E1` / `#B4231A` | `#3D1512` / `#FF8F85` |

Expostas ao Tailwind como `--color-agenda`, `--color-agenda-fg` etc., permitindo `bg-agenda`
e `text-agenda-fg`. Saem `--papel`, `--tinta`, `--grafite`, `--linha` e `--hoje` (a fita açafrão
deixa de existir): os usos de `bg-hoje` saem (navegação lateral e inferior, `LayoutVisitante`,
cabeçalho do Hoje) e o marcador do dia atual na Agenda (`Agenda.tsx`) passa a `bg-primary`. As séries do
relatório (`--serie-pago`, `--serie-previsto`) ficam, com a variante escura conferida no contraste.

`index.html` e o manifesto (`vite.config.ts`): `theme-color` com duas metas por media query (claro
`#F2F2F7`, escuro `#000000`), `background_color` `#F2F2F7`,
`apple-mobile-web-app-status-bar-style` = `default`. O `:focus-visible` usa `var(--ring)`.

## 2. Navegação (`components/layout/LayoutApp.tsx`, `app/navegacao.ts`)

- **Celular — barra inferior flutuante:** `fixed`, 14px das laterais, 26px + `safe-area-inset-bottom`
  do fim da tela, altura 68px, cantos de 34px, fundo `--vidro` com `backdrop-blur` e sombra suave.
  Cinco itens (Hoje, Agenda, Contas, Remédios, Mais); o ativo ganha uma pílula `bg-primary/12` com
  ícone e rótulo em `text-primary` (traço 2.2 ativo, 1.8 inativo); rótulo de 11px.
  O `padding-bottom` do `<main>` aumenta para o conteúdo não ficar atrás da barra.
- **Computador — barra lateral:** mesma largura, fundo `bg-card/70` com blur; item ativo vira a
  mesma pílula azul (sai a fita açafrão). O resto da estrutura fica.
- `navegacao.ts`: rótulo de `/pagamentos` passa a "Contas".

## 3. Moldura das telas (`components/layout/Pagina.tsx`)

- Título grande: 34px, `font-bold`, `tracking-tight`, padding superior que respeita
  `safe-area-inset-top`. Prop nova opcional `sobretitulo` (o "QUARTA-FEIRA" da tela Hoje: 13px,
  maiúsculas, `text-muted-foreground`).
- `acoes` continua no cabeçalho no computador. No celular, a ação principal de criar ("Novo…")
  vira **botão flutuante "+"** (60px, `bg-primary`, acima da barra inferior), via prop nova
  `acaoPrincipal: { rotulo, para }` — o `rotulo` vira o `aria-label`. Telas que já passam um botão
  de criar em `acoes` migram para `acaoPrincipal`.

## 4. Componentes novos (`web/src/components/`)

- **`CartaoArea`** — o bloco do bento: `area` (chave da tabela de cores), `icone`, `titulo`,
  `link?` ("Ver tudo"), `children`. Fundo `bg-<area>`, cantos de 26px, padding 16–18px, ícone num
  quadrado de 34px com fundo branco translúcido e tinta `text-<area>-fg`. É `<section>` com
  `aria-labelledby`.
- **`Contador`** — número grande (36px, tinta da área) + legenda ("1/3 tomados", "2/4 feitas").
- **`ListaAgrupada` / `LinhaLista`** — lista estilo Ajustes do iOS: fundo `bg-card`, cantos de
  22px, separador recuado entre linhas, linha com altura mínima de 56px, ícone colorido opcional
  à esquerda, valor e chevron à direita. Cabeçalho de grupo em 13px maiúsculo.
- **Controle segmentado** — não é componente novo: `Opcoes` com `formato="segmentos"`
  (`components/Opcoes.tsx`) ganha o visual iOS (trilho cinza `rgba(118,118,128,.14)`, cantos de
  12px, opção marcada em `bg-card` com sombra leve). A semântica e a acessibilidade atuais ficam.

`Button` (`components/ui/button.tsx`): cantos totalmente arredondados (`rounded-full`), altura
padrão de 44px (`h-11`), `sm` 36px; as variantes continuam. `Input`/`Textarea`: fundo `bg-card`,
sem borda forte, cantos de 12px, altura de 44px.

## 5. Telas

- **Hoje** (`paginas/Hoje.tsx`): cabeçalho com sobretítulo do dia da semana + "14 de outubro" em
  34px e o resumo em texto secundário. Embaixo, nesta ordem: cartão de alerta para contas
  vencidas (`bg-alerta`, leva a `/pagamentos?status=pendente`); `CartaoArea` agenda (largura toda,
  horários em 22px na tinta da área, selo "em X min" no próximo compromisso); grade de duas colunas
  com Remédios (contador + próxima dose + botão "Tomei") e Rotina (contador + barra de progresso +
  tarefas); `CartaoArea` contas a vencer (largura toda). Seção vazia não aparece, exceto Agenda
  ("Nada marcado para hoje."). Os itens continuam vindo de `ItemEvento`, `ItemDose`, `ItemTarefa`
  e `ItemPagamento`, ganhando uma variante compacta para dentro dos cartões.
- **Contas** (`paginas/pagamentos/Pagamentos.tsx`): título "Contas", navegação de mês com botões
  redondos, filtro segmentado com as opções atuais (Todos / A pagar / Pagos), dois cartões de
  resumo (A pagar em `contas`, Pago em `remedios`) e a lista em `ListaAgrupada`, na ordem e
  agrupamento atuais (a maquete mostra "Esta semana"/"Mais tarde", mas agrupar por período é regra
  nova e fica fora), com conta vencida destacada na cor `alerta`.
- **Mais** (`paginas/Mais.tsx`): bento com Rotina (largura toda), Viagens e Compras (meia
  largura), cada um com uma linha de status; depois a lista agrupada "Configurações"
  (Notificações, Imóveis, Relatório de gastos, com ícones em quadrados coloridos) e "Conta"
  (nome, e-mail, Sair).
- **Demais telas** (Agenda, Remédios, Rotina, Viagens, Compras, Imóveis, Relatório,
  Notificações, formulários, Entrar/Cadastro): sem layout novo — herdam tokens, `Pagina`,
  `Button`, `Input` e trocam os cartões de lista por `ListaAgrupada`/`LinhaLista` ou `CartaoArea`
  da sua cor. `LayoutVisitante` perde a fita açafrão e ganha o título grande.

## 6. Fora do escopo

Back-end, rotas, regras de negócio, textos dos formulários, animações de transição entre telas,
botão manual de tema, layout novo para o computador (só herda o estilo).

## 7. Testes e verificação

- Os testes atuais buscam por papel e texto, então devem passar sem mudança, exceto os que
  procuram "Pagamentos" na navegação ou no título (`paginas/auth.test.tsx` e
  `paginas/pagamentos/pagamentos.test.tsx`), que passam a esperar "Contas".
- Testes novos: botão flutuante com `aria-label` vindo de
  `acaoPrincipal`, item ativo da barra inferior com `aria-current="page"`.
- `npm test`, `npm run lint` e `npm run build` em `web/`.
- Conferência visual no navegador a 390px, em claro e escuro (emulando `prefers-color-scheme`),
  das telas Hoje, Contas e Mais contra a maquete, e de uma tela de formulário.

## 8. Ordem de entrega

1. Tokens, fonte, modo escuro, `Button`/`Input` e navegação (o app inteiro já muda de cara).
2. `Pagina` (título grande e botão flutuante) e componentes novos.
3. Tela Hoje.
4. Contas e Mais.
5. Demais telas e telas de visitante.

Cada parte termina com testes, lint e build passando, e é revisada antes da próxima.
