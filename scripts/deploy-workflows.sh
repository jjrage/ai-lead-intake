#!/usr/bin/env bash
# Imports workflows/*.json into the running n8n, publishes the ones that should be live and restarts n8n.
# Usage: scripts/deploy-workflows.sh [workflow ids to publish...]
#   default publish list: web form, process, errors (Gmail and Test inbox need the Gmail credential first)
set -euo pipefail
export MSYS_NO_PATHCONV=1   # Git Bash on Windows would otherwise rewrite /tmp/... into a Windows path
cd "$(dirname "$0")/.."

publish=("$@")
[ ${#publish[@]} -eq 0 ] && publish=(LeadIntakeForm01 LeadIntakeProc01 LeadIntakeErrs01)

docker compose exec -T -u root n8n sh -c 'rm -rf /tmp/li-wf && mkdir -p /tmp/li-wf'
for f in workflows/*.json; do docker compose cp "$f" n8n:/tmp/li-wf/ >/dev/null; done
docker compose exec -T n8n n8n import:workflow --separate --input=/tmp/li-wf 2>&1 | grep -E 'Importing|imported|Error' || true
for id in "${publish[@]}"; do
  docker compose exec -T n8n n8n publish:workflow --id="$id" 2>&1 | grep -iE 'error|not found' || echo "published $id"
done
docker compose exec -T -u root n8n rm -rf /tmp/li-wf
docker compose restart n8n >/dev/null
for _ in $(seq 1 45); do curl -sf -o /dev/null http://localhost:5678/healthz && break; sleep 2; done
echo "n8n restarted"
