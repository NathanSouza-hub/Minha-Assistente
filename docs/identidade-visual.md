# Identidade visual

Guia do redesign do front (`web/`). As duas sessões que trabalham no visual seguem este documento;
mudança de direção se combina aqui primeiro. Decidido com o Isaque em 2026-10-16.

## A ideia

**"Agenda de couro numa mesa de madeira"**: acolhedor e caloroso, mas organizado. A capa é
azul-petróleo (cabeçalho de cada tela), as folhas são creme, e a terracota é o marcador de página
e o toque de calor. Tem que parecer um app feito para uma pessoa, não um painel genérico.

O que deixa o app com "cara de IA" hoje, e que este redesign elimina:

- tudo cinza e branco, sem cor;
- toda tela é uma pilha de cartões brancos iguais com borda cinza;
- ícones padrão do Lucide e frases de sistema ("Nenhum item encontrado");
- parece site: cabeçalho branco com título, sem cara de aplicativo de celular.

## Princípios

1. **Calor antes de neutralidade.** Nada de cinza puro: neutros puxam para areia/creme.
2. **Menos caixas.** Listas são linhas sobre o papel, separadas por respiro ou fio fino. Cartão só
   quando o bloco é de fato um objeto (um cartão de crédito, o resumo do dia).
3. **Cada área tem cor.** Reconhecer Agenda, Remédios ou Contas de relance, pela cor e pelo ícone.
4. **Falar como gente.** "Bom dia", "Nada marcado para hoje. Aproveite!" — nunca jargão.
5. **Legibilidade não se negocia.** Base de 18px, Atkinson, toque ≥ 44px, contraste AA (≥ 4,5:1
   em texto, ≥ 3:1 em bordas de campo e ícones).
6. **Só tema claro.** Não há modo escuro.

## Cores

Tokens em `web/src/index.css`. Contraste medido sobre o creme `#F7F1E8`.

| Papel | Token | Valor | Uso | Contraste |
|---|---|---|---|---|
| Creme (fundo) | `--papel` | `#F7F1E8` | fundo de todas as telas | — |
| Folha | `--folha` | `#FFFCF7` | superfícies elevadas: folhas, modais, campos | — |
| Areia | `--areia` | `#EFE6D8` | fundos suaves, abas inativas, linhas alternadas | — |
| Fio | `--linha` | `#E2D6C4` | divisórias finas | decorativo |
| Borda de campo | `--input` | `#8A7968` | contorno de input/select | 3,7:1 |
| Tinta (texto) | `--grafite` | `#2B2420` | texto principal (marrom quase preto, não cinza) | 13,6:1 |
| Texto suave | `--muted-foreground` | `#6B5D50` | datas, legendas, apoio | 5,7:1 |
| Petróleo | `--tinta` / `--primary` | `#0E4A5A` | cabeçalho, botão principal, links | 8,7:1 |
| Petróleo claro | `--petroleo-claro` | `#BFD6D9` | texto secundário **sobre** o petróleo | 6,5:1 |
| Terracota | `--terracota` | `#9A4527` | destaques em texto, botão de apoio, "hoje" | 5,8:1 |
| Terracota viva | `--terracota-viva` | `#C2603A` | só decoração: fita marcadora, ilustrações | 3,7:1 |
| Terracota clara | `--terracota-clara` | `#F6DDD0` | fundo de destaque, selo "hoje" | — |
| Terracota da marca | `--terracota-marca` | `#EE9068` | só o marcador do símbolo, **sobre** o petróleo | 4,1:1 no petróleo |
| Petróleo escuro | `--petroleo-escuro` | `#0A3642` | item ativo da barra lateral | — |
| Atraso | `--atraso` | `#9E1F2C` | vencido/atrasado (vinho, distinto da terracota) | 7,0:1 |
| Pago / feito | `--ok` | `#2F6B45` | pago, tomado, concluído | 5,7:1 |

O açafrão `--hoje` atual sai: o papel de "hoje"/"item ativo" passa para a terracota.
Atraso **sempre** vem com texto ou ícone ("Vencida há 3 dias"), nunca só a cor.
Como Contas também é terracota, ali "hoje" se marca com selo e texto ("Vence hoje"), não só pela
cor. Do mesmo jeito, "feito/tomado" é verde como Remédios: o sinal de feito vem do ícone (check),
não da cor.

### Cor por área

Cada área tem um par **tinta + fundo** (contraste ≥ 4,8:1 entre eles). Uso: o "selo" do ícone da
área (quadradinho arredondado com fundo claro e ícone na tinta), marcadores na lista do Hoje e
a fita da área embaixo do cabeçalho — esta na cor de **fundo** (as tintas somem sobre o petróleo;
os fundos dão 7,5–8:1 nele). Texto corrido continua no grafite.

| Área | Tinta | Fundo |
|---|---|---|
| Agenda | `#0E4A5A` | `#DCEBEC` |
| Contas (e cartões, equipe, relatório) | `#9A4527` | `#F6DDD0` |
| Remédios | `#2F6B45` | `#DDEBDD` |
| Compromissos | `#8A5A00` | `#F6E7C6` |
| Viagens | `#2D5C8A` | `#DCE6F2` |
| Compras | `#7A3F6B` | `#F0DDEA` |
| Programa de rádio | `#4A4A8C` | `#E3E2F3` |
| Atividade física | `#4F6B1F` | `#E6EDD3` |
| Fisioterapia | `#3B5F73` | `#DDE8EE` |

