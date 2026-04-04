

# Demo Mode — Revised Plan

## Summary

Build a `/demo` route with auto-login to the **existing** workspace as a viewer, plus a `/demo-admin` page for admins to prepare demo data. No new workspace or seed function.

## Steps

### Step 1 — Add DEMO_USER_PASSWORD secret
Store `DEMO_USER_PASSWORD = CorpSync-Demo-2026` as an Edge Function secret (already planned).

### Step 2 — Create demo user (manual + Edge Function helper)
Build a small Edge Function `create-demo-user` that:
1. Creates auth user `demo@corpsync.app` with password from `DEMO_USER_PASSWORD`
2. Waits for the `handle_new_user` trigger to create the profile
3. Updates the profile's `workspace_id` to the existing workspace
4. Inserts a `viewer` role in `user_roles` for that workspace
5. Returns `{ success, user_id, workspace_id }`

Idempotent — skips if user already exists. Invoke once after deploy.

### Step 3 — `src/pages/Demo.tsx`
- Constants: `DEMO_EMAIL = 'demo@corpsync.app'`, `DEMO_PASS = 'CorpSync-Demo-2026'`
- On mount, check current session:
  - Already logged in as demo user → redirect to `/dashboard`
  - Logged in as different user → show warning ("You are logged in as [email]. Continue to Demo will sign you out.") with Cancel / Continue buttons
  - No session → show branded landing with "Explore Demo" button
- On click: sign out if needed, then `signInWithPassword`, redirect to `/dashboard`

### Step 4 — `src/contexts/AuthContext.tsx`
- Add `isDemoUser: boolean` (true when `user?.email === 'demo@corpsync.app'`)
- Expose in provider value

### Step 5 — `src/components/AppLayout.tsx` — Demo banner
When `isDemoUser` is true, render a 40px non-dismissible banner above the header:
- Background: `#0F172A`, white text
- Left: "👁 Demo Mode — [workspace name] workspace. Read-only view."
- Right: "Book a Demo →" button (`#B8960C` bg, navy text) → `mailto:info@holdingstructure.com`

### Step 6 — `src/pages/DemoAdmin.tsx`
New admin-only page with 5 sections:

**Section 1 — Workspace Display Name**: Edit field + save button. Updates `workspaces.name`.

**Section 2 — Demo Documents**: Lists all documents where `file_url` contains 'placeholder' or is null. Per row: entity name, document type, status badge, "Upload Real Document" button. Upload uses `encryptedUpload()` and updates the document record.

**Section 3 — Profile Photos**: Lists person entities without `profile_photo_url`. Upload button per person. Uses existing profile photo upload flow.

**Section 4 — Recalculate UBO**: Button that calls `calculate_ubo()` via RPC for each company entity. Shows last `calculated_at` from `ubo_snapshots`.

**Section 5 — Demo Health Check**: Read-only audit dashboard showing:
- Documents: X real files / Y placeholders (green if 0 placeholders)
- Persons: X with photos / Y without (green if all have photos)
- UBO snapshots: last calculated date (green if <24h ago)
- Bank accounts with signatories count
- Confirmed movements count

Color coding: green = ready, amber = needs attention.

### Step 7 — `src/App.tsx` routing
- Add `/demo` route (public, outside ProtectedRoute)
- Add `/demo-admin` inside ProtectedRoute, wrapped in AdminRoute

## Files to create/modify

| File | Action |
|------|--------|
| `supabase/functions/create-demo-user/index.ts` | Create — one-time user setup |
| `src/pages/Demo.tsx` | Create — demo landing + auto-login |
| `src/pages/DemoAdmin.tsx` | Create — admin demo preparation page |
| `src/contexts/AuthContext.tsx` | Add `isDemoUser` flag |
| `src/components/AppLayout.tsx` | Add demo banner |
| `src/App.tsx` | Add `/demo` and `/demo-admin` routes |
| `src/components/AppSidebar.tsx` | Add Demo Admin nav link (admin only) |

## What's NOT included (removed from original plan)
- No `seed-demo-workspace` Edge Function
- No new workspace creation
- No bulk data seeding
- No `DemoExpired.tsx`

## After building
1. Invoke `create-demo-user` edge function once
2. Test `/demo` in incognito
3. Navigate to `/demo-admin` as admin and run health check
4. Report health check results

