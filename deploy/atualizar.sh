#!/bin/sh
# Atualiza o app com o código recebido pelo stdin (tar do `git archive`). Usado pelo deploy
# automático (.github/workflows/ci.yml): a chave SSH do GitHub só pode rodar este script
# (command= no authorized_keys) e o commit vem como "comando" do ssh:
#   git archive HEAD | ssh deploy@servidor "$(git rev-parse --short HEAD)"
set -eu

APP=/opt/minha-assistente
VERSAO="${SSH_ORIGINAL_COMMAND:-${1:-}}"
case "$VERSAO" in
  *[!0-9a-f]* | '') echo "versão inválida: '$VERSAO' (esperado o hash do commit)" >&2; exit 1 ;;
esac

# Extrai numa pasta temporária primeiro: se o envio vier incompleto, o app fica como estava.
NOVO="$(mktemp -d)"
trap 'rm -rf "$NOVO"' EXIT
tar -x -C "$NOVO"
[ -f "$NOVO/docker-compose.prod.yml" ] || { echo "código recebido incompleto" >&2; exit 1; }

echo "== backup antes de atualizar"
"$APP/deploy/backup.sh"

echo "== trocando o código ($(cat "$APP/VERSAO" 2>/dev/null || echo '?') -> $VERSAO)"
# Apaga tudo menos .env e uploads, para não sobrar arquivo removido do repositório.
find "$APP" -mindepth 1 -maxdepth 1 ! -name .env ! -name uploads -exec rm -rf {} +
cp -a "$NOVO"/. "$APP"/
echo "$VERSAO" >"$APP/VERSAO"

echo "== subindo os containers (as migrations rodam quando a API sobe)"
cd "$APP"
docker compose up -d --build --remove-orphans --wait --wait-timeout 300
docker image prune -f >/dev/null
echo "== ok: $VERSAO no ar"
