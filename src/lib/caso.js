// Conversão de nomes entre o banco (snake_case) e a API (camelCase).

const paraSnake = (nome) => nome.replace(/[A-Z]/g, (letra) => `_${letra.toLowerCase()}`);

const paraCamel = (nome) => nome.replace(/_([a-z0-9])/g, (_, letra) => letra.toUpperCase());

const ehObjetoSimples = (valor) => {
  if (valor === null || typeof valor !== 'object') return false;
  const proto = Object.getPrototypeOf(valor);
  return proto === Object.prototype || proto === null;
};

// Converte recursivamente as chaves de objetos simples e arrays; outros valores passam intactos.
function chavesParaCamel(valor) {
  if (Array.isArray(valor)) return valor.map(chavesParaCamel);
  if (!ehObjetoSimples(valor)) return valor;
  const resultado = {};
  for (const [chave, item] of Object.entries(valor)) {
    resultado[paraCamel(chave)] = chavesParaCamel(item);
  }
  return resultado;
}

module.exports = { paraSnake, paraCamel, chavesParaCamel };
