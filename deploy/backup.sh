#!/bin/sh
# Backup do banco (pg_dump) e dos anexos de viagem. Agende no cron do servidor (docs/deploy.md).
#   DESTINO=/var/backups/minha-assistente DIAS=14 [BACKUP_REMOTE=b2:bucket/pasta] ./deploy/backup.sh
set -eu

cd "$(dirname "$0")/.."
DESTINO="${DESTINO:-/var/backups/minha-assistente}"
DIAS="${DIAS:-14}"
DATA="$(date +%Y-%m-%d_%H%M)"
COMPOSE="${COMPOSE:-docker compose -f docker-compose.prod.yml}"

mkdir -p "$DESTINO"
$COMPOSE exec -T postgres pg_dump -U minha_assistente -d minha_assistente --format=custom >"$DESTINO/banco_$DATA.dump"
$COMPOSE exec -T api tar -C /app -czf - uploads >"$DESTINO/anexos_$DATA.tar.gz"

# Apaga os backups com mais de $DIAS dias.
find "$DESTINO" -type f \( -name 'banco_*.dump' -o -name 'anexos_*.tar.gz' \) -mtime +"$DIAS" -delete
echo "$(date '+%F %T') backup ok: $DESTINO/banco_$DATA.dump e anexos_$DATA.tar.gz"

# Opcional: BACKUP_REMOTE (destino do rclone, ex.: "b2:meu-bucket/minha-assistente") guarda uma
# cópia fora do servidor. A retenção lá é a do bucket (regras de ciclo de vida do B2).
if [ -n "${BACKUP_REMOTE:-}" ]; then
  rclone copy "$DESTINO/banco_$DATA.dump" "$BACKUP_REMOTE"
  rclone copy "$DESTINO/anexos_$DATA.tar.gz" "$BACKUP_REMOTE"
  echo "$(date '+%F %T') enviado para $BACKUP_REMOTE"
fi
