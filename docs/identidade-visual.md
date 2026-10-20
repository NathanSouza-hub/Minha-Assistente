# Identidade visual

Guia do visual do front (`web/`). Mudança de direção se combina aqui primeiro. A identidade azul
substituiu a "agenda de couro" (petróleo, creme e terracota) em 2026-10-20.

## A ideia

**Secretária digital organizada**: azul moderno e confiante, com superfícies brancas sobre um fundo
azul muito claro. Aparência de produto premium, mas acolhedora: o app fala como gente, mostra
pouca coisa por vez e deixa claro o próximo passo.

## Princípios

1. **Azul conduz, as outras cores informam.** O azul é a marca (cabeçalho, navegação, botão
   principal). Verde = feito/pago/recebido, vermelho = atrasado/erro, laranja = alerta ou
   pendência que pede atenção. Cor nunca é o único sinal: sempre há texto ou ícone junto.
2. **Menos caixas.** Listas são linhas sobre o fundo, separadas por respiro ou fio fino. Cartão só
   quando o bloco é de fato um objeto (um cartão de crédito, um resumo, um indicador).
3. **Cada área tem cor.** Reconhecer Agenda, Remédios ou Contas de relance, pela cor e pelo ícone.
4. **Falar como gente.** "Bom dia", "Nada marcado para hoje. Aproveite!" — nunca jargão.
5. **Legibilidade não se negocia.** Base de 18px, Atkinson, toque ≥ 44px, contraste AA (≥ 4,5:1
   em texto, ≥ 3:1 em bordas de campo e ícones), foco sempre visível.
6. **Só tema claro.** Não há modo escuro.

## Cores

Tokens em `web/src/index.css`. Contrastes medidos (WCAG) contra a superfície indicada.

| Papel | Token | Valor | Uso | Contraste |
|---|---|---|---|---|
| Fundo | `--papel` | `#F4F7FC` | fundo de todas as telas | — |
| Superfície | `--folha` | `#FFFFFF` | cartões, modais, campos, barra inferior | — |
| Suave | `--suave` | `#EAF0F8` | fundos suaves, abas inativas, cabeçalho de tabela | — |
| Fio | `--linha` | `#DBE3EF` | divisórias finas | decorativo |
| Borda de campo | `--input` | `#7D8BA1` | contorno de input/select | 3,5:1 no branco |
| Texto | `--grafite` | `#16233A` | texto principal (azul-marinho quase preto) | 14,6:1 no fundo |
| Texto suave | `--muted-foreground` | `#55657D` | datas, legendas, apoio | 5,5:1 no fundo |
| Azul | `--azul` / `--primary` | `#1F4FD1` | botão principal, links, item ativo, foco | 6,8:1 no branco |
| Azul da capa | `--azul-capa` | `#1B3FAE` | cabeçalho e barra lateral (degradê até o azul) | branco 8,9:1 |
| Azul profundo | `--azul-profundo` | `#142F86` | item ativo da barra lateral | branco 11,8:1 |
| Azul claro | `--azul-claro` | `#C7D6FB` | texto secundário **sobre** a capa | 5,3:1 no pior ponto |
| Fundo azul | `--azul-fundo` | `#E3EBFD` | selo da área geral, botão secundário, dia de hoje | azul 5,7:1 |
| Céu | `--hoje` | `#7CC0FF` | só a fita do item ativo **sobre** a capa | 4,6:1 na capa |
| Alerta | `--alerta` | `#9A4A07` | "A definir", fatura fechada, pendências | 5,4:1 no fundo laranja |
| Fundo de alerta | `--alerta-fundo` | `#FDECD3` | selo de alerta | — |
| Atraso | `--atraso` | `#C0262D` | vencido/atrasado, erro, exclusão | 5,9:1 no branco |
| Feito | `--ok` | `#2F6B45` | pago, tomado, concluído, recebido; botão `confirmar` | 6,3:1 no branco |

Atraso **sempre** vem com texto ou ícone ("Vencida há 3 dias"), nunca só a cor. "Hoje" e
"acontecendo agora" usam o azul (fundo azul + texto azul), não o laranja: laranja é só alerta.

### Cor por área

Cada área tem um par **tinta + fundo** (contraste ≥ 4,5:1 entre eles). Uso: o "selo" do ícone da
área (quadradinho arredondado com fundo claro e ícone na tinta), marcadores na lista do Hoje, o
item ativo da barra inferior e a fita da área embaixo do cabeçalho (esta na cor de **fundo**).
Texto corrido continua no grafite.

