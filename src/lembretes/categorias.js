// Categorias de aviso que a pessoa liga e desliga em Notificações (usuario.avisos_desligados).
// Cada origem de lembrete pertence a uma; o resumo da manhã tem a própria preferência.
const CATEGORIA_DA_ORIGEM = {
  evento: 'agenda',
  medicamento_horario: 'remedios',
  pagamento: 'contas',
  rotina: 'compromissos',
  tarefa: 'tarefas',
};

const CATEGORIAS = ['agenda', 'remedios', 'contas', 'compromissos', 'tarefas'];

/** Origens (origem_tipo) de uma categoria, para cancelar os pendentes dela. */
const origensDa = (categoria) =>
  Object.entries(CATEGORIA_DA_ORIGEM)
    .filter(([, c]) => c === categoria)
    .map(([origem]) => origem);

module.exports = { CATEGORIA_DA_ORIGEM, CATEGORIAS, origensDa };
