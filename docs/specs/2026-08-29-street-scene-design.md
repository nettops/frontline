# The Street — design

**Date:** 2026-08-29
**Status:** Approved (direction and design approved in session; visual mockups at
https://claude.ai/code/artifact/3ce19ed7-d6b3-4ed6-91ce-982d63111810)

## Summary

A composed side-on pixel scene of the district the player is seated in, at the
top of the Overview. Everything drawn is a readout of state the player is
allowed to see — the same rule the portraits follow. It incorporates the fleet
and fronts prototype sheets as instruments rather than decoration, and it
compounds with the live wire: under ▶ watch, the street changes as the days
run.

## Why this and not sprite decoration

The repo's own bar for art is that it reads state (boss portraits read
personality, crew portraits read familiarity). Gluing sprites beside text on
the Law and Contraband panels fails that bar. A street is the one frame where
the drawn facts are also the fictional facts: surveillance is visibly "cars
that do not belong", stock is crates in the open, standing is a car being
seen.

## Architecture

Two units, the portrait split:

- `src/ui/art/street.ts` — the renderer. A fixed ~192×72-cell scene at
  integer scale on a canvas: four building fronts (48×40 cells each, ported
  from `prototypes/pixel-fronts.html`), a road band, up to four vehicle slots
  (64×24 cells, ported from `prototypes/pixel-fleet.html`), pedestrians,
  crates. Painters are data (row-grids) plus one `blit`; palettes ported
  verbatim (shells + state/hour recolouring; paint ramps + fixed liveries).
- `src/ui/streetLook.ts` — the derivation. Pure
  `streetLook(state): StreetLook`, a reading of state like the briefing and
  the board: never saved, decides nothing, never touches the seeded RNG.
  Incidental layout (which neutral shop where, pedestrian positions) hashes
  off district id and coarse bands, so the street is stable frame to frame
  and only changes when a fact changes.
- `src/ui/StreetScene.tsx` — the mount on the Overview, career and sandbox.
  Canvas is `aria-hidden`; every fact shown is a second telling of a panel.

## Signal table (v1)

| drawn | reads | keyed to |
| --- | --- | --- |
| front lit / dark / shuttered / timbered | your businesses here and their state | `state.businesses` in the seat district |
| neutral shops lit or shut | prosperity band, coarse | district prosperity/sentiment bands the player can read here |
| the unmarked across the street | eyes on you | an open case at a stage whose own flavour says the cars are visible — never hidden case internals |
| box truck + crates | freight front / trade routed here; stock coarse | `contraband.routes`, `stock`, freight business |
| sedan / Lincoln / wedge at the curb | the possession, being seen | `possessions` (car ids) |
| burnt shell, empty pavement | war fought over this ground | war state involving the district's holders |
| pedestrian count | population/sentiment band | district bands |
| night palette | nothing — theatre from the day counter | `state.day % 7` or similar; decides nothing |

## Rules that bind it

1. Fog holds: nothing on the street reveals a number or a fact no panel would
   show. The unmarked keys to fiction-visible surveillance, not case stage
   internals beyond what intel exposes.
2. Presentation decides nothing; the derivation is pure and unsaved.
3. No seeded-RNG draws — hash-based layout, like faces.
4. Motion: none in v1. State changes redraw. Reduced-motion trivially holds.
5. Pedestrians ship as simple figures until the cast library grows its
   full-figure variant (already requested by `pixel-alley.html`'s notes);
   they are a count, not characters.

## Testing

TDD on `streetLook()`:
- war over the seat district → shell present, pedestrians zero
- open surveillance-visible case → unmarked present; no case → provably absent
  (the leak test)
- roadster owned → parked; not owned → absent
- trade routed here with stock → truck and crates; stock zero → no crates
- derivation never calls the RNG (same guard style as portrait tests)

Renderer gets one smoke test in the `bossLook`/`crewLook` mould.

## Addendum, same day: the street got its life

Owner asked for it, so ambient life shipped with the motion rules honoured:

- **Furniture** (trees, a bench with a sitter, lampposts that light at
  night) — geography, hashed per district, reads nothing.
- **Ambient parked cars** fill kerb slots the facts do not need, by the
  `traffic` band — which makes the unmarked stronger: "cars that do not
  belong" only means something on a street that also has cars that do.
- **Passing traffic** — a rAF loop stamping pre-rendered cars over the
  still scene. `look.traffic` (prosperity band; zero in war) drives density.
  Theatre with the night palette's standing: carries nothing, never touches
  the seeded stream, skipped under prefers-reduced-motion, and suspends
  harmlessly with rAF when the page is not composited — a still street
  loses no information because a passing car carries none.

## Out of scope (recorded)

- Territory-panel per-district streets: same renderer, later.
- Gun sprites beyond crates: parked per the armoury sheet's own warning until
  hardware is a system.
