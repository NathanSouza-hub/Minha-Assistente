// Serviços de push dos navegadores. O servidor faz POST no endpoint da inscrição, então só
// aceitamos estes hosts: um endpoint qualquer faria o servidor chamar endereços internos (SSRF).
const HOSTS = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'];
// Subdomínios aceitos (ex.: wns2-bl2p.notify.windows.com do Edge no Windows).
const SUFIXOS = ['.push.apple.com', '.notify.windows.com'];

/** true se o endpoint é https, na porta padrão, de um serviço de push conhecido. */
function endpointPermitido(endpoint) {
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.port !== '' || url.username || url.password) return false;
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  return HOSTS.includes(host) || SUFIXOS.some((s) => host.endsWith(s));
}

module.exports = { endpointPermitido };
