# Org Chart Visual Enhancement — Build Plan

## Summary
7 enhancements to the Org Chart: animated edges, rich edge labels, enhanced company/person nodes with integrated capital badges, layout/visibility controls with dynamic node width recalculation, and minimap. No database changes needed.

## Files to Create

### 1. `src/components/orgchart/CompanyNode.tsx`
Two-column flex layout inside a single node container:
- **Left column** (flex-grow): Name, status dot (green/amber/red from doc status), company_type + jurisdiction, registration_number (visibility-gated), incorporation date (visibility-gated), officer count, subsidiary count
- **Right column** (fixed 160px, conditionally rendered based on `data.visibility.capitalBadges`): Capital badge — list of share classes with colored dots, shares count, par value, currency, voting tag, allocation status. Collapsible via chevron (default expanded ≤3 classes). If no share classes: "No share capital recorded"
- Node container: 280px min-width (left only) or 440px (with badge), dark navy `#0F172A`, white text
- Status dot computed from `data.docStatus` prop

### 2. `src/components/orgchart/PersonNode.tsx`
- 260px width, gradient `#3B82F6` → `#2563EB`
- Shows: name, nationality, status dot, primary appointment (most senior role from `data.primaryRole`), direct holdings list (max 3, then "+X more")
- Holdings from `data.ownerships`, gated by `data.visibility.personHoldings`

### 3. `src/components/orgchart/CapitalBadge.tsx`
- Extracted component rendered inside CompanyNode's right column
- Per share class: colored dot (green=Ordinary, amber=Preference, blue=Class A, orange=Class B), name, shares count, par value, currency, `[Vote]`/`[Non-vote]` tag, allocation status (✓ Fully allocated / ⚠ X% allocated / ○ Unallocated)
- Collapsible via chevron; default expanded ≤3 classes, collapsed >3

### 4. `src/components/orgchart/CustomEdge.tsx`
- Custom edge using `getBezierPath` from `@xyflow/react`
- Animated `strokeDasharray="5,5"` with CSS keyframes (`dashflow`, 1.5s)
- Color: >50% → `#16A34A`, 25-50% → `#D97706`, <25% → `#94A3B8`
- Thickness: >50% → 3, 25-50% → 2, <25% → 1.5
- Hover glow via `filter: drop-shadow`
- Rich label via `<EdgeLabelRenderer>`: white card showing per-link share class icon, shares count, class name, percentage, voting badge
- Edge deduplication: receives `data.links[]` — stacked label if multiple classes, with "Total economic: X%"
- Label visibility gated by `data.showLabels`

### 5. `src/components/orgchart/ChartControls.tsx`
- Layout dropdown: TB (default), LR, Radial ("Beta" tooltip; silent TB fallback)
- Show/Hide dropdown with checkboxes:
  - Capital Badges (on) — triggers layout recalc
  - Edge Labels (on)
  - Person Holdings (on)
  - Officer Counts (on)
  - Registration Numbers (off)
  - Incorporation Dates (off)
- Props: `layoutDirection`, `onLayoutChange`, `visibility`, `onVisibilityChange`, `showMinimap`, `onMinimapToggle`, `onExportPng`

### 6. CSS in `src/index.css`
```css
@keyframes dashflow {
  to { stroke-dashoffset: -20; }
}
```

## Files to Modify

### 7. `src/pages/OrgChart.tsx` — Major refactor

**New state:**
- `layoutDirection: 'TB' | 'LR'` (default `'TB'`)
- `visibility: { capitalBadges: true, edgeLabels: true, personHoldings: true, officerCounts: true, regNumbers: false, incDates: false }`
- `showMinimap: boolean` (default `true`)
- `docStatusMap: Record<string, 'green'|'amber'|'red'>`
- `appointmentMap: Record<string, {role: string, company: string}>`

**Data fetching additions** (batch in existing `Promise.all`):
- Documents: `SELECT id, entity_id, expiry_date FROM documents WHERE workspace_id = ?` — compute per-entity doc status (red if any expired, amber if expiring ≤60 days, green otherwise)
- Appointments: expand to include `role_title, role_category, person_entity_id, company_entity_id` — pick most senior active role per person

**Node type registration:** Replace `entityNode` with `companyNode` and `personNode`

**Edge deduplication:** Group `filteredLinks` by `owner_entity_id + owned_entity_id` → one custom edge per pair, all links in `data.links[]`. Max percentage determines color/thickness.

**CRITICAL — Dynamic layout recalculation:**
- `getLayoutedElements` accepts `rankdir` and per-node dimensions
- Company node width: `visibility.capitalBadges ? 440 : 280`, height: 150
- Person node width: 260, height: 140
- `nodesep: 100`, `ranksep: 140`
- **`useEffect` watches `layoutDirection` AND `visibility.capitalBadges`** — when either changes, re-runs `getLayoutedElements` with correct node dimensions for current state. Other visibility toggles (reg numbers, inc dates, etc.) only hide/show content within existing dimensions — NO layout recalc.
- For radial layout: try circular positioning, catch errors → fall back to TB silently

**PNG export:** Use `getNodesBounds` from `@xyflow/react` after layout to compute proper bounding box including full node widths. Pass to `toPng`.

**MiniMap:** Add `<MiniMap>` from `@xyflow/react` with toggle. Node colors: person `#3B82F6`, company `#0F172A`.

**Visibility flags:** Passed to node `data` props. Nodes conditionally render sections based on flags.

## Technical Notes

- No database migrations required
- No new npm dependencies (all features use existing `@xyflow/react` APIs, `lucide-react`, `html-to-image`)
- All additional data (docs, appointments with roles) fetched in existing single `Promise.all`
- Node dimensions passed to dagre are type-aware and visibility-aware
- Capital badge is inside CompanyNode div — captured in PNG export, moves with node drag
