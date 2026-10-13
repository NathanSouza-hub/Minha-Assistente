// Cria um usuário pela API e devolve token + cabeçalho pronto para as próximas requisições.
const request = require('supertest');

let contador = 0;

async function criarSessao(app, dados = {}) {
  contador += 1;
  const corpo = {
    nome: `Usuário ${contador}`,
    email: `usuario${contador}-${Date.now()}@teste.local`,
    senha: 'senha-de-teste',
    ...dados,
  };
  const res = await request(app).post('/auth/cadastro').send(corpo).expect(201);
  return {
    ...res.body,
    senha: corpo.senha,
    auth: { Authorization: `Bearer ${res.body.token}` },
  };
}

module.exports = { criarSessao };
