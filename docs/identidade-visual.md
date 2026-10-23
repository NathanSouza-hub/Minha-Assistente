# Identidade visual

Guia do visual do front (`web/`). Mudança de direção se combina aqui primeiro. Esta versão,
**"Vivo suave"** (2026-10-22), substituiu a identidade v3 azul (2026-10-21), que por sua vez tinha
substituído a capa azul (2026-10-20) e a "agenda de couro" (petróleo, creme e terracota).

## A ideia

**Uma assistente com personalidade, que ajuda a agir.** A v3 ficou correta, mas "sem vida, tudo
igual, com cara de IA". A direção nova (caminho A da amostra no canvas, com as cores suavizadas):
fundo quente de papel, tinta quase preta, **um** bloco azul-noite com a lua âmbar para o que fazer
agora, e cada área com a sua cor clara em blocos. Cada módulo tem o próprio desenho: o Início é a
assistente, Finanças é um painel com gráficos, Medicamentos é o anel das doses.

## Princípios

1. **O que fazer agora vem primeiro.** O Início abre com uma frase de assistente (feita só com os
   dados do dia) e o bloco "Agora".
2. **Cor com função.** Azul-noite só no "Agora"; âmbar é o destaque (botão do "Agora", item ativo
   da barra, a lua); cada área tem um par tinta + fundo claro que identifica blocos e selos.
   Vermelho só para vencido/atrasado, verde só para feito/pago.
3. **Escuro para ação e navegação.** Botão principal, item ativo da barra lateral e a barra de baixo
   são grafite. Nada de azul elétrico.
4. **Estados iguais em todas as áreas** (tabela abaixo). Cor nunca é o único sinal.
5. **Falar como gente.** "Agora é a hora da Losartana." — nunca jargão.
6. **Legibilidade não se negocia.** Base de 17px, toque ≥ 44px, contraste AA, foco visível.
7. **Sem degradê e sem excesso de cartão.** Listas continuam linhas numa superfície branca; bloco
   colorido só para resumo de área, o "Agora" e o saldo.

## Cores

Tokens em `web/src/index.css`.

| Papel | Token | Valor | Uso |
|---|---|---|---|
| Fundo | `--papel` | `#F4F3EF` | fundo de todas as telas (quente) |
| Superfície | `--folha` | `#FFFFFF` | listas, Verso do dia, gráficos, campos |
| Suave | `--suave` | `#ECEAE3` | barra lateral, hover, botão secundário |
| Fio | `--linha` | `#E4E2DB` | divisórias, grade dos gráficos |
| Contorno | `--contorno` | `#D3D0C7` | trilho de progresso, linha do zero |
| Texto / ação | `--grafite` (`--primary`) | `#1B1D26` | texto, botão principal, item ativo, barra de baixo |
| Texto suave | `--muted-foreground` | `#5E6170` | datas, legendas |
| Noite | `--noite` | `#2F2D5B` | só o bloco "Agora" (texto branco; apoio em `--noite-texto` `#CFCDEB`) |
| Âmbar | `--ambar` | `#F0B44C` | botão do "Agora", item ativo da barra de baixo, a lua, "Vence hoje" (texto grafite em cima) |
| Azul | `--azul` | `#2E3D8C` | foco (anel), "agora" nas linhas |
| Âmbar escuro | `--alerta` | `#6B4A00` | "Valor a definir" |
| Vencido | `--atraso` / `--atraso-fundo` | `#B3261E` / `#F7E0DB` | vencido, atrasado, "Pede atenção" |
| Feito | `--ok` / `--ok-fundo` | `#2F7A4F` / `#DDEEE2` | pago, tomado, concluído |

### Estados

Componente `components/Estado.tsx` (`MarcaEstado`, `SeloEstado`); nenhuma tela monta cor de estado
à mão.

| Estado | Como aparece |
|---|---|
| Pendente | círculo vazio cinza |
| Agora | no Início, o bloco azul-noite; na linha, "· agora" |
| Feito / pago / tomado | círculo verde cheio com ✓; título riscado e suave |
| Não fiz / não tomei | círculo cinza com ✗ e a palavra; sem vermelho |
| Vence hoje | selo âmbar cheio com relógio |
| Vencido / atrasado | texto vermelho com ícone e a data; grupo "Atrasadas" em cima |
| A definir | texto âmbar escuro |

### Cor por área

Par **tinta + fundo** (contraste ≥ 4,5:1 entre os dois). Blocos de resumo usam o fundo com o rótulo
na tinta e o número em grafite; nas linhas, o pontinho ao lado do detalhe.

