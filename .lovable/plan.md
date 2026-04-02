

# Org Chart Visual Enhancement — Build Plan

## Summary
7 enhancements to the Org Chart: animated edges, rich edge labels, enhanced company/person nodes with integrated capital badges, layout/visibility controls with dynamic node width recalculation, and minimap. No database changes needed.

## Files to Create

### 1. `src/components/orgchart/CompanyNode.tsx`
Two-column flex layout inside a single node container:
- **Left column** (flex-grow): Name, status dot (green/amber/red from doc status), company_type + jurisdiction, registration_number (visibility-gated), incorporation date (visibility-gated), officer count, subsidiary count
- **Right column** (fixed 160px, conditionally rendered when `data.visibility.capitalBadges` is true): Capital badge with share classes, allocation status, voting tags
- Node container: 280px min-width (left only) or 440px (with badge), dark navy `#0F172A`, white text
- Status dot computed from `data.docStatus` prop

### 2. `src/components/orgchart/PersonNode.tsx`
- 260px width, gradient `#3B82F6` → `#2563EB`
- Shows: name, nationality, status dot, primary appointment (most senior active role), direct holdings list (max 3, then "+X more")
- Holdings gated by `data.visibility.personHoldings`

### 3. `src/components/orgchart/CapitalBadge.tsx`
- Extracted component rendered inside CompanyNode's right column
- Per share class: colored dot, name, shares count, par value, currency, Vote/Non-vote tag, allocation status
- Collapsible via chevron; default expanded ≤3 classes, collapsed >3

### 4. `src/components/orgchart/CustomEdge.tsx`
- Custom edge using `getBezierPath` from `@xyflow/react`
- Animated `strokeDasharray="5,5"` with CSS keyframes (1.5s cycle)
- Color: >50% green, 25-50% amber, <25% grey; Thickness: 3/2/1.5
- Hover glow via `filter: drop-shadow`
- Rich label via `EdgeLabelRenderer`: white card with share class details
- Edge deduplication: stacked label if multiple classes between same pair
- Label visibility gated by `data.showLabels`

### 5. `src/components/orgchart/ChartControls.tsx`
- Layout dropdown: TB (default), LR, Radial ("Beta" tooltip; silent TB fallback)
- Show/Hide dropdown with 6 checkboxes
- Export PNG button, minimap toggle

### 6. CSS addition in `src/index.css`
```css
@keyframes dashflow {
  to { stroke-dashoffset: -20; }
}
```

## File to Modify

### 7. `src/pages/OrgChart.tsx` — Major refactor

**New state:** `layoutDirection`, `visibility` (6 flags), `showMinimap`, `docStatusMap`, `appointmentMap`

**Data fetching additions** (batch in existing `Promise.all`):
- Documents: compute per-entity doc status (red=expired, amber=expiring ≤60 days, green=valid)
- Appointments: expand to include `role_title, role_category, person_entity_id, company_entity_id` for senior role display

**Node types:** Replace `entityNode` with `companyNode` and `personNode`

**Edge deduplication:** Group links by source+target pair → one custom edge per pair

**Dynamic layout recalculation (user's addition):**
- `getLayoutedElements` accepts `rankdir` and per-node dimensions
- Company node dagre width: `visibility.capitalBadges ? 440 : 280`, height: 150
- Person node dagre width: 260, height: 140
- `nodesep: 100`, `ranksep: 140`
- A `useEffect` watches `layoutDirection` AND `visibility.capitalBadges` — when either changes, re-runs layout with correct node dimensions
- Other visibility toggles (reg numbers, inc dates, person holdings, etc.) do NOT trigger layout recalc — they only show/hide content within existing dimensions

**PNG export:** Uses `getNodesBounds` for proper bounding box calculation

**MiniMap:** Toggle-able, color-coded by entity type

## Technical Notes
- No database migrations required
- No new npm dependencies needed
- All additional data fetched in one batch query
- Capital badge is inside CompanyNode div — captured in PNG, moves with drag
- Radial layout: try/catch with silent TB fallback

