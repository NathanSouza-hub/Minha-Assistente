// Deve ser o primeiro require de cada arquivo de teste.
process.env.NODE_ENV = 'test';
require('dotenv').config({ quiet: true });

process.env.SEED_USUARIA_NOME ??= 'Débora Teste';
process.env.SEED_USUARIA_EMAIL ??= 'debora@teste.local';
process.env.SEED_USUARIA_SENHA ??= 'senha-de-teste';
