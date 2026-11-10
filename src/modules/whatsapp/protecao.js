// Última barreira antes de a resposta do assistente sair pelo WhatsApp: se o texto tiver cara de
// informação técnica (código, SQL, chaves, tokens, variáveis de ambiente, caminhos, nomes de
// tabela/campo, nome do modelo de IA, trechos das instruções), ele é trocado por uma recusa
// educada. Não depende de a IA obedecer ao prompt. Os textos da própria pessoa (descrições,
// nomes, títulos) são tirados antes de conferir, para um gasto chamado "Token do metrô" não
// virar recusa.
const { normalizar } = require('./formato');

const PADROES = [
  /sk-ant-/i, // chave da Anthropic
  /\beyJ[\w-]{8,}\.[\w-]+/, // JWT
  /\b[A-Za-z0-9]+_[A-Za-z0-9_]+\b/, // snake_case e VARIAVEIS_DE_AMBIENTE (tabelas, campos, ferramentas)
  /\b[a-z]{2,}[A-Z][A-Za-z0-9]*\b/, // camelCase (campos, funções)
  /```/, // bloco de código
  /=>|\brequire\s*\(|\bmodule\.exports\b|\bfunction\s*\(|\bconsole\.\w+/,
  /\b(select|insert|update|delete)\b[\s\S]{0,80}\b(from|into|set|where)\b/i, // SQL
  /\b(postgres(ql)?|mysql|mongodb|redis):\/\//i,
  /\b(localhost|127\.0\.0\.1|0\.0\.0\.0)\b/i,
  /\b(src|db|test|config|lib|node_modules|deploy|docs)\/[\w./-]+/i, // caminhos do projeto
  /\.(js|ts|json|env|sql|ya?ml|sh)\b/i,
  /\b[A-Z]:\\|\/(home|var|etc|opt|root|usr)\//, // caminhos do sistema
  /\b(claude|haiku|sonnet|opus|anthropic|openai|chatgpt|gpt-?\d|llm)\b/i, // modelo de IA
  /\b(tokens?|api[\s-]?keys?|chaves? (de api|secretas?|privadas?)|jwt|secrets?|vari[áa]ve(l|is) de ambiente)\b/i,
  /\b(banco de dados|database|sql|schema|stack ?trace|endpoint|webhook)\b/i,
  /\b(system prompt|prompt|instru[çc][õo]es (do sistema|internas)|minhas instru[çc][õo]es)\b/i,
];

const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Repetir as instruções = 7 palavras seguidas iguais às de uma regra (sem acento nem pontuação).
const PALAVRAS_SEGUIDAS = 7;
const palavras = (texto) => normalizar(texto).replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ');
function sequencias(texto) {
  const lista = palavras(texto);
  const saida = [];
  for (let i = 0; i + PALAVRAS_SEGUIDAS <= lista.length; i += 1) saida.push(lista.slice(i, i + PALAVRAS_SEGUIDAS).join(' '));
  return saida;
}

/**
 * true se a resposta parece vazar informação técnica. `valores`: textos da pessoa que podem
 * aparecer na resposta. `instrucoes`: as regras do prompt, que nunca devem ser repetidas.
 */
function vazaInformacaoTecnica(texto, { valores = [], instrucoes = [] } = {}) {
  let limpo = texto;
  // Os mais longos primeiro, para "Token do metrô" sair inteiro antes de "Token".
  const daPessoa = [...valores].filter((v) => v.trim().length >= 2).sort((a, b) => b.length - a.length);
  for (const valor of daPessoa) limpo = limpo.replace(new RegExp(escapar(valor), 'gi'), ' ');
  if (PADROES.some((padrao) => padrao.test(limpo))) return true;
  const daResposta = new Set(sequencias(limpo));
  return instrucoes.some((regra) => sequencias(regra).some((s) => daResposta.has(s)));
}

/** Corta respostas longas abaixo do limite do WhatsApp (4.096 caracteres), numa quebra de linha. */
const LIMITE = 3800;
function caberNoWhatsApp(texto) {
  if (texto.length <= LIMITE) return texto;
  const corte = texto.lastIndexOf('\n', LIMITE);
  return `${texto.slice(0, corte > LIMITE / 2 ? corte : LIMITE).trimEnd()}\n…(mensagem cortada; peça um período ou filtro menor)`;
}

module.exports = { vazaInformacaoTecnica, caberNoWhatsApp };
