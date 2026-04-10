#!/usr/bin/env bash
#
# Deploy fieldwork to a self-hosted server.
#
# Required env vars:
#   FW_HOST=user@host            # your SSH target (e.g. ubuntu@203.0.113.42)
#
# Optional env vars:
#   FW_REMOTE_DIR=~/fieldwork    # where to install on the remote (default ~/fieldwork)
#   FW_PORT=3005                 # port the Next.js server listens on (default 3005)
#   FW_KEY=sk-...                # only read for --set-key
#   FW_AUTH_USER=fieldwork       # only read for --set-auth
#   FW_AUTH_PASS=<password>      # only read for --set-auth
#
# Tip: export FW_HOST (and friends) in your shell profile, or create a
# gitignored `.env.deploy` at the repo root that you `source` before running.
#
# Usage:
#   ./scripts/deploy-staging.sh             # full redeploy (transfer + install + build + restart)
#   ./scripts/deploy-staging.sh --fast      # skip pnpm install
#   ./scripts/deploy-staging.sh --restart   # restart only (no transfer, no build)
#   ./scripts/deploy-staging.sh --stop      # stop the running server
#   ./scripts/deploy-staging.sh --logs      # tail the server log
#   ./scripts/deploy-staging.sh --env       # show env var names on remote (values redacted)
#   FW_KEY=sk-... ./scripts/deploy-staging.sh --set-key   # write ANTHROPIC_API_KEY and restart
#   FW_AUTH_USER=admin FW_AUTH_PASS=... ./scripts/deploy-staging.sh --set-auth   # write Basic Auth creds
#
# Env file on remote: $REMOTE_DIR/.env (chmod 600). Auto-sourced at server start.

set -euo pipefail

if [[ -z "${FW_HOST:-}" ]]; then
  printf '\033[1;31m[fail]\033[0m FW_HOST is not set.\n' >&2
  printf 'Set it to your SSH target, e.g.:\n' >&2
  printf '  export FW_HOST=ubuntu@your-host.example\n' >&2
  printf '  %s %s\n' "$0" "${1:-}" >&2
  exit 2
fi

HOST="$FW_HOST"
REMOTE_DIR="${FW_REMOTE_DIR:-~/fieldwork}"
PORT="${FW_PORT:-3005}"
LOG="$REMOTE_DIR/server.log"

cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"

log()  { printf '\033[1;34m[deploy]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[ok]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[fail]\033[0m %s\n' "$*" >&2; exit 1; }

remote() {
  ssh "$HOST" "export NVM_DIR=\"\$HOME/.nvm\"; . \"\$NVM_DIR/nvm.sh\" >/dev/null 2>&1; $*"
}

stop_server() {
  log "stopping any server on port $PORT"
  ssh "$HOST" "fuser -k ${PORT}/tcp >/dev/null 2>&1; true"
}

start_server() {
  log "starting next start on port $PORT"
  ssh "$HOST" bash <<EOF
export NVM_DIR="\$HOME/.nvm"
. "\$NVM_DIR/nvm.sh" >/dev/null 2>&1
RDIR="\$(eval echo $REMOTE_DIR)"
set -a
[ -f "\$RDIR/.env" ] && . "\$RDIR/.env"
set +a
cd "\$RDIR/apps/web"
echo "--- restart \$(date -Iseconds) ---" >> "\$RDIR/server.log"
nohup env PORT=$PORT HOSTNAME=0.0.0.0 pnpm start >>"\$RDIR/server.log" 2>&1 </dev/null &
disown \$!
exit 0
EOF
}

set_key() {
  if [[ -z "${FW_KEY:-}" ]]; then
    fail "FW_KEY env var is required: FW_KEY=sk-ant-... $0 --set-key"
  fi
  log "writing ANTHROPIC_API_KEY to $REMOTE_DIR/.env"
  ssh "$HOST" "bash -c 'umask 077; mkdir -p $REMOTE_DIR; touch $REMOTE_DIR/.env; chmod 600 $REMOTE_DIR/.env; grep -v \"^ANTHROPIC_API_KEY=\" $REMOTE_DIR/.env > $REMOTE_DIR/.env.new || true; echo \"ANTHROPIC_API_KEY=$FW_KEY\" >> $REMOTE_DIR/.env.new; mv $REMOTE_DIR/.env.new $REMOTE_DIR/.env'"
  ok "key stored (chmod 600)"
  stop_server
  start_server
  wait_for_ready
}

set_auth() {
  if [[ -z "${FW_AUTH_PASS:-}" ]]; then
    fail "FW_AUTH_PASS env var is required: FW_AUTH_USER=you FW_AUTH_PASS=... $0 --set-auth"
  fi
  local user="${FW_AUTH_USER:-fieldwork}"
  log "writing FIELDWORK_AUTH_USER/PASS to $REMOTE_DIR/.env"
  ssh "$HOST" "bash -c 'umask 077; mkdir -p $REMOTE_DIR; touch $REMOTE_DIR/.env; chmod 600 $REMOTE_DIR/.env; grep -vE \"^FIELDWORK_AUTH_(USER|PASS)=\" $REMOTE_DIR/.env > $REMOTE_DIR/.env.new || true; echo \"FIELDWORK_AUTH_USER=$user\" >> $REMOTE_DIR/.env.new; echo \"FIELDWORK_AUTH_PASS=$FW_AUTH_PASS\" >> $REMOTE_DIR/.env.new; mv $REMOTE_DIR/.env.new $REMOTE_DIR/.env'"
  ok "auth creds stored (chmod 600, user=$user)"
  stop_server
  start_server
  wait_for_ready
}

show_env() {
  log "env on remote (values redacted)"
  ssh "$HOST" "if [ -f $REMOTE_DIR/.env ]; then sed 's/=.*/=<redacted>/' $REMOTE_DIR/.env; else echo 'no .env file'; fi"
}

wait_for_ready() {
  log "waiting for health check"
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS -o /dev/null --max-time 3 "http://${HOST#*@}:$PORT/api/health"; then
      ok "server responding at http://${HOST#*@}:$PORT/"
      return 0
    fi
    sleep 1
  done
  fail "server did not respond within 10 seconds — check logs with --logs"
}

transfer() {
  log "transferring repo via tar over ssh"
  tar --exclude=node_modules --exclude=.next --exclude=.turbo --exclude=.git -cf - . \
    | ssh "$HOST" "mkdir -p $REMOTE_DIR && cd $REMOTE_DIR && tar -xf -"
}

install_deps() {
  log "pnpm install on remote"
  remote "cd $REMOTE_DIR && pnpm install"
}

build() {
  log "pnpm build"
  remote "cd $REMOTE_DIR/apps/web && pnpm build"
}

case "${1:-}" in
  --stop)
    stop_server
    ok "stopped"
    ;;
  --logs)
    ssh "$HOST" "tail -f $LOG"
    ;;
  --restart)
    stop_server
    start_server
    wait_for_ready
    ;;
  --env)
    show_env
    ;;
  --set-key)
    set_key
    ;;
  --set-auth)
    set_auth
    ;;
  --fast)
    transfer
    build
    stop_server
    start_server
    wait_for_ready
    ;;
  "")
    transfer
    install_deps
    build
    stop_server
    start_server
    wait_for_ready
    ;;
  *)
    echo "unknown option: $1" >&2
    echo "usage: $0 [--fast|--restart|--stop|--logs|--env|--set-key|--set-auth]" >&2
    exit 2
    ;;
esac
