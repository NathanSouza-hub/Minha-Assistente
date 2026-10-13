// Valida body, query e params com Zod. Os valores já convertidos ficam em req.validado,
// porque no Express 5 req.query é somente leitura.
function validar({ body, query, params } = {}) {
  return (req, res, next) => {
    req.validado = {
      body: body ? body.parse(req.body ?? {}) : req.body,
      query: query ? query.parse(req.query) : req.query,
      params: params ? params.parse(req.params) : req.params,
    };
    next();
  };
}

module.exports = { validar };
