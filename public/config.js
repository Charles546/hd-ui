// Runtime config placeholder for local dev.
// In production this file is overwritten at container startup by the entrypoint
// script, which injects VITE_GITHUB_CLIENT_ID from the container environment.
// For local dev, VITE_GITHUB_CLIENT_ID in your .env.local is used as a fallback.
window.HD_CONFIG = window.HD_CONFIG || {
  GITHUB_CLIENT_ID: '',
}