Tokens: `--area-<nome>` e `--area-<nome>-fundo`. A cor de cada rota fica junto da definição em
`src/app/navegacao.ts`, para menu, cabeçalho e Hoje lerem do mesmo lugar.

## Tipografia

Continua **só a Atkinson Hyperlegible Next** (variável). A personalidade vem de tamanho, peso e
espaçamento, não de outra fonte.

- Título da tela (no cabeçalho petróleo): 1,75rem, peso 750, `letter-spacing: -0.01em`.
- Título de seção: 1,25rem, peso 700, no grafite. Nada de títulos em caixa alta.
- Texto: 1rem (18px), peso 400, `line-height: 1.5`. Apoio: 0,89rem no texto suave.
- Números de destaque (valor de conta, horário): peso 700, `font-variant-numeric: tabular-nums`.

## Formas

- Raio base `0.875rem`; botões e campos com o raio médio, folhas e modais com o grande.
- Sombra quente e baixa em vez de borda: `0 1px 2px rgb(43 36 32 / 0.06), 0 4px 12px rgb(43 36 32 / 0.05)`.
- Bordas cinzas em volta de tudo saem. Divisória é `--linha`, 1px, só onde separa.

## Estrutura das telas

- **Cabeçalho cheio**: cada tela começa com uma faixa petróleo (título em creme, subtítulo em
  petróleo claro, ação principal à direita), que se estende por trás da barra de status do
  celular (`theme-color` = petróleo). Embaixo dela, uma fita fina na cor de fundo da área.
- **Corpo creme**: o conteúdo fica direto no papel. Grupos com título de seção e linhas.
- **Barra inferior** (celular): folha creme com sombra para cima, sem borda. Item ativo com o ícone
  preenchido na cor da área e a fita terracota em cima.
- **Barra lateral** (desktop): petróleo, como a lombada da agenda, com os itens em creme; o ativo
  tem fundo `--petroleo-escuro` e a fita terracota.
- **Botão principal**: petróleo sólido. **De apoio**: contorno petróleo sobre o papel.
  **Perigo**: vinho. Botões de criar ("Novo agendamento") são grandes e no cabeçalho ou fixos
  embaixo, ao alcance do polegar.

## Ícones

Trocar o Lucide pelo **Phosphor** (`@phosphor-icons/react`): mesmo desenho em todo o app, peso
`regular` no geral e `fill` (ou `duotone`) no item ativo da navegação e nos selos de área. Os
`components/ui/` do shadcn podem manter o Lucide internamente (setas, x de fechar) até serem
revisados.

## Ilustrações

Desenhos simples de traço (SVG inline, 1 ou 2 cores da paleta, traço arredondado ~2px), com um
toque de terracota. Onde: telas vazias de cada área, login/cadastro, página não encontrada e o
"tudo em dia" do Hoje. Ficam em `web/src/components/ilustracoes/`, um componente por desenho,
`aria-hidden` (o texto ao lado é que informa).

## Tom dos textos

- Segunda pessoa, frases curtas, calor sem exagero. Sem emoji na interface.
- Hoje: "Bom dia" (bom dia / boa tarde / boa noite pelo horário) + data por extenso
  ("sexta-feira, 16 de outubro").
- Vazio: diga o que está acontecendo e o próximo passo. "Nenhuma conta neste mês." →
  "Nenhuma conta para outubro. Quer cadastrar uma?"
- Confirmação: "Pronto, conta paga." em vez de "Pagamento atualizado com sucesso".
- Respeitar o vocabulário de quem usa o app (agendamentos, Compromissos — ver `web/CLAUDE.md`).

## Marca

O nome do app ainda não foi decidido (ver pendências). Até lá: símbolo sem texto — um marcador de
página na `--terracota-marca` (a terracota viva some no petróleo em 16px) sobre um quadrado
petróleo arredondado — usado no favicon, nos ícones do PWA
(`web/public/`, incluindo o maskable com área segura) e na tela de entrar. O nome escrito continua
"Minha Assistente" e fica num lugar só, para trocar fácil.

## Divisão do trabalho

Branch de integração `redesign`; a `main` só recebe tudo no fim.

- **Fase 1** — Sessão 1 (pasta principal): `index.css`, `components/ui/`, `components/`,
  layout e navegação. Sessão 2 (worktree `C:\dev\minha-assistente-design`, branch
  `redesign-financeiro`): marca/ícones do PWA, ilustrações (pasta nova `components/ilustracoes/`, só dela) e um levantamento de textos por tela
  (sem editar telas).
- **Fase 2** — telas. Sessão 1: Hoje, Agenda (e áreas por tipo), Compromissos, Remédios, Viagens,
  Compras, Notificações. Sessão 2: Contas, Cartões, Salários equipe, Categorias, Relatório,
  Imóveis, Entrar, Cadastro, Trocar senha, Mais, Não encontrada.
- Componente compartilhado só muda pela Sessão 1; a Sessão 2 pede.
- Em 2026-10-18 a Sessão 2 não tinha começado e a Sessão 1 fez também as telas e a marca dela
  (as ilustrações de `components/ilustracoes/` ficaram para depois).
