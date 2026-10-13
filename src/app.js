const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const env = require('./config/env');
const db = require('./config/db');
const { montarOpenApi } = require('./docs/openapi');
const { AppError } = require('./lib/erros');
const { tratarErro, rotaNaoEncontrada } = require('./middlewares/erro');
const { rotasAuth } = require('./modules/auth/routes');

function criarApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Swagger antes do helmet: a UI usa scripts e estilos que a CSP padrão bloquearia.
  const openapi = montarOpenApi();
  app.get('/docs.json', (req, res) => res.json(openapi));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS.length ? env.CORS_ORIGINS : false }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/saude', async (req, res) => {
    try {
      await db.raw('select 1');
    } catch {
      throw new AppError(503, 'BANCO_INDISPONIVEL', 'Banco de dados indisponível.');
    }
    res.json({ status: 'ok', banco: 'ok' });
  });

  app.use('/auth', rotasAuth());
  // Módulos protegidos: app.use('/<recurso>', autenticar, rotas<Recurso>()).

  app.use(rotaNaoEncontrada);
  app.use(tratarErro);
  return app;
}

module.exports = { criarApp };
