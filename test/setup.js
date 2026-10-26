// Deve ser o primeiro require de cada arquivo de teste.
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
// Anexos dos testes vão para uma pasta temporária, não para uploads/ do projeto.
process.env.UPLOADS_DIR = path.join(os.tmpdir(), 'minha-assistente-test-uploads');
// Chaves VAPID só para os testes (nenhum push sai de verdade: o envio é simulado). Vêm antes do
// dotenv para valerem mesmo se o .env tiver as chaves de desenvolvimento.
const chaves = require('web-push').generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = chaves.publicKey;
process.env.VAPID_PRIVATE_KEY = chaves.privateKey;
process.env.VAPID_SUBJECT = 'mailto:testes@minha-assistente.local';
// WhatsApp de mentira: nenhuma mensagem sai (os testes simulam whatsapp.enviarTexto ou o fetch).
process.env.WHATSAPP_TOKEN = 'token-de-teste';
process.env.WHATSAPP_NUMERO_ID = '100200300';
process.env.WHATSAPP_NUMERO = '5511999990000';
process.env.WHATSAPP_APP_SECRET = 'segredo-de-teste';
process.env.WHATSAPP_VERIFY_TOKEN = 'verificacao-de-teste';
require('dotenv').config({ quiet: true });
