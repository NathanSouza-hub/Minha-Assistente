// Zod com mensagens padrão em português do Brasil. Importe daqui, não de 'zod'.
const { z } = require('zod');

z.config(z.locales.ptBR());

module.exports = { z };
