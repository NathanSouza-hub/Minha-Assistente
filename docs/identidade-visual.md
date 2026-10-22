# Identidade visual

Guia do visual do front (`web/`). Mudança de direção se combina aqui primeiro. Esta versão
(2026-10-21) substituiu a identidade azul de capa cheia (2026-10-20), que por sua vez tinha
substituído a "agenda de couro" (petróleo, creme e terracota).

## A ideia

**Uma assistente que ajuda a agir.** O app mostra primeiro o que fazer agora, e não um painel de
números. Visual de produto maduro: fundo claro, pouca superfície, contraste usado só onde importa.
Azul elétrico para ação, âmbar para atenção, grafite para o texto.

## Princípios

1. **O conteúdo é o protagonista, não o cartão.** Listas são linhas numa superfície branca,
   separadas por fio fino. Cartão destacado só para o que é único na tela (o "Agora" do Início).
   Nada de um cartão por item.
2. **Hierarquia seletiva.** Em cada tela, uma coisa chama a atenção. Títulos em grafite, apoio em
   cinza, azul só no que se toca.
3. **Azul é ação; âmbar é atenção.** Azul em botões, links, item ativo e "agora". Âmbar só para
   "vence hoje", "a definir" e lembretes, e sempre com texto grafite em cima (âmbar sobre branco ou
   azul não tem contraste).
4. **Estados iguais em todas as áreas** (tabela abaixo). Cor nunca é o único sinal: sempre há
   ícone e texto juntos.
5. **Falar como gente.** "Bom dia", "Nada programado para hoje." — nunca jargão.
6. **Legibilidade não se negocia.** Base de 17px, toque ≥ 44px, contraste AA (≥ 4,5:1 em texto,
   ≥ 3:1 em bordas de campo e ícones), foco sempre visível.
7. **Sem degradê nas telas.** Só tema claro.

## Cores

Tokens em `web/src/index.css`.

| Papel | Token | Valor | Uso |
|---|---|---|---|
| Fundo | `--papel` | `#F3F6FC` | fundo de todas as telas |
| Superfície | `--folha` | `#FFFFFF` | listas, o bloco "Agora", modais, campos, barras |
| Suave | `--suave` | `#EDF1F8` | hover, cabeçalho de tabela |
| Fio | `--linha` | `#E3E9F2` | divisórias entre linhas |
| Contorno | `--contorno` | `#CDD6E4` | botão de apoio, pílulas, abas |
| Borda de campo | `--input` | `#7D8BA1` | input/select (3,5:1 no branco) |
| Texto | `--grafite` | `#0E1A33` | texto principal; botão de criar escuro |
| Texto suave | `--muted-foreground` | `#56647C` | datas, legendas (5,5:1 no fundo) |
| Azul | `--azul` / `--primary` | `#1663F2` | ação: botão, link, item ativo, "agora" (5,1:1 no branco) |
| Azul profundo | `--azul-profundo` | `#0B3FC4` | texto sobre `--azul-fundo`; pouco uso |
| Fundo azul | `--azul-fundo` | `#E6EEFF` | botão secundário ("+ Nova"), item ativo da barra lateral |
| Âmbar | `--ambar` | `#F5A524` | selo "Vence hoje" (texto grafite em cima) |
| Âmbar escuro | `--alerta` | `#6B4300` | texto "Valor a definir", "fatura fechada" |
| Fundo âmbar | `--alerta-fundo` | `#FFF1D6` | fundo claro de atenção |
| Vencido | `--atraso` | `#C0262D` | vencido, atrasado, erro, excluir (5,9:1 no branco) |
| Feito | `--ok` | `#2F6B45` | pago, tomado, concluído, recebido; botão `confirmar` |

### Estados

As mesmas regras em todas as áreas. O componente é `components/Estado.tsx` (`MarcaEstado` para o
círculo da linha e `SeloEstado` para o texto com ícone); nenhuma tela monta cor de estado à mão.

