// Deve ser o primeiro require de cada arquivo de teste.
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
// Anexos dos testes vão para uma pasta temporária, não para uploads/ do projeto.
process.env.UPLOADS_DIR = path.join(os.tmpdir(), 'minha-assistente-test-uploads');
require('dotenv').config({ quiet: true });
