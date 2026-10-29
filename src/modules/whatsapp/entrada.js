// O que fazer com cada mensagem que chega pelo webhook (decisão 38): o código liga o número à conta;
// o texto de quem já está ligado vai para o assistente (Claude), que lança no app. Os lembretes
// saem por outro caminho (src/lembretes/canais/whatsapp.js).
const db = require('../../config/db');
const env = require('../../config/env');
const claude = require('../../lib/claude');
const whatsapp = require('../../lib/whatsapp');
const assistente = require('./assistente');
const service = require('./service');

const TEXTOS = {
  vinculado: (nome) =>
    `Pronto, ${nome}! Este WhatsApp agora está ligado à sua conta do Minha Assistente.`,
  codigoInvalido: 'Esse código não vale (ou já venceu). Gere outro no app, em Configurações → WhatsApp, e mande aqui.',
  desconhecido:
    'Olá! Este é o número do Minha Assistente. Para usar, abra o app em Configurações → WhatsApp e mande aqui o código de 6 dígitos.',
  emBreve: (nome) =>
    `Oi, ${nome}! Recebi sua mensagem. Por enquanto eu mando os seus lembretes por aqui; logo vou anotar contas e agendamentos também.`,
  soTexto: 'Por enquanto eu só entendo mensagens de texto. Escreva, por exemplo: "almoço 45,90" ou "dentista dia 18 às 15h".',
  longa: 'Essa mensagem ficou longa demais para mim. Mande em partes menores, um lançamento por vez.',
  limite: 'Recebi muitas mensagens seguidas. Espere um pouco e mande de novo.',
};

// Quem erra o código muitas vezes para de ser atendido por um tempo (6 dígitos dá para chutar).
// O limite geral (somando todos os números) impede chutar trocando de número: com 30 erros por
// hora, a chance de acertar um código pendente fica perto de 1 em 30 mil por hora. Ao passar
// dele, ninguém liga número por até 1 h (incômodo, mas não abre a conta de ninguém).
// Também não respondemos de novo, dentro de uma hora, a quem não tem conta: cada resposta custa.
// Cada mensagem para o assistente é uma chamada paga ao Claude: no máximo 40 por hora por número.
const JANELA_MS = 60 * 60_000;
const MAX_ERROS = 5;
const MAX_ERROS_GERAL = 30;
const MAX_CONVERSAS = 40;
const MAX_CARACTERES = 1000;

/** Contadores em memória, por número. Fábrica: cada app (e cada teste) tem os seus. */
function criarControle() {
  const erros = new Map();
  let errosGerais = [];
  const avisados = new Map();
  const conversas = new Map();
  const filas = new Map();
  const vivos = (lista, agora) => (lista ?? []).filter((t) => agora - t < JANELA_MS);
  return {
    /** Conta uma mensagem para o assistente; false se o número passou do limite da hora. */
    podeConversar(telefone, agora) {
      const lista = vivos(conversas.get(telefone), agora);
      if (lista.length >= MAX_CONVERSAS) return false;
      conversas.set(telefone, [...lista, agora]);
      return true;
    },
    /** Roda `tarefa` depois das anteriores do mesmo número (a Meta pode mandar duas de uma vez). */
    emFila(telefone, tarefa) {
      const anterior = filas.get(telefone) ?? Promise.resolve();
      const atual = anterior.then(tarefa, tarefa);
      const fim = atual.catch(() => {});
      filas.set(telefone, fim);
      void fim.then(() => filas.get(telefone) === fim && filas.delete(telefone));
      return atual;
    },
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

/** "sim"/"não" sozinhos (com variações comuns); null para qualquer outro texto. */
function respostaCurta(texto) {
  const limpo = texto.trim().toLowerCase().replace(/[\s.!]+$/, '');
  if (/^(sim|s|confirmo|confirma|pode lançar|pode lancar)$/.test(limpo)) return 'sim';
  if (/^(não|nao|n|cancela|cancelar)$/.test(limpo)) return 'nao';
  return null;
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
  if (!usuario) return controle.jaAvisado(de, agora) ? null : TEXTOS.desconhecido;
  if (!claude.ativo()) return TEXTOS.emBreve(usuario.nome);
  if (!controle.podeConversar(de, agora)) return controle.jaAvisado(`limite:${de}`, agora) ? null : TEXTOS.limite;
  if (mensagem.type !== 'text') return TEXTOS.soTexto;
  if (texto.length > MAX_CARACTERES) return TEXTOS.longa;
  // "SIM"/"NÃO" a um lançamento acima do limite não passa pelo Claude; sem nada esperando, segue.
  const resposta = respostaCurta(texto);
  if (resposta) {
    const final = await assistente.responderConfirmacao(usuario, texto.trim(), resposta === 'sim', agora);
    if (final) return final;
  }
  if (/^\s*desfa(z|zer)[\s.!]*$/i.test(texto)) {
    await assistente.descartarPendentes(usuario.id);
    return assistente.desfazerUltimo(usuario.id, agora);
  }
  try {
    return await assistente.responder(usuario, texto.trim(), agora);
  } catch (erro) {
    console.error('WhatsApp: falha do assistente', erro.message);
    return assistente.TEXTOS.falhou;
  }
}

/**
 * Trata o corpo de um POST do webhook (já com a assinatura conferida). Uma falha numa mensagem não
 * impede as outras. `agora` em ms (os testes fixam).
 */
async function processar(corpo, controle, agora = Date.now()) {
  for (const mensagem of mensagensDoCorpo(corpo)) {
    try {
      if (!(await primeiraVez(mensagem.id))) continue;
      await controle.emFila(mensagem.from, async () => {
        const resposta = await responder(mensagem, controle, agora);
        if (resposta) await whatsapp.enviarTexto(mensagem.from, resposta);
      });
    } catch (erro) {
      console.error('WhatsApp: falha ao tratar a mensagem', mensagem.id, erro.message);
    }
  }
}

/** Apaga os ids de mensagens com mais de 7 dias (a Meta só reenvia por alguns dias). */
const limparMensagensAntigas = (conexao = db) =>
  conexao('whatsappMensagem').where('recebidaEm', '<', conexao.raw("now() - interval '7 days'")).del();

module.exports = { processar, criarControle, codigoNoTexto, limparMensagensAntigas, TEXTOS };
