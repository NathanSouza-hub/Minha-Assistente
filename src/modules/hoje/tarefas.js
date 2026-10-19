// Tarefas do dia (tela Hoje): uma lista só com o que ocorre no dia em cada módulo, cada item com ✓/✗.
// O "feito" de remédio, compromisso e despesa fica no próprio módulo; o resto em tarefa_registro.
const { DateTime } = require('luxon');
const db = require('../../config/db');
const { FUSO, agora, hoje } = require('../../lib/tempo');
const { naoEncontrado, requisicaoInvalida } = require('../../lib/erros');
const { formatarCentavos } = require('../../lembretes/textos');
const eventos = require('../eventos/service');
const medicamentos = require('../medicamentos/service');
const rotinas = require('../rotinas/service');
const pagamentos = require('../pagamentos/service');

// Tipos de evento com tela própria; os outros ficam como "agenda".
const CATEGORIA_DO_TIPO = { programa_radio: 'radio', atividade_fisica: 'atividade', fisioterapia: 'fisioterapia' };
const LINK_DA_CATEGORIA = { radio: '/radio', atividade: '/atividade-fisica', fisioterapia: '/fisioterapia' };
// Desempate no mesmo horário.
const ORDEM_CATEGORIA = ['remedio', 'agenda', 'radio', 'atividade', 'fisioterapia', 'compromisso', 'viagem', 'despesa'];

const inicialMaiuscula = (texto) => texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1);
const juntar = (partes) => partes.filter(Boolean).join(' · ') || null;
const dataCurta = (iso) => DateTime.fromISO(iso).toFormat('dd/MM');
const somarDias = (dataISO, dias) => DateTime.fromISO(dataISO).plus({ days: dias }).toISODate();

// "<categoria>:<itemId>:<ocorrência>", com a ocorrência "2026-10-19" ou "2026-10-19T08:00".
const montarId = (categoria, itemId, data, horario) =>
  `${categoria}:${itemId}:${horario ? `${data}T${horario}` : data}`;

/**
 * Ocorrência de um módulo: `data`/`horario` identificam a ocorrência (e a linha em tarefa_registro);
 * `exibido` é o horário mostrado no dia (null = "Dia todo"). `feito` vem do próprio módulo
 * (undefined nas categorias que só usam tarefa_registro).
 */
function ocorrencia(categoria, itemId, data, horario, campos) {
  return { categoria, itemId, data, horario, exibido: horario, concluirNoFormulario: false, ...campos };
}

async function doModulos(usuarioId, data) {
  const ehHoje = data === hoje();
  const ontem = somarDias(data, -1);
  const [doDiaEventos, doses, compromissos, contas, vencidas, pagasHoje, viagens] = await Promise.all([
    eventos.listar(usuarioId, { inicio: data, fim: data }),
    medicamentos.doDia(usuarioId, { data }),
    rotinas.doDia(usuarioId, { data }),
    pagamentos.listar(usuarioId, { inicio: data, fim: data }),
    // Olhando hoje, as contas que venceram antes e seguem pendentes também entram (atrasadas), e
    // as que foram pagas hoje continuam na lista (para o ✓ poder ser desfeito).
    ehHoje ? pagamentos.listar(usuarioId, { status: 'pendente', fim: ontem }) : [],
    ehHoje ? pagamentos.listar(usuarioId, { status: 'pago', fim: ontem, dataPagamento: data }) : [],
    db('viagem')
      .where({ usuarioId })
      .where((w) => w.where('ida', data).orWhere('volta', data))
      .select('id', 'destino', 'ida', 'volta', 'transporte'),
  ]);

  return [
    ...doses.map((d) =>
      ocorrencia('remedio', d.horarioId, data, d.hora, {
        titulo: inicialMaiuscula(d.nome),
        detalhe: d.dose,
        link: `/remedios/${d.medicamentoId}`,
        feito: d.tomado,
      }),
    ),
    ...doDiaEventos.map((e) => {
      const inicio = DateTime.fromISO(e.inicio, { zone: FUSO });
      const categoria = CATEGORIA_DO_TIPO[e.tipo] ?? 'agenda';
      return ocorrencia(categoria, e.id, inicio.toISODate(), inicio.toFormat('HH:mm'), {
        // Evento que começou em outro dia e continua neste fica no "Dia todo".
        exibido: inicio.toISODate() === data ? inicio.toFormat('HH:mm') : null,
        titulo: inicialMaiuscula(e.titulo),
        detalhe: e.local,
        link: LINK_DA_CATEGORIA[categoria] ?? `/agenda/${e.id}`,
      });
    }),
    ...compromissos.map((t) =>
      ocorrencia('compromisso', t.rotinaId, data, t.hora, {
        titulo: inicialMaiuscula(t.titulo),
        detalhe: null,
        link: `/rotina/${t.rotinaId}`,
        feito: t.concluida,
      }),
    ),
    ...viagens.map((v) => {
      const trecho = v.ida === v.volta ? 'Ida e volta' : v.ida === data ? 'Ida' : 'Volta';
      return ocorrencia('viagem', v.id, data, null, {
        titulo: `Viagem para ${v.destino}`,
        detalhe: juntar([trecho, v.transporte]),
        link: `/viagens/${v.id}`,
      });
    }),
    ...[...vencidas, ...pagasHoje]
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
      .concat(contas)
      .map((p) =>
      ocorrencia('despesa', p.id, p.vencimento, null, {
        titulo: inicialMaiuscula(p.descricao),
        detalhe: juntar([
          p.valorCentavos === null ? 'Valor a definir' : formatarCentavos(p.valorCentavos),
          p.imovelNome,
          p.vencimento < data && `Venceu em ${dataCurta(p.vencimento)}`,
        ]),
        link: p.cartaoId ? `/cartoes/${p.cartaoId}` : `/pagamentos/${p.id}`,
        feito: p.status === 'pago',
        // Conta da equipe com valor a definir: o valor é informado no formulário dela.
        concluirNoFormulario: p.status === 'pendente' && p.valorCentavos === null,
      }),
    ),
  ];
}

