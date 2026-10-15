const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const env = require('./config/env');
const db = require('./config/db');
const { montarOpenApi } = require('./docs/openapi');
const { AppError } = require('./lib/erros');
const { tratarErro, rotaNaoEncontrada } = require('./middlewares/erro');
const { autenticar } = require('./middlewares/autenticar');
const { rotasAuth } = require('./modules/auth/routes');
const { rotasImoveis } = require('./modules/imoveis/routes');
const { rotasCategorias } = require('./modules/categorias/routes');
const { rotasPagamentos } = require('./modules/pagamentos/routes');
const { rotasCartoes } = require('./modules/cartoes/routes');
const { rotasRelatorios } = require('./modules/relatorios/routes');
const { rotasEventos } = require('./modules/eventos/routes');
const { rotasMedicamentos } = require('./modules/medicamentos/routes');
const { rotasRotinas } = require('./modules/rotinas/routes');
const { rotasHoje } = require('./modules/hoje/routes');
const { rotasViagens } = require('./modules/viagens/routes');
const { rotasCompras } = require('./modules/compras/routes');
const { rotasNotificacoes } = require('./modules/notificacoes/routes');

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

  // Módulos protegidos: tudo abaixo exige token e filtra pelo usuário.
  app.use('/imoveis', autenticar, rotasImoveis());
  app.use('/categorias-pagamento', autenticar, rotasCategorias());
  app.use('/pagamentos', autenticar, rotasPagamentos());
  app.use('/cartoes', autenticar, rotasCartoes());
  app.use('/relatorios', autenticar, rotasRelatorios());
  app.use('/eventos', autenticar, rotasEventos());
  app.use('/medicamentos', autenticar, rotasMedicamentos());
  app.use('/rotinas', autenticar, rotasRotinas());
  app.use('/hoje', autenticar, rotasHoje());
  app.use('/viagens', autenticar, rotasViagens());
  app.use('/compras', autenticar, rotasCompras());
  app.use('/notificacoes', autenticar, rotasNotificacoes());

  app.use(rotaNaoEncontrada);
  app.use(tratarErro);
  return app;
}

module.exports = { criarApp };
