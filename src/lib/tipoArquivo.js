// Detecta o tipo real do arquivo pelos primeiros bytes. O Content-Type enviado pelo navegador
// não é confiável, então é ignorado.

const texto = (buffer, inicio, fim) => buffer.subarray(inicio, fim).toString('latin1');

const ASSINATURA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MARCAS_HEIC = ['heic', 'heix', 'mif1', 'msf1'];

const TIPOS = [
  { mime: 'application/pdf', extensao: '.pdf', confere: (b) => texto(b, 0, 5) === '%PDF-' },
  { mime: 'image/jpeg', extensao: '.jpg', confere: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', extensao: '.png', confere: (b) => b.subarray(0, 8).equals(ASSINATURA_PNG) },
  {
    mime: 'image/webp',
    extensao: '.webp',
    confere: (b) => texto(b, 0, 4) === 'RIFF' && texto(b, 8, 12) === 'WEBP',
  },
  {
    mime: 'image/heic',
    extensao: '.heic',
    confere: (b) => texto(b, 4, 8) === 'ftyp' && MARCAS_HEIC.includes(texto(b, 8, 12)),
  },
];

/** @returns {{ mime: string, extensao: string } | null} */
function detectarTipo(buffer) {
  if (!buffer || buffer.length < 12) return null;
  const tipo = TIPOS.find((t) => t.confere(buffer));
  return tipo ? { mime: tipo.mime, extensao: tipo.extensao } : null;
}

const DESCRICAO_TIPOS_ACEITOS = 'PDF ou imagem (JPG, PNG, WEBP, HEIC)';

module.exports = { detectarTipo, DESCRICAO_TIPOS_ACEITOS };