| Estado | Como aparece |
|---|---|
| Pendente | círculo vazio cinza; texto normal |
| Agora | azul: círculo azul e "agora" ao lado do horário; um item por vez |
| Feito / pago / tomado | círculo verde cheio com ✓; título riscado e suave |
| Não fiz / não tomei | círculo cinza com ✗ e a palavra; **sem vermelho** (não é erro) |
| Vence hoje | selo âmbar cheio com relógio — o único selo cheio do app |
| Vencido / atrasado | texto vermelho com ícone de alerta e a data ("Venceu em 19/10"); fica num grupo em cima |
| A definir | texto âmbar escuro, sem selo |

**Feito × Não fiz**: nunca dois botões iguais lado a lado. "Feito" é o botão cheio (ou o círculo
da linha); "Não fiz" é secundário (texto sublinhado no "Agora", opção no menu da linha).

### Cor por área

Cada área tem um par **tinta + fundo**, usado só como identificação discreta: o pontinho ao lado
do detalhe nas linhas do Início, o rótulo da seção acima do título e o selo nos menus de escolha.
Texto corrido continua no grafite.

| Área | Tinta | Fundo |
|---|---|---|
| Agenda, Hoje e geral | `#1663F2` | `#E6EEFF` |
| Contas (e cartões, equipe, relatório) | `#0F766E` | `#D5F0EC` |
| Recebíveis | `#05714F` | `#D3F2E5` |
| Tarefas avulsas | `#475569` | `#E2E8F0` |
| Remédios | `#2F6B45` | `#DDEFE2` |
| Compromissos | `#8A5A00` | `#F6E7C6` |
| Viagens | `#0369A1` | `#DBEEFA` |
| Compras | `#7A3F6B` | `#F0DDEA` |
| Programa de rádio | `#5B3FC4` | `#E8E2FB` |
| Atividade física | `#4F6B1F` | `#E6EDD3` |
| Fisioterapia | `#3B5F73` | `#DDE8EE` |

Tokens: `--area-<nome>` e `--area-<nome>-fundo`; a cor de cada rota fica em
`src/app/navegacao.ts`.

Relatório: série "pago" no azul, "previsto" em `#C2620A`.

## Tipografia

**Plus Jakarta Sans** (variável, `@fontsource-variable/plus-jakarta-sans`), base de 17px.
Só os pesos 400, 500, 600 e 700 — nada de 800.

Escala em tokens do `@theme` (`index.css`); não use tamanhos soltos (`text-[1.18rem]`, `text-xl`):

| Classe | Tamanho | Uso |
|---|---|---|
| `text-titulo` | 1,65rem (28px), -0.02em | título da tela (1,5rem abaixo de 380–400px) |
| `text-destaque` | 1,25rem | totais em destaque, título do "Agora" |
| `text-secao` | 1,18rem (20px), -0.015em | títulos de seção, de painel e de folha (`SheetTitle`) |
| (base) | 1rem | item de lista (peso 600; 500 quando feito), texto corrido, rótulo de campo |
| `text-apoio` | 0,88rem (15px) | detalhes, datas e explicações, no texto suave |

- Texto: peso 400, `line-height: 1.5`.
- Números (valores, horários): `font-variant-numeric: tabular-nums`, peso 600–700.

## Formas

- Raio base `0.875rem`. Superfícies de lista com raio grande (20px); botões 14px; pílulas 99px.
- Superfície: branca, sombra quase invisível (`--shadow-folha`), sem borda cinza. Sempre pela
  classe `superficie` (não monte `rounded-2xl bg-folha shadow-folha` à mão).
- Campos (input, select, textarea): borda de 1,5px em `--input`; foco com anel azul.
- Interruptor ligado em azul (é uma escolha, não um "feito").
- Divisória é `--linha`, 1px, só entre linhas da mesma lista.

## Estrutura das telas

- **Cabeçalho leve** (`components/layout/Pagina.tsx`): sem capa colorida. Rótulo da área pequeno na
  cor da área, título grande em grafite e, à direita, a ação de criar. `theme-color` = fundo.
- **Criar = "+ Nova"** (`variant="secondary"`, fundo azul claro) sempre no canto direito do
  cabeçalho. Cria o item daquela tela; no Início pergunta o tipo. Sem botão flutuante.
