// Monta trechos OpenAPI a partir dos mesmos esquemas Zod usados na validação.
const { z } = require('../lib/zod');

function jsonSchema(esquema, io) {
  // eslint-disable-next-line no-unused-vars -- $schema não pertence ao objeto OpenAPI
  const { $schema, ...resto } = z.toJSONSchema(esquema, { io, unrepresentable: 'any' });
  return resto;
}

const corpoJson = (esquema) => ({
  required: true,
  content: { 'application/json': { schema: jsonSchema(esquema, 'input') } },
});

const respostaJson = (descricao, esquema) => ({
  description: descricao,
  content: { 'application/json': { schema: jsonSchema(esquema, 'output') } },
});

const respostaVazia = (descricao) => ({ description: descricao });

// { 400: 'Dados inválidos', 404: '...' } → respostas no formato de erro do contrato.
const respostasErro = (mapa) =>
  Object.fromEntries(
    Object.entries(mapa).map(([status, descricao]) => [
      status,
      {
        description: descricao,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
      },
    ]),
  );

const ERRO_AUTH = { 401: 'Token ausente, inválido ou expirado (NAO_AUTORIZADO)' };

module.exports = { jsonSchema, corpoJson, respostaJson, respostaVazia, respostasErro, ERRO_AUTH };
