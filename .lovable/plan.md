

# CorpSync — Entity Management System

## Overview
A multi-tenant SaaS for law firms to manage corporate structures and KYC documents, built with React + Supabase.

## Authentication & Workspace
- Supabase Auth with email/password signup
- On signup, user creates a Workspace (law firm name) and becomes Admin
- All data scoped by workspace_id with RLS
- User roles: Admin, Viewer (stored in separate user_roles table per security best practices)
- Profiles table linked to auth.users

## Database Schema (Supabase)
- **workspaces**: id, name, created_at
- **profiles**: id, user_id (FK auth.users), workspace_id (FK workspaces), full_name, email, created_at
- **user_roles**: id, user_id (FK auth.users), workspace_id (FK workspaces), role (admin/viewer)
- **entities**: id, workspace_id, type (person/company), name, nationality_or_jurisdiction, date_of_birth_or_incorporation, email, phone, company_type, registration_number, registered_address, primary_contact_name, primary_contact_email, notes, created_at
- **documents**: id, entity_id, workspace_id, document_type, document_number, issue_date, expiry_date, file_url, created_at
- **Storage bucket**: "documents" (organized workspace_id/entity_id/filename)
- RLS on all tables filtering by workspace_id

## Design System
- White background, dark navy sidebar (#0F172A), accent electric blue (#3B82F6)
- Clean, professional, Notion-meets-legal aesthetic
- shadcn/ui components throughout
- Status badges: green (Valid), amber (Expiring Soon), red (Expired)
- Subtle card shadows, rounded-lg corners
- Empty states with illustrations and CTAs

## Layout
- Dark navy sidebar with: Dashboard, Entities, Documents, Settings
- SidebarProvider with collapsible support and trigger in header

## Pages

### Dashboard
- 4 summary cards: Total Entities, Expiring in 30 Days (amber), Expired (red), Total Companies
- Expiry Alerts table sorted by expiry date ascending with entity name, doc type, doc number, expiry date, status badge

### Entities
- **List**: Searchable/filterable table (Name, Type, Country, Created, Doc Status). Filter by All/Person/Company. "Add Entity" button.
- **Add/Edit**: Form with two modes — Individual (name, nationality, DOB, email, phone, notes) and Company (legal name, jurisdiction, company type, reg number, incorporation date, address, contact, notes). Repeatable documents section with type dropdown, number, dates, file upload, auto-calculated status.
- **Detail**: Header with name/type/country, two tabs (Profile, Documents), Edit and Delete buttons with confirmation modal.

### Documents
- Unified table of ALL documents across entities. Columns: Entity Name, Doc Type, Doc Number, Expiry Date, Status, Download. Filters: Status, Entity Type, Document Type.

### Settings
- Edit workspace name
- Invite users by email
- List users with roles, remove button (Admin only)

## Key Behaviors
- Expiry status calculated dynamically (never stored)
- File uploads to Supabase Storage
- Delete actions require confirmation modal
- Desktop-first, responsive as bonus