| Área | Tinta | Fundo |
|---|---|---|
| Agenda | `#2E3D8C` | `#DEE4F7` |
| Finanças / contas | `#5A4710` | `#F5E6B0` |
| Recebíveis | `#1D6455` | `#D6ECE5` |
| Lembretes (tarefas e compromissos) | `#8B3352` | `#F5DFE6` |
| Medicamentos | `#23603F` | `#DDEEE2` |
| Viagens | `#0B5C8A` | `#D9EAF5` |
| Compras | `#5A3F86` | `#E8E1F2` |
| Programa de rádio | `#4B3399` | `#E8E2FB` |
| Atividade física | `#4F6B1F` | `#E6EDD3` |
| Fisioterapia | `#3B5F73` | `#DCE8EE` |
| Hoje | `--noite` | `#E3E2F2` |

Tokens: `--area-<nome>` e `--area-<nome>-fundo`; a cor de cada rota em `src/app/navegacao.ts`.

### Gráficos

Desenhados à mão (`web/src/paginas/financas/graficos.tsx`, sem biblioteca). Entradas `#0F8A6A`,
saídas `#C08A1E` (par conferido no validador de paleta: daltonismo ΔE 10,5, contraste ≥ 3:1 no
branco). Resultado mensal em grafite: linha cheia = realizado, tracejada com marcador vazado =
projeção. Eixo sempre do zero, grade de 1px, colunas de no máximo 22px com ponta arredondada,
tooltip no toque/passar, legenda com o nome de cada série e "Ver os números" (tabela) em todo
gráfico. Relatório: série "pago" grafite, "previsto" `#C08A1E`.

## Tipografia

**Bricolage Grotesque** (títulos `h1`/`h2`, números grandes: classe `font-heading`) + **Figtree**
(texto), as duas variáveis (`@fontsource-variable/*`). Base de 17px; pesos 400–700.

| Classe | Uso |
|---|---|
| título da tela | 1,75rem no celular, 2rem a partir de 400px, 2,25rem no computador; -0.03em |
| saudação do Início | 1,9rem → 2,6rem |
| `text-destaque` | totais, título de folha |
| `text-secao` | títulos de seção e de gráfico |
| (base) | item de lista, texto corrido |
| `text-apoio` | detalhes, datas, explicações |

Números em coluna (listas, eixos): `tabular-nums`.

## Formas

- Raio base `1rem`; blocos de área e "Agora" com 1,4–1,75rem; botões e pílulas totalmente
  redondos (`rounded-full`).
- Superfície pela classe `superficie` (branca, sombra quase invisível).
- Campos com borda de 1,5px em `--input`; foco com anel azul.

## Estrutura das telas

- **Cabeçalho** (`Pagina`): título grande em Bricolage, ação de criar à direita (`variant="secondary"`).
- **Telas da área** no celular: pílulas que rolam para o lado (a atual em grafite). Abas internas
  (`components/Abas.tsx`) continuam em texto sublinhado.
- **Barra de baixo** (celular): pílula grafite flutuante; a área atual em pílula âmbar com ícone e
  nome, as outras só com o ícone (o nome fica para leitores de tela).
- **Barra lateral** (computador): fundo `--suave`; a área ativa em pílula grafite com o ícone âmbar.
- **Menu**: Início, Finanças, Agenda, Medicamentos, Lembretes, Configurações. Consultas, exames,
  fisioterapia e atividade física saíram do menu (rotas e dados continuam, abertos pela Agenda).

## Início

1. Data, "+ Nova" e a engrenagem (celular); saudação grande; **frase da assistente** (o que é agora
   ou o próximo, e quantas ficaram para trás — só com os dados de `/hoje`); barra de progresso.
2. **Agora**: bloco azul-noite com a lua âmbar, o horário numa pílula, título grande, "Tomei/Feito"
   em âmbar, "Não fiz" sublinhado e "Depois:".
3. **Resumo das áreas** (`hoje/ResumoDasAreas.tsx`): Remédios (doses com anel), próximo da Agenda e
   Lembretes feitos, cada um na cor da área.
4. **Verso do dia** (`hoje/VersoDoDia.tsx`) no lugar do antigo resumo financeiro.
5. Atrasadas e a lista do dia. No computador, as listas à esquerda e o resumo com o verso numa
   coluna fixa à direita.

### Verso do dia

- Texto da **tradução de João Ferreira de Almeida (domínio público)**, copiado sem alteração da
  bible-api.com (`?translation=almeida`) e guardado em `web/src/lib/versos.ts` (71 versos). Não
  depende de internet; nenhum verso é escrito de memória.