| Área | Tinta | Fundo |
|---|---|---|
| Agenda, Hoje e geral | `#1F4FD1` | `#E3EBFD` |
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

Tokens: `--area-<nome>` e `--area-<nome>-fundo`. A cor de cada rota fica junto da definição em
`src/app/navegacao.ts`, para menu, cabeçalho e Hoje lerem do mesmo lugar.

Relatório: série "pago" no azul, "previsto" em `#C2620A` (4,2:1 no branco).

## Tipografia

Continua **só a Atkinson Hyperlegible Next** (variável), base de 18px. A personalidade vem de
tamanho, peso e espaçamento, não de outra fonte.

- Título da tela (no cabeçalho azul): 1,75rem, peso 750, `letter-spacing: -0.01em`.
- Título de seção: 1,25rem, peso 700, no grafite. Nada de títulos em caixa alta.
- Texto: 1rem (18px), peso 400, `line-height: 1.5`. Apoio: 0,89rem no texto suave.
- Números de destaque (valor de conta, horário): peso 700, `font-variant-numeric: tabular-nums`.

## Formas

- Raio base `0.875rem`; botões e campos com o raio médio, cartões e modais com o grande.
- Cartão: contorno de 1px quase invisível + sombra azulada baixa (`--shadow-folha`), em vez de
  borda cinza.
- Divisória é `--linha`, 1px, só onde separa.

## Estrutura das telas

- **Cabeçalho cheio**: cada tela começa com a capa azul (degradê diagonal discreto do azul da capa
  para o azul), título em branco, subtítulo em azul claro, ação principal à direita. Ela se
  estende por trás da barra de status do celular (`theme-color` = `#1B3FAE`). Embaixo, uma fita
  fina na cor de fundo da área.
- **Corpo**: o conteúdo fica direto no fundo azul muito claro. Grupos com título de seção e linhas.
- **Barra inferior** (celular): branca, com sombra para cima. Item ativo com o ícone preenchido
  num selo na cor da área e a fita azul em cima.
- **Barra lateral** (computador): azul como a capa, itens em azul claro; o ativo fica em branco
  sobre `--azul-profundo`, com a fita céu à esquerda.
- **Botões**: principal azul sólido; de apoio com contorno azul; `confirmar` verde ("Pagar",
  "Recebi"); `perigo` vermelho (confirmar exclusão). Botões de criar ficam no cabeçalho ou fixos
  embaixo, ao alcance do polegar.

## Ícones

**Phosphor** (`@phosphor-icons/react`) em todo o app: peso `regular` no geral e `fill` no item
ativo da navegação e nos selos de área. Os `components/ui/` do shadcn podem manter o Lucide
internamente (setas, x de fechar) até serem revisados.

## Ilustrações

Desenhos simples de traço (SVG inline, 1 ou 2 cores da paleta, traço arredondado ~2px). Onde:
telas vazias de cada área, login/cadastro, página não encontrada e o "tudo em dia" do Hoje.
Ficam em `web/src/components/ilustracoes/`, um componente por desenho, `aria-hidden` (o texto ao
lado é que informa).

## Tom dos textos

- Segunda pessoa, frases curtas, calor sem exagero. Sem emoji na interface.
- Hoje: "Bom dia" (bom dia / boa tarde / boa noite pelo horário) + data por extenso
  ("sexta-feira, 16 de outubro").
- Vazio: diga o que está acontecendo e o próximo passo. "Nenhuma conta neste mês." →
  "Nenhuma conta para outubro. Quer cadastrar uma?"
- Confirmação: "Pronto, conta paga." em vez de "Pagamento atualizado com sucesso".
- Respeitar o vocabulário de quem usa o app (agendamentos, Compromissos — ver `web/CLAUDE.md`).
- Nunca o nome de uma pessoa real nos textos fixos: a saudação usa o nome da conta que entrou.

## Marca

Símbolo sem texto: um marcador de página branco com um "feito" azul, sobre um quadrado
arredondado em degradê azul (`web/public/favicon.svg`). Usado no favicon, nos ícones do PWA
(gerados com `npx pwa-assets-generator` a partir do SVG, incluindo o maskable com área segura) e
na tela de entrar. O nome escrito continua "Minha Assistente".
