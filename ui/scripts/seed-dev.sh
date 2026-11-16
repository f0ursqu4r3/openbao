#!/usr/bin/env bash
# Fills a local dev server with example data for UI work.
# The dev server keeps its data in memory, so run this again after each restart.
#
# Usage: ./scripts/seed-dev.sh
# Environment: BAO_ADDR (default http://127.0.0.1:8200), BAO_TOKEN (default: the dev root token)
#
# The script is safe to run more than one time. It writes the same names each time.
# All passwords and secret values are fake.

set -euo pipefail

ADDR="${BAO_ADDR:-http://127.0.0.1:8200}"
TOKEN="${BAO_TOKEN:-root}"

case "$ADDR" in
  http://127.0.0.1:* | http://localhost:*) ;;
  *)
    echo "Refusing to seed $ADDR: this script is for a local dev server only." >&2
    exit 1
    ;;
esac

# api METHOD PATH [JSON]: prints the response body. Fails on an HTTP error, except where "|| true" is used.
api() {
  local method="$1" path="$2" data="${3:-}"
  if [ -n "$data" ]; then
    curl -sS --fail-with-body -X "$method" -H "X-Vault-Token: $TOKEN" -d "$data" "$ADDR/v1/$path"
  else
    curl -sS --fail-with-body -X "$method" -H "X-Vault-Token: $TOKEN" "$ADDR/v1/$path"
  fi
}

# field JSON_PATH: reads a value from JSON on stdin, ex: field data.id
field() {
  python3 -c '
import json, sys
value = json.load(sys.stdin)
for key in sys.argv[1].split("."):
    value = value[key]
print(value)' "$1"
}

step() { printf '%s\n' "==> $1"; }

# ---------------------------------------------------------------- secrets engines
step "Secrets engines"
api POST sys/mounts/team-kv '{"type":"kv","options":{"version":"2"},"description":"Team secrets, versioned"}' >/dev/null 2>&1 || true
api POST sys/mounts/legacy-kv '{"type":"kv","options":{"version":"1"},"description":"Old unversioned secrets"}' >/dev/null 2>&1 || true
api POST sys/mounts/transit '{"type":"transit","description":"Encryption as a service"}' >/dev/null 2>&1 || true
api POST sys/mounts/pki '{"type":"pki","description":"Internal certificate authority","config":{"max_lease_ttl":"87600h"}}' >/dev/null 2>&1 || true
api POST sys/mounts/ssh '{"type":"ssh","description":"Signed SSH certificates"}' >/dev/null 2>&1 || true
api POST sys/mounts/totp '{"type":"totp","description":"One-time passcodes"}' >/dev/null 2>&1 || true

step "KV secrets"
kv() { api POST "$1" "{\"data\":$2}" >/dev/null; }
kv secret/data/apps/production/database '{"host":"db.prod.example.internal","username":"app","password":"fake-prod-password"}'
kv secret/data/apps/production/payments '{"api_key":"fake-payments-key","webhook_secret":"fake-webhook-secret"}'
kv secret/data/apps/production/cache '{"url":"redis://cache.prod.example.internal:6379"}'
kv secret/data/apps/staging/database '{"host":"db.staging.example.internal","username":"app","password":"fake-staging-password"}'
kv secret/data/apps/staging/payments '{"api_key":"fake-staging-payments-key"}'
kv secret/data/apps/dev/database '{"host":"localhost","username":"dev","password":"fake-dev-password"}'
kv secret/data/infra/dns/provider '{"token":"fake-dns-token","zone":"example.internal"}'
kv secret/data/infra/ci/runner '{"registration_token":"fake-runner-token"}'
kv secret/data/infra/monitoring/alerts '{"webhook":"https://hooks.example.internal/fake"}'
kv secret/data/shared/readme '{"note":"Example data. Nothing here is real."}'
kv secret/data/shared/wifi '{"ssid":"office-guest","passphrase":"fake-passphrase"}'
# a second version, so the version menu has more than one entry
kv secret/data/apps/production/database '{"host":"db.prod.example.internal","username":"app","password":"fake-prod-password-v2"}'
kv team-kv/data/platform/deploy-key '{"key":"fake-deploy-key"}'
kv team-kv/data/platform/registry '{"username":"ci","password":"fake-registry-password"}'
kv team-kv/data/data-team/warehouse '{"dsn":"postgres://warehouse.example.internal/analytics"}'
api POST legacy-kv/billing/ftp '{"username":"billing","password":"fake-ftp-password"}' >/dev/null
api POST legacy-kv/billing/report-key '{"key":"fake-report-key"}' >/dev/null

step "Transit keys"
api POST transit/keys/app-data '{"type":"aes256-gcm96"}' >/dev/null
api POST transit/keys/signing '{"type":"ed25519"}' >/dev/null
api POST transit/keys/app-data/rotate >/dev/null

step "PKI root and role"
api POST pki/root/generate/internal '{"common_name":"Example Internal Root CA","ttl":"87600h"}' >/dev/null 2>&1 || true
api POST pki/roles/internal-services '{"allowed_domains":"example.internal","allow_subdomains":true,"max_ttl":"720h"}' >/dev/null

