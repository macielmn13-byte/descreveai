#!/usr/bin/env bash
# =====================================================================
#  Backup do ContaGestão (banco PostgreSQL + documentos criptografados).
#  Uso no servidor, na pasta do projeto:   bash scripts/backup.sh
#  Agende no cron (todo dia às 2h):
#     0 2 * * * cd /opt/contagestao && bash scripts/backup.sh >> /var/log/contagestao-backup.log 2>&1
#  IMPORTANTE: guarde também a ENCRYPTION_KEYS em local seguro e SEPARADO
#  dos backups — sem ela os documentos não podem ser lidos.
# =====================================================================
set -euo pipefail

DESTINO="${BACKUP_DIR:-./backups}"
RETENCAO_DIAS="${BACKUP_RETENCAO_DIAS:-30}"
DATA="$(date +%Y%m%d-%H%M%S)"
COMPOSE="docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.prod.yml"

mkdir -p "$DESTINO"

echo "[$(date)] Backup do banco..."
$COMPOSE exec -T db pg_dump -U contagestao -d contagestao --format=custom > "$DESTINO/banco-$DATA.dump"

echo "[$(date)] Backup dos documentos..."
$COMPOSE run --rm --no-deps -T --entrypoint tar api -czf - -C /app/data storage > "$DESTINO/documentos-$DATA.tar.gz"

echo "[$(date)] Removendo backups com mais de $RETENCAO_DIAS dias..."
find "$DESTINO" -type f \( -name 'banco-*.dump' -o -name 'documentos-*.tar.gz' \) -mtime +"$RETENCAO_DIAS" -delete

echo "[$(date)] Concluído: $DESTINO/banco-$DATA.dump e $DESTINO/documentos-$DATA.tar.gz"
