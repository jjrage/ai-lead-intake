#!/usr/bin/env bash
# Imports workflows/*.json into n8n, publishes the ones that should be live and restarts n8n.
# Usage: scripts/deploy-workflows.sh [--remote <ssh host>] [workflow ids to publish...]
#   default publish list: web form, process, errors (Gmail and Test inbox need the Gmail credential first)
#   --remote: the public server (deploy/compose.yml in ~/lead-assistant on that host)
set -euo pipefail
export MSYS_NO_PATHCONV=1   # Git Bash on Windows would otherwise rewrite /tmp/... into a Windows path
cd "$(dirname "$0")/.."

remote=""
if [ "${1:-}" = "--remote" ]; then remote="$2"; shift 2; fi
dc() {
  if [ -n "$remote" ]; then ssh "$remote" "cd lead-assistant/deploy && docker compose $(printf '%q ' "$@")"
  else docker compose "$@"; fi
}

publish=("$@")
[ ${#publish[@]} -eq 0 ] && publish=(LeadIntakeForm01 LeadIntakeProc01 LeadIntakeErrs01)

dc exec -T -u root n8n sh -c 'rm -rf /tmp/li-wf && mkdir -p /tmp/li-wf && chown node /tmp/li-wf'
for f in workflows/*.json; do dc exec -T n8n sh -c "cat > /tmp/li-wf/$(basename "$f")" < "$f"; done
dc exec -T n8n n8n import:workflow --separate --input=/tmp/li-wf 2>&1 | grep -E 'Importing|imported|Error' || true
for id in "${publish[@]}"; do
  dc exec -T n8n n8n publish:workflow --id="$id" 2>&1 | grep -iE 'error|not found' || echo "published $id"
done
dc exec -T -u root n8n rm -rf /tmp/li-wf
dc restart n8n >/dev/null
health() { if [ -n "$remote" ]; then ssh "$remote" curl -sf -o /dev/null http://127.0.0.1:5678/healthz; else curl -sf -o /dev/null http://localhost:5678/healthz; fi; }
for _ in $(seq 1 45); do health && break; sleep 2; done
echo "n8n restarted"
