// O que fazer com cada mensagem que chega pelo webhook (decisão 38). Fase 1: ligar o número à
// conta pelo código; quem já está ligado recebe um aviso de que o resto vem depois.
const db = require('../../config/db');
const env = require('../../config/env');
const whatsapp = require('../../lib/whatsapp');
const service = require('./service');

const TEXTOS = {
  vinculado: (nome) =>
    `Pronto, ${nome}! Este WhatsApp agora está ligado à sua conta do Minha Assistente.`,
  codigoInvalido: 'Esse código não vale (ou já venceu). Gere outro no app, em Configurações → WhatsApp, e mande aqui.',
  desconhecido:
    'Olá! Este é o número do Minha Assistente. Para usar, abra o app em Configurações → WhatsApp e mande aqui o código de 6 dígitos.',
  emBreve: (nome) =>
    `Oi, ${nome}! Recebi sua mensagem. Por enquanto eu só sei ligar este número à sua conta; logo vou anotar contas e agendamentos por aqui.`,
};

// Quem erra o código muitas vezes para de ser atendido por um tempo (6 dígitos dá para chutar).
// O limite geral (somando todos os números) impede chutar trocando de número: com 30 erros por
// hora, a chance de acertar um código pendente fica perto de 1 em 30 mil por hora. Ao passar
// dele, ninguém liga número por até 1 h (incômodo, mas não abre a conta de ninguém).
// Também não respondemos de novo, dentro de uma hora, a quem não tem conta: cada resposta custa.
const JANELA_MS = 60 * 60_000;
const MAX_ERROS = 5;
const MAX_ERROS_GERAL = 30;

/** Contadores em memória, por número. Fábrica: cada app (e cada teste) tem os seus. */
function criarControle() {
  const erros = new Map();
  let errosGerais = [];
  const avisados = new Map();
  const vivos = (lista, agora) => (lista ?? []).filter((t) => agora - t < JANELA_MS);
  return {
    bloqueado(telefone, agora) {
      errosGerais = vivos(errosGerais, agora);
      return errosGerais.length >= MAX_ERROS_GERAL || vivos(erros.get(telefone), agora).length >= MAX_ERROS;
    },
    errou(telefone, agora) {
      erros.set(telefone, [...vivos(erros.get(telefone), agora), agora]);
      errosGerais.push(agora);
    },
    jaAvisado(telefone, agora) {
      const ultimo = avisados.get(telefone);
      if (ultimo && agora - ultimo < JANELA_MS) return true;
      avisados.set(telefone, agora);
      return false;
    },
  };
}

// "123 456", "123-456" ou "Código: 123456" valem; o texto inteiro precisa ser só o código.
function codigoNoTexto(texto) {
  const limpo = texto.trim().replace(/^c[óo]digo:?\s*/i, '');
  return /^\d{3}[\s.-]?\d{3}$/.test(limpo) ? limpo.replace(/\D/g, '') : null;
}

/** As mensagens recebidas no corpo do webhook (status de entrega e outros números ficam de fora). */
function mensagensDoCorpo(corpo) {
  if (corpo?.object !== 'whatsapp_business_account') return [];
  const lista = [];
  for (const entrada of corpo.entry ?? []) {
    for (const mudanca of entrada.changes ?? []) {
      const valor = mudanca.value ?? {};
      if (mudanca.field !== 'messages' || valor.metadata?.phone_number_id !== env.WHATSAPP_NUMERO_ID) continue;
      for (const m of valor.messages ?? []) if (m?.id && /^\d{8,15}$/.test(m.from ?? '')) lista.push(m);
    }
  }
  return lista;
}

/** Grava o id da mensagem; false se ela já tinha chegado (a Meta reenvia). */
async function primeiraVez(id) {
  const inseridas = await db('whatsappMensagem').insert({ id }).onConflict('id').ignore().returning('id');
  return inseridas.length > 0;
}

async function responder(mensagem, controle, agora) {
  const de = mensagem.from;
  const texto = mensagem.type === 'text' ? (mensagem.text?.body ?? '') : '';
  const codigo = codigoNoTexto(texto);

  if (codigo) {
    if (controle.bloqueado(de, agora)) return null;
    const usuario = await service.vincularPorCodigo(de, codigo, new Date(agora));
    if (usuario) return TEXTOS.vinculado(usuario.nome);
    controle.errou(de, agora);
    return TEXTOS.codigoInvalido;
  }

  const usuario = await service.usuarioDoTelefone(de);
  if (usuario) return TEXTOS.emBreve(usuario.nome);
  return controle.jaAvisado(de, agora) ? null : TEXTOS.desconhecido;
}

/**
 * Trata o corpo de um POST do webhook (já com a assinatura conferida). Uma falha numa mensagem não
 * impede as outras. `agora` em ms (os testes fixam).
 */
async function processar(corpo, controle, agora = Date.now()) {
  for (const mensagem of mensagensDoCorpo(corpo)) {
    try {
      if (!(await primeiraVez(mensagem.id))) continue;
      const resposta = await responder(mensagem, controle, agora);
      if (resposta) await whatsapp.enviarTexto(mensagem.from, resposta);
    } catch (erro) {
      console.error('WhatsApp: falha ao tratar a mensagem', mensagem.id, erro.message);
    }
  }
}

/** Apaga os ids de mensagens com mais de 7 dias (a Meta só reenvia por alguns dias). */
const limparMensagensAntigas = (conexao = db) =>
  conexao('whatsappMensagem').where('recebidaEm', '<', conexao.raw("now() - interval '7 days'")).del();

module.exports = { processar, criarControle, codigoNoTexto, limparMensagensAntigas, TEXTOS };