- **Abas internas** em texto, com sublinhado azul no ativo.
- **Corpo**: conteúdo direto no fundo; grupos com título de seção e uma superfície branca de linhas.
- **Barra inferior** (celular): branca, fio no topo; o ativo muda só a cor (azul) e o ícone fica
  cheio. Sem pílula nem fita.
- **Barra lateral** (computador): branca, fio à direita; o ativo em `--azul-fundo` com texto azul.
- **Botões**: principal azul sólido; de apoio com contorno cinza e texto grafite; secundário azul
  claro ("+ Nova"); `confirmar` verde ("Pagar", "Recebi"); `perigo` vermelho.

### Componentes de lista

Todas as áreas usam as mesmas peças (`web/src/components/Linha.tsx`), no molde do Início:

- `Lista`: a superfície branca com fio entre as linhas.
- `LinhaMarcavel`: círculo de concluir à esquerda (`MarcaEstado`), título e apoio no meio (o meio
  abre o item), valor opcional na linha do título e, à direita, o ⋯ de `MenuLinha` (as outras
  ações: "Não fiz", "Voltar para pendente", "Abrir"). Remédios, compromissos, tarefas, compras e
  contas (`ItemPagamento`: o círculo paga ou desfaz).
- `LinhaLink`: linha de cadastro que só abre o item, com a seta à direita.
- Linhas de cadastro com ações (Residências, Categorias): ícones discretos à direita (lápis,
  lixeira, setas), sem botões com contorno empilhados.
- Contas por urgência: as pagas ficam recolhidas ("Pagas 3") enquanto houver conta a pagar.
- Navegação de dia, semana e mês (`components/NavegadorDia.tsx`): título à esquerda, setas à direita.
- Barra de progresso fina e azul com o texto ao lado (`components/Progresso.tsx`).
- Grupos de números (Finanças, Relatório): título de seção e uma superfície de linhas "rótulo e
  critério à esquerda, valor à direita". Valor em grafite; verde só no que já foi pago/recebido,
  vermelho só no saldo negativo, e o vencido vai como `SeloEstado` na linha do critério.

## Início

1. Data (apoio) e "Bom dia, Nome" (título), "+ Nova" e a conta à direita; barra fina de progresso
   ("3 de 9 feitas").
2. **Agora**: o único bloco em destaque. A atividade com horário que está acontecendo ou é a próxima
   pendente, com "Feito" e, embaixo, "Não fiz" e "Depois: 14:00 …".
3. **Precisa de atenção**: só com atrasadas (vermelho).
4. **Hoje**: uma superfície com as linhas (círculo de concluir à esquerda, título, horário e
   detalhe com o ponto da área; "Vence hoje" nas contas do dia). Tocar no ⋯ abre as outras ações
   (Não fiz, Desfazer, Abrir). "Dia todo" numa segunda superfície.

## Ícones

**Phosphor** (`@phosphor-icons/react`): peso `regular` no geral, `bold` em ícones pequenos de
estado e `fill` no item ativo da navegação.

## Tom dos textos

- Segunda pessoa, frases curtas, calor sem exagero. Sem emoji na interface.
- Vazio: diga o que está acontecendo e o próximo passo.
- Confirmação: "Pronto, conta paga." em vez de "Pagamento atualizado com sucesso".
- Respeitar o vocabulário de quem usa o app (agendamentos, Compromissos — ver `web/CLAUDE.md`).
- Nunca o nome de uma pessoa real nos textos fixos: a saudação usa o nome da conta que entrou.

## Marca

Símbolo **B, "conversa resolvida"** (provisório até a escolha do nome): um balão branco de cantos
arredondados com o canto inferior esquerdo reto (no lugar do rabinho) e um "feito" âmbar, sobre um
quadrado azul `#1663F2` chapado (`web/public/favicon.svg`). Ícones do PWA gerados com
`npx pwa-assets-generator` (maskable com fundo azul). Conferir a leitura em 16, 24 e 32px ao mudar
o desenho. O nome escrito continua "Minha Assistente".
