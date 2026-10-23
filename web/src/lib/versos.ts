import { deDataISO } from '@/lib/datas'

/**
 * Versos do "Verso do dia" (Início). Texto da tradução de João Ferreira de Almeida, em domínio
 * público, copiado sem alteração da bible-api.com (`?translation=almeida`) em 2026-10-22. Ficam no
 * app (sem depender de internet); só o capítulo inteiro é buscado na hora. Para incluir um verso,
 * copie o texto da mesma fonte — nunca escreva de memória. `livro` é o código usado pela API.
 */
export type Verso = { referencia: string; livro: string; capitulo: number; texto: string }

export const FONTE_DOS_VERSOS = 'Almeida (domínio público)'

export const VERSOS: Verso[] = [
  { referencia: "Salmos 23:1", livro: "PSA", capitulo: 23, texto: "O Senhor é o meu pastor; nada me faltará." },
  { referencia: "Salmos 27:1", livro: "PSA", capitulo: 27, texto: "O Senhor é a minha luz e a minha salvação; a quem temerei? O Senhor é a força da minha vida; de quem me recearei?" },
  { referencia: "Salmos 46:1", livro: "PSA", capitulo: 46, texto: "Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia." },
  { referencia: "Salmos 37:5", livro: "PSA", capitulo: 37, texto: "Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará." },
  { referencia: "Salmos 55:22", livro: "PSA", capitulo: 55, texto: "Lança o teu fardo sobre o Senhor, e ele te susterá; nunca permitirá que o justo seja abalado." },
  { referencia: "Salmos 90:12", livro: "PSA", capitulo: 90, texto: "Ensina-nos a contar os nossos dias de tal maneira que alcancemos corações sábios." },
  { referencia: "Salmos 91:1", livro: "PSA", capitulo: 91, texto: "Aquele que habita no esconderijo do Altíssimo, à sombra do Todo-Poderoso descansará." },
  { referencia: "Salmos 118:24", livro: "PSA", capitulo: 118, texto: "Este é o dia que o Senhor fez; regozijemo-nos, e alegremo-nos nele." },
  { referencia: "Salmos 119:105", livro: "PSA", capitulo: 119, texto: "Lâmpada para os meus pés é a tua palavra, e luz para o meu caminho." },
  { referencia: "Salmos 121:1-2", livro: "PSA", capitulo: 121, texto: "Elevo os meus olhos para os montes; de onde me vem o socorro? O meu socorro vem do Senhor, que fez os céus e a terra." },
  { referencia: "Salmos 139:14", livro: "PSA", capitulo: 139, texto: "Eu te louvarei, porque de um modo tão admirável e maravilhoso fui formado; maravilhosas são as tuas obras, e a minha alma o sabe muito bem." },
  { referencia: "Salmos 34:8", livro: "PSA", capitulo: 34, texto: "Provai, e vede que o Senhor é bom; bem-aventurado o homem que nele se refugia." },
  { referencia: "Salmos 16:8", livro: "PSA", capitulo: 16, texto: "Tenho posto o Senhor continuamente diante de mim; porquanto ele está à minha mão direita, não serei abalado." },
  { referencia: "Salmos 4:8", livro: "PSA", capitulo: 4, texto: "Em paz me deitarei e dormirei, porque só tu, Senhor, me fazes habitar em segurança." },
  { referencia: "Salmos 30:5", livro: "PSA", capitulo: 30, texto: "Porque a sua ira dura só um momento; no seu favor está a vida. O choro pode durar uma noite; pela manhã, porém, vem o cântico de júbilo." },
  { referencia: "Salmos 32:8", livro: "PSA", capitulo: 32, texto: "Instruir-te-ei, e ensinar-te-ei o caminho que deves seguir; aconselhar-te-ei, tendo-te sob a minha vista." },
  { referencia: "Salmos 51:10", livro: "PSA", capitulo: 51, texto: "Cria em mim, ó Deus, um coração puro, e renova em mim um espírito estável." },
  { referencia: "Salmos 62:1", livro: "PSA", capitulo: 62, texto: "Somente em Deus espera silenciosa a minha alma; dele vem a minha salvação." },
  { referencia: "Salmos 100:4", livro: "PSA", capitulo: 100, texto: "Entrai pelas suas portas com ação de graças, e em seus átrios com louvor; dai-lhe graças e bendizei o seu nome." },
  { referencia: "Salmos 103:2", livro: "PSA", capitulo: 103, texto: "Bendize, ó minha alma, ao Senhor, e não te esqueças de nenhum dos seus benefícios." },
  { referencia: "Salmos 145:18", livro: "PSA", capitulo: 145, texto: "Perto está o Senhor de todos os que o invocam, de todos os que o invocam em verdade." },
  { referencia: "Provérbios 3:5-6", livro: "PRO", capitulo: 3, texto: "Confia no Senhor de todo o teu coração, e não te estribes no teu próprio entendimento. Reconhece-o em todos os teus caminhos, e ele endireitará as tuas veredas." },
  { referencia: "Provérbios 16:3", livro: "PRO", capitulo: 16, texto: "Entrega ao Senhor as tuas obras, e teus desígnios serão estabelecidos." },
  { referencia: "Provérbios 4:23", livro: "PRO", capitulo: 4, texto: "Guarda com toda a diligência o teu coração, porque dele procedem as fontes da vida." },
  { referencia: "Provérbios 15:1", livro: "PRO", capitulo: 15, texto: "A resposta branda desvia o furor, mas a palavra dura suscita a ira." },
  { referencia: "Provérbios 17:17", livro: "PRO", capitulo: 17, texto: "O amigo ama em todo o tempo; e para a angústia nasce o irmão." },
  { referencia: "Provérbios 18:10", livro: "PRO", capitulo: 18, texto: "Torre forte é o nome do Senhor; para ela corre o justo, e está seguro." },
  { referencia: "Provérbios 3:27", livro: "PRO", capitulo: 3, texto: "Não negues o bem a quem de direito, estando no teu poder fazê-lo." },
  { referencia: "Isaías 26:3", livro: "ISA", capitulo: 26, texto: "Tu conservarás em paz aquele cuja mente está firme em ti; porque ele confia em ti." },
  { referencia: "Isaías 43:2", livro: "ISA", capitulo: 43, texto: "Quando passares pelas águas, eu serei contigo; quando pelos rios, eles não te submergirão; quando passares pelo fogo, não te queimarás, nem a chama arderá em ti." },
  { referencia: "Isaías 12:2", livro: "ISA", capitulo: 12, texto: "Eis que Deus é a minha salvação; eu confiarei e não temerei porque o Senhor, sim o Senhor é a minha força e o meu cântico; e se tornou a minha salvação." },
  { referencia: "Jeremias 29:11", livro: "JER", capitulo: 29, texto: "Pois eu bem sei os planos que estou projetando para vós, diz o Senhor; planos de paz, e não de mal, para vos dar um futuro e uma esperança." },
  { referencia: "Lamentações 3:22-23", livro: "LAM", capitulo: 3, texto: "A benignidade do Senhor jamais acaba, as suas misericórdias não têm fim; renovam-se cada manhã. Grande é a tua fidelidade." },
  { referencia: "Josué 1:9", livro: "JOS", capitulo: 1, texto: "Não to mandei eu? Esforça-te, e tem bom ânimo; não te atemorizes, nem te espantes; porque o Senhor teu Deus está contigo, por onde quer que andares." },
  { referencia: "Deuteronômio 31:8", livro: "DEU", capitulo: 31, texto: "O Senhor, pois, é aquele que vai adiante de ti; ele será contigo, não te deixará, nem te desamparará. Não temas, nem te espantes." },
  { referencia: "Números 6:24-26", livro: "NUM", capitulo: 6, texto: "O Senhor te abençoe e te guarde; o Senhor faça resplandecer o seu rosto sobre ti, e tenha misericórdia de ti; o Senhor levante sobre ti o seu rosto, e te dê a paz." },
  { referencia: "Miquéias 6:8", livro: "MIC", capitulo: 6, texto: "Ele te declarou, ó homem, o que é bom; e que é o que o Senhor requer de ti, senão que pratiques a justiça, e ames a benevolência, e andes humildemente com o teu Deus?" },
  { referencia: "Sofonias 3:17", livro: "ZEP", capitulo: 3, texto: "O Senhor teu Deus está no meio de ti, poderoso para te salvar; ele se deleitará em ti com alegria; renovar-te-á no seu amor, regozijar-se-á em ti com júbilo." },
  { referencia: "Naum 1:7", livro: "NAM", capitulo: 1, texto: "O Senhor é bom, uma fortaleza no dia da angústia; e conhece os que nele confiam." },
  { referencia: "Eclesiastes 3:1", livro: "ECC", capitulo: 3, texto: "Tudo tem a sua ocasião própria, e há tempo para todo propósito debaixo do céu." },
  { referencia: "Mateus 5:9", livro: "MAT", capitulo: 5, texto: "Bem-aventurados os pacificadores, porque eles serão chamados filhos de Deus." },
  { referencia: "Mateus 6:34", livro: "MAT", capitulo: 6, texto: "Não vos inquieteis, pois, pelo dia de amanhã; porque o dia de amanhã cuidará de si mesmo. Basta a cada dia o seu mal." },
  { referencia: "Mateus 7:7", livro: "MAT", capitulo: 7, texto: "Pedí, e dar-se-vos-á; buscai, e achareis; batei e abrir-se-vos-á." },
  { referencia: "Mateus 11:28", livro: "MAT", capitulo: 11, texto: "Vinde a mim, todos os que estai cansados e oprimidos, e eu vos aliviarei." },
  { referencia: "Mateus 6:33", livro: "MAT", capitulo: 6, texto: "Mas buscai primeiro o seu reino e a sua justiça, e todas estas coisas vos serão acrescentadas." },
  { referencia: "Marcos 11:24", livro: "MRK", capitulo: 11, texto: "Por isso vos digo que tudo o que pedirdes em oração, crede que o recebereis, e tê-lo-eis." },
  { referencia: "Lucas 6:31", livro: "LUK", capitulo: 6, texto: "Assim como quereis que os homens vos façam, do mesmo modo lhes fazei vós também." },
  { referencia: "João 3:16", livro: "JHN", capitulo: 3, texto: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna." },
  { referencia: "João 8:12", livro: "JHN", capitulo: 8, texto: "Então Jesus tornou a falar-lhes, dizendo: Eu sou a luz do mundo; quem me segue de modo algum andará em trevas, mas terá a luz da vida." },
  { referencia: "João 14:1", livro: "JHN", capitulo: 14, texto: "Não se turbe o vosso coração; credes em Deus, crede também em mim." },
  { referencia: "João 14:27", livro: "JHN", capitulo: 14, texto: "Deixo-vos a paz, a minha paz vos dou; eu não vo-la dou como o mundo a dá. Não se turbe o vosso coração, nem se atemorize." },
  { referencia: "João 15:12", livro: "JHN", capitulo: 15, texto: "O meu mandamento é este: Que vos ameis uns aos outros, assim como eu vos amei." },
  { referencia: "João 16:33", livro: "JHN", capitulo: 16, texto: "Tenho-vos dito estas coisas, para que em mim tenhais paz. No mundo tereis tribulações; mas tende bom ânimo, eu venci o mundo." },
  { referencia: "Romanos 8:28", livro: "ROM", capitulo: 8, texto: "E sabemos que todas as coisas concorrem para o bem daqueles que amam a Deus, daqueles que são chamados segundo o seu propósito." },
  { referencia: "Romanos 15:13", livro: "ROM", capitulo: 15, texto: "Ora, o Deus de esperança vos encha de todo o gozo e paz na vossa fé, para que abundeis na esperança pelo poder do Espírito Santo." },
  { referencia: "Romanos 12:2", livro: "ROM", capitulo: 12, texto: "E não vos conformeis a este mundo, mas transformai-vos pela renovação da vossa mente, para que experimenteis qual seja a boa, agradável, e perfeita vontade de Deus." },
  { referencia: "1 Coríntios 16:14", livro: "1CO", capitulo: 16, texto: "Todas as vossas obras sejam feitas em amor." },
  { referencia: "Gálatas 6:9", livro: "GAL", capitulo: 6, texto: "E não nos cansemos de fazer o bem, porque a seu tempo ceifaremos, se não houvermos desfalecido." },
  { referencia: "Efésios 4:32", livro: "EPH", capitulo: 4, texto: "Antes sede bondosos uns para com os outros, compassivos, perdoando-vos uns aos outros, como também Deus vos perdoou em Cristo." },
  { referencia: "Filipenses 4:6-7", livro: "PHP", capitulo: 4, texto: "Não andeis ansiosos por coisa alguma; antes em tudo sejam os vossos pedidos conhecidos diante de Deus pela oração e súplica com ações de graças; e a paz de Deus, que excede todo o entendimento, guardará os vossos corações e os vossos pensamentos em Cristo Jesus." },
  { referencia: "Filipenses 4:13", livro: "PHP", capitulo: 4, texto: "Posso todas as coisas naquele que me fortalece." },
  { referencia: "Filipenses 4:19", livro: "PHP", capitulo: 4, texto: "Meu Deus suprirá todas as vossas necessidades segundo as suas riquezas na glória em Cristo Jesus." },
  { referencia: "1 Tessalonicenses 5:16-18", livro: "1TH", capitulo: 5, texto: "Regozijai-vos sempre. Orai sem cessar. Em tudo dai graças; porque esta é a vontade de Deus em Cristo Jesus para convosco." },
  { referencia: "2 Timóteo 1:7", livro: "2TI", capitulo: 1, texto: "Porque Deus não nos deu o espírito de covardia, mas de poder, de amor e de moderação." },
  { referencia: "Hebreus 11:1", livro: "HEB", capitulo: 11, texto: "Ora, a fé é o firme fundamento das coisas que se esperam, e a prova das coisas que não se vêem." },
  { referencia: "Hebreus 13:5", livro: "HEB", capitulo: 13, texto: "Seja a vossa vida isenta de ganância, contentando-vos com o que tendes; porque ele mesmo disse: Não te deixarei, nem te desampararei." },
  { referencia: "Tiago 1:5", livro: "JAS", capitulo: 1, texto: "Ora, se algum de vós tem falta de sabedoria, peça-a a Deus, que a todos dá liberalmente e não censura, e ser-lhe-á dada." },
  { referencia: "Tiago 1:19", livro: "JAS", capitulo: 1, texto: "Sabei isto, meus amados irmãos: Todo homem seja pronto para ouvir, tardio para falar e tardio para se irar." },
  { referencia: "1 João 4:18", livro: "1JN", capitulo: 4, texto: "No amor não há medo antes o perfeito amor lança fora o medo; porque o medo envolve castigo; e quem tem medo não está aperfeiçoado no amor." },
  { referencia: "1 João 4:19", livro: "1JN", capitulo: 4, texto: "Nós amamos, porque ele nos amou primeiro." },
  { referencia: "Apocalipse 21:4", livro: "REV", capitulo: 21, texto: "Ele enxugará de seus olhos toda lágrima; e não haverá mais morte, nem haverá mais pranto, nem lamento, nem dor; porque já as primeiras coisas são passadas." },
]

/**
 * O verso de um dia: anda pela lista com um passo primo com o tamanho dela, então percorre todos
 * antes de repetir, mistura os livros e nunca repete em dias seguidos. Igual em todo aparelho.
 */
export function versoDoDia(data: string) {
  const dia = Math.floor(deDataISO(data).toMillis() / 86_400_000)
  const passo = 37
  return VERSOS[(((dia * passo) % VERSOS.length) + VERSOS.length) % VERSOS.length]
}
