# Security Policy

## Supported versions

CartDex is a hobby project maintained on a best-effort basis. Only the latest
release is supported. There are no backport commitments to older versions.

| Version | Supported |
|---|---|
| latest | Yes |
| older | No |

## Reporting a vulnerability

If you find a security vulnerability in CartDex, please report it responsibly
rather than opening a public issue.

**Preferred method:** Open a
[private security advisory](https://github.com/five30am/cartdex/security/advisories/new)
directly in this repository. GitHub keeps the report confidential until a fix
is ready.

**Alternate method:** Email security@aaronbeebe.com with the subject line
`[CartDex] Security Report`. Include a description of the issue, steps to
reproduce, and your assessment of impact.

## Response expectations

This is a hobby project with no SLA. Response time is best-effort:

- Acknowledgment: within a few days when possible
- Triage: within two weeks for confirmed issues
- Fix: no guaranteed timeline; severity drives priority

Reporters who follow responsible disclosure will be credited in the fix commit
unless they prefer anonymity.

## Known limitations

CartDex is designed for personal, single-user, LAN-hosted use. It is not
audited by a third party and carries no security warranty beyond what GPL-3.0
requires. Specifically:

- **No multi-user auth.** The API token (`CARTDEX_API_TOKEN`) is a shared
  static secret. All callers with the token have full write access.
- **ROM files are served directly.** If you expose CartDex to the public
  internet, anyone who can reach the service can trigger ROM scans and
  metadata scrapes.
- **SQLite on the local filesystem.** There is no database-level encryption.
  Protect the Docker volume via OS-level controls.
- **No rate limiting on read endpoints.** The mutation endpoints have token
  auth; read endpoints do not. Do not expose CartDex to untrusted networks
  without a reverse proxy that enforces access controls.

The recommended deployment is behind a VPN or on a trusted LAN segment only.
