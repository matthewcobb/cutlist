# Packing Roadmap

Future improvements to the bin-packing tournament, roughly ordered by ROI.

## Current state (2026-04)

- **Tournament**: 11 deterministic passes, scored by board count → waste → cut complexity. See `web/lib/index.ts`.
- **`cuts` mode**: `GuillotinePacker` — free-rectangle tracking, BSSF/BAF/BLSF fit heuristics, SAS split, rectangle merge. Strictly guillotine-cuttable.
- **`cnc` mode**: `TightPacker` — greedy bottom-left placement. Allows non-guillotine layouts (use with CNC routers only).

Benchmarks in the literature put BSSF+SAS+RM heuristics at roughly 1–3% over theoretical optimum on typical loads. We're probably close to that today.

## Tier 1 — Queued, high ROI, low risk

### 1. Consolidation pass

After the tournament picks a winner, attempt to redistribute the parts from the least-filled board into free rectangles on earlier boards. Often eliminates a board outright when the heuristics produced a mostly-empty final sheet.

- **Where**: new step in `runSearchPass` / `runMultiPassSearch` after `minimizeLayoutStock`.
- **Approach**: identify the layout with the lowest fill ratio; re-run the packer on its parts against the free-space maps of all earlier boards; if all parts fit, drop the board and merge.
- **Risk**: low — it's a pure improvement; layouts only change if they strictly beat the original by board count.

### 2. Multi-stock-size loop

When a material has multiple available stock sizes (e.g., 4×8 + 5×5 plywood), run the tournament against each combination and pick the lowest _cost_ — not just lowest board count.

- **Where**: wrap `runMultiPassSearch` in an outer loop over stock combinations.
- **Needs**: a cost field on `Stock` (currently absent) — or default to cost ≈ area.
- **Risk**: adds combinatorial blowup; cap at N best stock sizes per material.

### 3. Reweight layout scoring

Currently `compareLayoutScores` goes board count → waste area → cut complexity. Two layouts using the same board count but one with `[95%, 95%]` utilization vs. `[98%, 40%]` score similarly on waste area, but the first is clearly better for practical reasons (leftover piece is reusable).

- **Where**: `web/lib/packers/layout-score.ts`.
- **Ideas**: penalize variance in per-board fill ratios; or add a "largest offcut" term that rewards keeping one big usable remnant.
- **Risk**: medium — requires calibrating weights against real-world layouts; regression-test against a corpus of known-good outputs.

## Tier 2 — Algorithmic additions

### 4. MaxRects-BSSF for `cnc` mode

Replace `TightPacker` with a proper MaxRects implementation. The [`maxrects-packer`](https://github.com/soimy/maxrects-packer) npm package (MIT, TS-native) is a drop-in.

- **Where**: new `MaxRectsPacker.ts` adapter wrapping the library.
- **Gain**: likely 3–8% better yield in CNC mode.
- **Caveat**: doesn't help tablesaw/track saw users (guillotine is the binding constraint for them).

### 5. Additional tournament variants

Low-effort passes to add: sort-by-perimeter, sort-by-side-ratio, sort-by-difference-of-sides. The Jylänki "A Thousand Ways to Pack the Bin" paper shows these occasionally win on irregular part mixes.

- **Risk**: adds pass time linearly. Already have 12 passes; keep an eye on total wall-clock for large inputs, since every default pass now runs to completion.

### 6. Skyline-BL for `cnc` mode

As a second CNC voice alongside MaxRects. Faster per-pass, sometimes produces complementary layouts. Worth it only if #4 lands first and there's demand for more CNC quality.

## Tier 3 — Provably optimal (speculative)

### 7. OR-Tools CP-SAT via Python sidecar

[Google OR-Tools CP-SAT](https://developers.google.com/optimization) can solve 2D guillotine cutting to **provable optimality** for ≤30 parts in under a second, and near-optimal for ≤100 parts in seconds.

- **Architecture**: Python service (Flask/FastAPI) called from the Nuxt server (`web/server/api/...`), invoked behind a "Deep Optimize" button. Not the default path — too slow for interactive tweaking.
- **Deployment cost**: Python runtime hosted somewhere (Fly/Railway/Lambda), cold starts, ongoing maintenance.
- **When worth it**: only if cabinet shops or production users are asking for the last 1–3% yield on expensive material. Don't build speculatively.

### 8. WASM-compiled packer

Compile [`juj/RectangleBinPack`](https://github.com/juj/RectangleBinPack) (C++) to WASM as an alternative to #7 — keeps everything client-side and avoids infrastructure, at the cost of a build pipeline. ~3–10× faster than the TS packers, but for typical part counts we're not CPU-bound, so this is mostly about opening up more expensive heuristics (e.g., genetic / simulated annealing) that would be too slow in pure TS.

## What we're explicitly _not_ building

- **Irregular-shape nesting (SVGnest/Deepnest, NFP-based)** — overkill for rectangles, and parts are always axis-aligned rectangles in this tool.
- **Machine-learning packers** — research shows marginal wins vs. classical heuristics for 2D rectangles, with much higher complexity.
- **Column generation / Gilmore-Gomory LP** — strong for _one_-dimensional cutting stock; for 2D guillotine the heuristics already get within 1–3% of optimum, and LP-based approaches are significantly slower and harder to integrate.

## References

- J. Jylänki, ["A Thousand Ways to Pack the Bin"](https://github.com/juj/RectangleBinPack) — the canonical survey
- [`secnot/rectpack`](https://github.com/secnot/rectpack) — the Python library we ported the guillotine heuristics from
- [`soimy/maxrects-packer`](https://github.com/soimy/maxrects-packer) — candidate for #4
