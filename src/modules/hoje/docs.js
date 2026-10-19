const { filtro, marcacao, tarefa, tarefasDoDia } = require('./schema');
const { respostaJson, respostasErro, parametrosQuery, corpoJson, ERRO_AUTH } = require('../../docs/helpers');

const TAG = ['Hoje'];

module.exports = {
  paths: {
    '/hoje': {
      get: {
        tags: TAG,
        summary: 'Tarefas do dia',
        description: [
          'Lista única com o que ocorre no dia: remédios (um item por horário), agenda (rádio, atividade',
          'física e fisioterapia com categoria própria; recorrentes expandidos), compromissos do dia da',
          'semana, viagens (ida/volta) e contas que vencem no dia. Olhando hoje, entram também as contas',
          'vencidas antes e ainda pendentes. Ordem de horário; itens sem horário (dia todo) no fim.',
        ].join(' '),
        parameters: parametrosQuery(filtro),
        responses: {
          200: respostaJson('Tarefas do dia', tarefasDoDia),
          ...respostasErro({ 400: 'Data inválida (VALIDACAO)', ...ERRO_AUTH }),
        },
      },
    },
    '/hoje/{id}': {
      patch: {
        tags: TAG,
        summary: 'Marca uma tarefa como feita, não feita ou pendente',
        description: [
          'O ✓ de remédio, compromisso e despesa vale no próprio módulo (tomado, concluído, pago — o mesmo',
          'que "Marcar como pago"); voltar para pendente desfaz. Os demais ficam só no registro do dia.',
        ].join(' '),
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { ...corpoJson(marcacao), required: true },
        responses: {
          200: respostaJson('Tarefa atualizada', tarefa),
          ...respostasErro({
            400: 'Tarefa ou status inválido; conta com valor a definir (VALIDACAO)',
            ...ERRO_AUTH,
            404: 'Tarefa não encontrada no dia (NAO_ENCONTRADO)',
          }),
        },
      },
    },
  },
};
