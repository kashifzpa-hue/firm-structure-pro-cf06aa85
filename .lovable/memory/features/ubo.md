---
name: UBO Engine
description: Recursive beneficial ownership calculation with chain visualization, threshold alerts, and compliance registry
type: feature
---
- calculate_ubo RPC traverses equity_links recursively up to 10 layers
- Calculates both economic % (all shares) and voting % (voting shares only)
- Multiple paths for same person are summed (direct + indirect)
- Circular ownership detected and flagged, not crashed
- 25% threshold = legal compliance trigger (UAE Federal Decree-Law No. 13/2023)
- UBO Registry page at /ubo with filters, CSV export, chain visualizer
- Company entity detail has UBO tab with direct shareholders + calculated UBOs + subsidiaries
- Person entity detail has UBO Exposure tab showing all companies they're UBO of
- Dashboard shows UBO Alerts for above-threshold records with passport status
- ubo_snapshots table stores results with live/historical snapshot types
