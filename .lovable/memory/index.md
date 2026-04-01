# Project Memory

## Core
CorpSync: multi-tenant entity management SaaS for law firms.
Primary #3B82F6 (electric blue), sidebar #0F172A (dark navy), white bg.
Lovable Cloud backend. All data scoped by workspace_id with RLS.
Status badges: green=Valid, amber=Expiring Soon, red=Expired. Calculated dynamically.
Cap table: Setup Mode (direct edit) → Live Mode (movement ledger only).

## Memories
- [Design tokens](mem://design/tokens) — Color palette, warning/success tokens, sidebar theming
- [DB schema](mem://features/schema) — workspaces, profiles, user_roles, entities, documents, equity_links, share_classes, movements, movement_documents, ubo_snapshots tables with RLS
- [Auth flow](mem://features/auth) — Email/password signup with workspace creation, admin/viewer roles
- [UBO Engine](mem://features/ubo) — Recursive beneficial ownership calculation, 25% threshold, chain visualization
