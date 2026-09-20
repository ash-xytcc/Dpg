#!/bin/sh
set -eu

STATE_DIR="${DPG_STATE_DIR:-/var/lib/dpg}"
RUNTIME_ENV="$STATE_DIR/runtime.env"
JWT_FILE="$STATE_DIR/jwt-secret"
SCHEMA_MARKER="$STATE_DIR/.schema-initialized"

mkdir -p "$STATE_DIR"

if [ -n "${JWT_SECRET:-}" ]; then
  JWT_VALUE="$JWT_SECRET"
elif [ -s "$JWT_FILE" ]; then
  JWT_VALUE="$(cat "$JWT_FILE")"
else
  JWT_VALUE="$(node -e "process.stdout.write(require('crypto').randomBytes(48).toString('hex'))")"
  umask 077
  printf '%s' "$JWT_VALUE" > "$JWT_FILE"
fi

# Keep a private persisted runtime file for inspection/recovery, but export the
# values into Wrangler's own process environment. Pages dev reliably exposes
# inherited environment variables to Functions; --env-file is not used here
# because it was not populating context.env in the VPS runtime.
umask 077
{
  printf 'ENV=production\n'
  printf 'NODE_ENV=production\n'
  printf 'JWT_SECRET=%s\n' "$JWT_VALUE"
  if [ -f /run/secrets/dpg-extra-vars ]; then
    cat /run/secrets/dpg-extra-vars
    printf '\n'
  fi
} > "$RUNTIME_ENV"

set -a
. "$RUNTIME_ENV"
set +a

if [ ! -f "$SCHEMA_MARKER" ]; then
  echo "Initializing persisted DPG data store..."
  npx wrangler d1 execute bondfire-local --local --persist-to "$STATE_DIR" --file=./db/schema.sql
  npx wrangler d1 execute bondfire-local --local --persist-to "$STATE_DIR" --file=./db/migrations/2026-01-01_local_bootstrap_missing_tables.sql
  npx wrangler d1 execute bondfire-local --local --persist-to "$STATE_DIR" --file=./db/migrations/2026-01-02_local_bootstrap_users_columns.sql
  npx wrangler d1 execute bondfire-local --local --persist-to "$STATE_DIR" --file=./db/migrations/2026-02-22_zk_everything.sql
  npx wrangler d1 execute bondfire-local --local --persist-to "$STATE_DIR" --file=./db/migrations/2026-03-25_studio_zk.sql
  touch "$SCHEMA_MARKER"
fi

set -- npx wrangler pages dev dist \
  --ip 0.0.0.0 \
  --port 8788 \
  --persist-to "$STATE_DIR" \
  --binding "ENV=production" \
  --binding "NODE_ENV=production" \
  --binding "JWT_SECRET=$JWT_VALUE" \
  --log-level warn \
  --show-interactive-dev-session=false

if [ -n "${RESEND_API_KEY:-}" ]; then
  set -- "$@" --binding "RESEND_API_KEY=$RESEND_API_KEY"
fi
if [ -n "${RESEND_RELAY_URL:-}" ]; then
  set -- "$@" --binding "RESEND_RELAY_URL=$RESEND_RELAY_URL"
fi
if [ -n "${RESEND_FROM:-}" ]; then
  set -- "$@" --binding "RESEND_FROM=$RESEND_FROM"
fi
if [ -n "${RSVP_FORM_URL:-}" ]; then
  set -- "$@" --binding "RSVP_FORM_URL=$RSVP_FORM_URL"
fi

exec "$@"