- Escolha pelo dia (`versoDoDia`): percorre a lista com passo 37 (primo com 71), então todos passam
  antes de repetir e nunca repete em dias seguidos; igual em todo aparelho.
- "Ler o capítulo" abre uma folha e busca o capítulo na bible-api.com na hora (cache da sessão).
  Sem internet ou com o serviço fora, mostra o aviso e o verso continua no Início. A bible-api.com é
  um serviço gratuito sem garantia de disponibilidade e com limite de requisições por IP; o texto é
  de domínio público, então não há licença a pagar.

## Finanças → Visão geral

Abas **Resumo do mês** e **Relatório** (`?vista=relatorio`; o endereço antigo `/relatorio` redireciona).
O Resumo tem: "Pede atenção" (vencidas, recebíveis atrasados, contas a definir — ou a faixa verde
"Nada vencido"), o saldo realizado e projetado num bloco grafite, os grupos Despesas e Recebíveis
com o critério de cada número, os gráficos Entradas e saídas, Resultado mês a mês e Despesas por
categoria, e os blocos Por residência. O Relatório tem o período, "Gerar PDF", a comparação com o
período anterior e as abas Balanço, Recebíveis e pessoais e Por imóvel ou categoria.

### Regras dos números (auditoria de 2026-10-22)

- Realizado = recebido − pago no mês (pela data do recebimento e do pagamento); projetado =
  previsto a receber − contas que vencem no mês. Projeção só do mês atual em diante e sempre
  tracejada; nunca somada ao realizado.
- Comparação com o período anterior em trechos equivalentes: com o período em andamento, do início
  até hoje contra o mesmo número de dias do anterior (`trechosComparaveis`).
- Mês sem movimento mostra R$ 0,00 com "sem movimento" (traço no eixo, dica e tabela). Nada de
  preencher período vazio.
- Percentual das categorias sobre o total da API; acima de 8 categorias, as maiores e "Ver todas"
  (sem juntar o resto num "Outras").
- Tabelas: valores sem quebra; no celular, fonte menor. A tabela de Entradas e saídas não repete a
  diferença (é o Realizado da tabela do Resultado).

## Agenda

Atalhos "Agenda por tipo" em pílulas (com o ponto da cor da área) em cima das abas Mês, Semana e
Próximos. No calendário, **hoje tem o anel âmbar** e o dia aberto fica em grafite. Na lista de hoje,
a linha âmbar "Agora" separa o que já começou do que vem; na Semana, hoje tem a faixa âmbar ao lado
do nome e os dias que passaram ficam apagados.

## Lembretes

Anotar rápido numa pílula com o "+" redondo na cor da área (Lembretes). Atrasadas num bloco tingido
com "Era para …" (o único bloco da tela); Hoje e Próximas (separadas por dia) como linhas numa
superfície. A hora fica à direita, junto do sino quando há lembrete. Sugestões como pílulas
tracejadas pequenas. Compromissos que repetem: o mesmo desenho, com a hora à direita.

## O que foi feito

Item do menu de Lembretes. O total do período num bloco na cor de Lembretes (número grande em
Bricolage, a divisão tarefas · compromissos ao lado), e as colunas por dia ou por semana na tinta
da área (uma série só, sem legenda; a dica separa tarefas e compromissos). Dia sem nada concluído:
traço no zero. Período sem nada: estado vazio, sem gráfico. O rodapé diz o que conta e por que não
há "pendente".

## Compras

O contador "X de Y itens comprados" no cabeçalho, o anotar rápido em pílula (roxo da área), "A
comprar" com cada categoria no seu bloco (título em caixa alta na cor da área) e "Já comprados" mais
apagado embaixo, com "Limpar comprados".

## Medicamentos

Anel com "1 de 4 doses tomadas" e a próxima dose, as doses por período (Manhã, Tarde, Noite, da
semana) e **Últimos 7 dias** (uma coluna por dia com tomadas/total; tocar abre o dia).

## Ícones

**Phosphor**: `regular` no geral, `fill` no ativo.

## Tom dos textos

- Segunda pessoa, frases curtas, calor sem exagero. Sem emoji.
- Vazio: diga o que está acontecendo e o próximo passo.
- Respeitar o vocabulário de quem usa o app (ver `web/CLAUDE.md`).
- Nunca o nome de uma pessoa real nos textos fixos.

## Marca

Símbolo **B, "conversa resolvida"** (provisório): balão branco com o canto inferior esquerdo reto e
o "feito" âmbar, sobre o quadrado grafite `#1B1D26` (`web/public/favicon.svg`). Ícones do PWA com
`npx pwa-assets-generator` (fundo grafite). O nome escrito continua "Minha Assistente".