# ---------------------------------------------------------------- policies
step "Policies"
policy() {
  api PUT "sys/policies/acl/$1" "$(python3 -c 'import json,sys; print(json.dumps({"policy": sys.argv[1]}))' "$2")" >/dev/null
}
policy app-read 'path "secret/data/apps/*" {
  capabilities = ["read", "list"]
}
path "secret/metadata/apps/*" {
  capabilities = ["list"]
}'
policy app-write 'path "secret/data/apps/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "secret/metadata/apps/*" {
  capabilities = ["read", "list", "delete"]
}'
policy infra-admin 'path "secret/data/infra/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "sys/mounts/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}'
policy transit-encrypt 'path "transit/encrypt/app-data" {
  capabilities = ["update"]
}
path "transit/decrypt/app-data" {
  capabilities = ["update"]
}'
policy pki-issue 'path "pki/issue/internal-services" {
  capabilities = ["update"]
}'
policy audit-read 'path "sys/audit" {
  capabilities = ["read", "sudo"]
}
path "identity/*" {
  capabilities = ["read", "list"]
}'
policy team-kv-platform 'path "team-kv/data/platform/*" {
  capabilities = ["create", "read", "update", "list"]
}'

# ---------------------------------------------------------------- auth methods
step "Auth methods"
api POST sys/auth/userpass '{"type":"userpass","description":"Staff logins"}' >/dev/null 2>&1 || true
api POST sys/auth/approle '{"type":"approle","description":"Service logins"}' >/dev/null 2>&1 || true
api POST sys/auth/ci-jwt '{"type":"jwt","description":"CI pipeline tokens"}' >/dev/null 2>&1 || true

USERS="alice bob carol dave erin"
for user in $USERS; do
  api POST "auth/userpass/users/$user" "{\"password\":\"fake-password-$user\",\"token_policies\":[\"default\"]}" >/dev/null
done
api POST auth/approle/role/web-app '{"token_policies":["app-read","transit-encrypt"],"token_ttl":"1h"}' >/dev/null
api POST auth/approle/role/deployer '{"token_policies":["app-write","pki-issue"],"token_ttl":"30m"}' >/dev/null

USERPASS_ACCESSOR="$(api GET sys/auth | field 'data.userpass/.accessor')"
APPROLE_ACCESSOR="$(api GET sys/auth | field 'data.approle/.accessor')"

# ---------------------------------------------------------------- identity
step "Entities and aliases"
# entity NAME POLICIES_JSON METADATA_JSON: creates or updates the entity and prints its ID
entity() {
  api POST "identity/entity/name/$1" "{\"policies\":$2,\"metadata\":$3}" >/dev/null
  api GET "identity/entity/name/$1" | field data.id
}
alias_for() {
  api POST identity/entity-alias "{\"name\":\"$1\",\"canonical_id\":\"$2\",\"mount_accessor\":\"$3\"}" >/dev/null 2>&1 || true
}

ALICE="$(entity alice '["audit-read"]' '{"team":"platform","role":"lead"}')"
BOB="$(entity bob '[]' '{"team":"platform","role":"engineer"}')"
CAROL="$(entity carol '[]' '{"team":"payments","role":"engineer"}')"
DAVE="$(entity dave '["app-read"]' '{"team":"payments","role":"contractor"}')"
ERIN="$(entity erin '[]' '{"team":"data","role":"analyst"}')"
WEB_APP="$(entity web-app '[]' '{"kind":"service"}')"
DEPLOYER="$(entity deployer '[]' '{"kind":"service"}')"

alias_for alice "$ALICE" "$USERPASS_ACCESSOR"
alias_for bob "$BOB" "$USERPASS_ACCESSOR"
alias_for carol "$CAROL" "$USERPASS_ACCESSOR"
alias_for dave "$DAVE" "$USERPASS_ACCESSOR"
alias_for erin "$ERIN" "$USERPASS_ACCESSOR"
alias_for web-app "$WEB_APP" "$APPROLE_ACCESSOR"
alias_for deployer "$DEPLOYER" "$APPROLE_ACCESSOR"

# a disabled entity, so the "Disabled" tag shows in the list
api POST identity/entity/name/former-employee '{"disabled":true,"metadata":{"team":"payments"}}' >/dev/null

step "Groups"
# group NAME POLICIES_JSON ENTITY_IDS_JSON GROUP_IDS_JSON: creates or updates the group and prints its ID
group() {
  api POST "identity/group/name/$1" "{\"policies\":$2,\"member_entity_ids\":$3,\"member_group_ids\":$4}" >/dev/null
  api GET "identity/group/name/$1" | field data.id
}
PLATFORM="$(group platform-team '["infra-admin","team-kv-platform"]' "[\"$ALICE\",\"$BOB\"]" '[]')"
PAYMENTS="$(group payments-team '["app-write"]' "[\"$CAROL\",\"$DAVE\"]" '[]')"
DATA="$(group data-team '["app-read"]' "[\"$ERIN\"]" '[]')"
SERVICES="$(group services '["transit-encrypt"]' "[\"$WEB_APP\",\"$DEPLOYER\"]" '[]')"
group engineering '["app-read","pki-issue"]' '[]' "[\"$PLATFORM\",\"$PAYMENTS\",\"$DATA\"]" >/dev/null
group everyone '["default"]' '[]' "[\"$SERVICES\"]" >/dev/null
api POST identity/group/name/sso-admins '{"type":"external","policies":["audit-read"]}' >/dev/null

# ---------------------------------------------------------------- namespaces and leases
step "Namespaces"
for ns in team-platform team-payments team-data sandbox; do
  api POST "sys/namespaces/$ns" >/dev/null 2>&1 || true
done

step "Leases"
# a login makes an auth lease, so the Leases page has entries
for user in alice bob; do
  curl -sS -X POST -d "{\"password\":\"fake-password-$user\"}" "$ADDR/v1/auth/userpass/login/$user" >/dev/null || true
done

step "Done. Example data is in $ADDR"
