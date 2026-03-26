# Privacy Policy

Effective date: 2026-03-26

This Privacy Policy describes how Honeydipper Web UI handles data when used as part of a GitHub App integration.

## Scope

This policy applies to:

- the Honeydipper Web UI repository and related GitHub App listing
- user interactions with the web interface
- data processed through configured Honeydipper API endpoints

## Information We Process

Depending on your deployment and configuration, the application may process:

- account identifiers (for authentication and authorization)
- repository and workflow metadata
- event payloads and session data from Honeydipper APIs
- technical diagnostics such as timestamps, statuses, and execution details

The project does not include built-in analytics or advertising trackers.

## How Data Is Used

Data is used to:

- authenticate users
- authorize actions based on role and policy
- display workflow state, logs, and related execution context
- operate, troubleshoot, and secure CI automation workflows

## Storage and Retention

- Credentials entered in the web UI are stored in browser `sessionStorage` and cleared on sign-out or browser session end.
- Persistent storage and retention policies are controlled by your Honeydipper backend, infrastructure, and operators.

## Data Sharing

Data is not sold.

Data may be transmitted to systems that you configure, including:

- Honeydipper services
- GitHub APIs and webhooks
- external integrations and drivers configured by your organization

## Security

Reasonable technical and organizational measures should be used by deployers, including:

- HTTPS/TLS
- access controls and least privilege
- secret management best practices

No method of transmission or storage is guaranteed to be 100% secure.

## Your Choices

As a deployer or administrator, you control:

- what data is collected by workflows
- integration endpoints and retention settings
- access and permissions

As an end user, you can sign out to clear in-session credentials stored by the UI.

## Changes to This Policy

This policy may be updated from time to time. Changes will be posted in this repository.

## Contact

For privacy questions related to this project, open an issue in this repository:

- https://github.com/Charles546/hd-ui/issues
