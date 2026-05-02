#!/bin/sh
set -e

# Generate runtime config from environment variables.
# VITE_GITHUB_CLIENT_ID is used here as the runtime env var name so that
# the existing podman-compose.yml requires no changes.
# ENABLED_AUTH_METHODS: comma-separated list of enabled auth methods.
#   Supported values: github, saml, token, basic
#   Default (empty): all methods enabled.
cat > /usr/share/nginx/html/config.js <<EOF
window.HD_CONFIG = {
  GITHUB_CLIENT_ID: "${VITE_GITHUB_CLIENT_ID:-}",
  ENABLED_AUTH_METHODS: "${ENABLED_AUTH_METHODS:-}",
};
EOF

# Delegate to the official nginx entrypoint, which processes
# /etc/nginx/templates/*.template via envsubst before starting nginx.
exec /docker-entrypoint.sh "$@"
