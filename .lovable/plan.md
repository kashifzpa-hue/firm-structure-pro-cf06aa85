

# Build Execution — Four Data Visualisations

## Confirmed Plan
The plan was approved with all three additions. Proceeding with implementation in order 1 → 2 → 3 → 4, with screenshots after each.

## Visualisation 1 — UBO Chain Visualiser (Starting Now)

**File:** `src/components/ubo/UBOChainVisualizer.tsx` — full rewrite

**What changes:**
- Replace the two-panel layout (left text + right flow) with a single-column layout: animated React Flow diagram on top, calculation panel below
- Three custom node types: `uboPersonNode` (gradient blue, 220px), `uboCompanyNode` (navy, 220px), `uboTargetNode` (dark blue with TARGET badge)
- Animated edges using existing `dashflow` keyframe, colored by ownership % (green >50%, amber 25-50%, red <25%)
- Sequential fade-in animation via CSS transition delays
- `fitView` prop for auto-zoom on deep chains (>4 nodes)
- Container height: `min(600px, 100%)` with React Flow handling scroll
- Calculation panel below with two side-by-side cards (economic/voting formulas)

**No changes to `UBORegistry.tsx`** — same props interface, same dialog wrapper.

## Remaining (after Vis 1 confirmed):
- **Vis 2:** `CapTableWaterfall.tsx` — horizontal stacked bar charts in EntityDetail Ownership tab
- **Vis 3:** `KYCHealthGrid.tsx` — radial gauges on Dashboard (3-source doc calculation)
- **Vis 4:** `MovementTimeline.tsx` — horizontal timeline with play/pause in LedgerTab