function passou({ data, horario }, momento) {
  if (!horario) return data < momento.toISODate();
  return DateTime.fromISO(`${data}T${horario}`, { zone: FUSO }) < momento;
}

/** Itens do dia no formato da API, em ordem de horário ("Dia todo" no fim). */
async function itens(usuarioId, data) {
  const ocorrencias = await doModulos(usuarioId, data);
  const datas = [...new Set(ocorrencias.map((o) => o.data))];
  const registros = datas.length
    ? await db('tarefaRegistro').where({ usuarioId }).whereIn('dataOcorrencia', datas)
    : [];
  const statusRegistrado = new Map(
    registros.map((r) => [montarId(r.categoria, r.itemId, r.dataOcorrencia, r.horario), r.status]),
  );
  const momento = agora();

  const lista = ocorrencias.map((o) => {
    const id = montarId(o.categoria, o.itemId, o.data, o.horario);
    const registrado = statusRegistrado.get(id);
    // Nas categorias com "feito" no módulo, vale o módulo; de tarefa_registro só o "não feito".
    const status = o.feito ? 'feito' : o.feito === false && registrado === 'feito' ? undefined : registrado;
    return {
      id,
      categoria: o.categoria,
      titulo: o.titulo,
      detalhe: o.detalhe ?? null,
      horario: o.exibido,
      status: status ?? (passou(o, momento) ? 'atrasado' : 'pendente'),
      link: o.link,
      concluirNoFormulario: o.concluirNoFormulario,
      ocorrencia: o,
    };
  });

  // sort é estável: no mesmo horário e categoria fica a ordem do módulo (ex.: a dos compromissos).
  return lista.sort(
    (a, b) =>
      (a.horario ?? '99:99').localeCompare(b.horario ?? '99:99') ||
      ORDEM_CATEGORIA.indexOf(a.categoria) - ORDEM_CATEGORIA.indexOf(b.categoria),
  );
}

const publico = ({ ocorrencia: _, ...item }) => item;

async function listar(usuarioId, { data = hoje() } = {}) {
  const lista = await itens(usuarioId, data);
  const contar = (status) => lista.filter((i) => i.status === status).length;
  return {
    data,
    resumo: {
      programadas: lista.length,
      concluidas: contar('feito'),
      pendentes: contar('pendente'),
      atrasadas: contar('atrasado'),
    },
    tarefas: lista.map(publico),
  };
}

// O ✓ de remédio, compromisso e despesa grava no módulo (as telas deles mostram o mesmo estado).
async function marcarNoModulo(usuarioId, { categoria, itemId, data }, feito) {
  if (categoria === 'remedio') await medicamentos.registrar(usuarioId, { horarioId: itemId, data, tomado: feito });
  if (categoria === 'compromisso') await rotinas.concluir(usuarioId, itemId, { data, concluida: feito });
  if (categoria === 'despesa') {
    const conta = await pagamentos.buscar(usuarioId, itemId);
    if (feito && conta.status === 'pendente') await pagamentos.pagar(usuarioId, itemId, {});
    if (!feito && conta.status === 'pago') await pagamentos.desfazerPagamento(usuarioId, itemId);
  }
}

/** PATCH /hoje/:id: "feito", "nao_feito" ou "pendente" (desfaz). */
async function marcar(usuarioId, id, { status }) {
  const data = id.split(':')[2].slice(0, 10);
  const item = (await itens(usuarioId, data)).find((i) => i.id === id);
  if (!item) throw naoEncontrado('Tarefa', { feminino: true });
  if (status === 'feito' && item.concluirNoFormulario) {
    throw requisicaoInvalida('valorCentavos: Informe o valor pago na própria conta.');
  }

  const { categoria, itemId, data: dataOcorrencia, horario, feito } = item.ocorrencia;
  const temFeitoNoModulo = feito !== undefined;
  if (temFeitoNoModulo) await marcarNoModulo(usuarioId, item.ocorrencia, status === 'feito');

  if (status === 'nao_feito' || (status === 'feito' && !temFeitoNoModulo)) {
    await db('tarefaRegistro')
      .insert({ usuarioId, categoria, itemId, dataOcorrencia, horario, status })
      .onConflict(['usuarioId', 'categoria', 'itemId', 'dataOcorrencia', 'horario'])
      .merge(['status']);
  } else {
    await db('tarefaRegistro')
      .where({ usuarioId, categoria, itemId, dataOcorrencia })
      // `horario = NULL` nunca casa.
      .where((w) => (horario ? w.where({ horario }) : w.whereNull('horario')))
      .del();
  }

  return publico((await itens(usuarioId, data)).find((i) => i.id === id));
}

module.exports = { listar, marcar };
