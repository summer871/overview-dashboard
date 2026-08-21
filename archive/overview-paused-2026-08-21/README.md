# Paused Overview archive — 2026-08-21

This directory contains recovery evidence for the paused Overview UI removed from active `Index.html`.

- `Index.pre-overview-removal.html` is an exact byte-for-byte snapshot of the outgoing Index source.
- Source SHA-256: `19056496fa2e1f90f6ad1b4df280d58e660470a4d639742f022723c7e4980b21`
- The archive is explicitly excluded from Apps Script by `.claspignore` (`archive/**`).
- This checkpoint removes only paused Overview UI/routes. Large Overview JavaScript/CSS cleanup is intentionally deferred to a later checkpoint.
