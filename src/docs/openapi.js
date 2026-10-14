// Documento OpenAPI base. Cada módulo acrescenta seus paths via docs.js.
const { version } = require('../../package.json');

const modulos = [
  require('../modules/auth/docs'),
  require('../modules/imoveis/docs'),
  require('../modules/categorias/docs'),
  require('../modules/pagamentos/docs'),
  require('../modules/relatorios/docs'),
  require('../modules/eventos/docs'),
  require('../modules/medicamentos/docs'),
  require('../modules/rotinas/docs'),
  require('../modules/hoje/docs'),
  require('../modules/viagens/docs'),
];

function montarOpenApi() {
  const paths = {};
  for (const doc of modulos) Object.assign(paths, doc.paths);

  return {
    openapi: '3.1.0',
    info: {
      title: 'Minha Assistente — API',
      version,
      description: [
        'Back-end de uma secretária pessoal multiusuário.',
        '',
        '- JSON em camelCase; datas ISO 8601 no fuso America/Sao_Paulo.',
        '- Dinheiro em centavos inteiros (15990 = R$ 159,90).',
        '- Erros: `{ "erro": { "codigo": "STRING", "mensagem": "texto" } }`.',
      ].join('\n'),
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/saude': {
        get: {
          tags: ['Sistema'],
          summary: 'Verifica se a API e o banco estão no ar',
          security: [],
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { status: { const: 'ok' }, banco: { const: 'ok' } },
                  },
                },
              },
            },
            503: { $ref: '#/components/responses/Erro' },
          },
        },
      },
      ...paths,
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        Erro: {
          type: 'object',
          required: ['erro'],
          properties: {
            erro: {
              type: 'object',
              required: ['codigo', 'mensagem'],
              properties: {
                codigo: { type: 'string', examples: ['VALIDACAO'] },
                mensagem: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        Erro: {
          description: 'Erro',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
        },
      },
    },
  };
}

module.exports = { montarOpenApi, modulos };
