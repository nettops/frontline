# Prototypes

Not shipped. Nothing in `src/` imports anything here, and nothing here is in the
build output — that is the point of the folder. These are things that were built
to be looked at and then argued with.

## crt-curved-tube.html — parked, awaiting approval

A curved-CRT presentation layer for the game. Green phosphor, real barrel
geometry, the live game running inside it.

### To look at it again

It needs the dev server, because it loads the running game in an iframe rather
than duplicating any markup. Copy it where Vite serves static files, start the
server, and open it:

```bash
mkdir -p public && cp prototypes/crt-curved-tube.html public/__tube.html && npm run dev
```

Then `http://localhost:5173/__tube.html`. Delete `public/` again afterwards — it
is not part of the project and anything left in it ends up in `dist/`.

### What it does

`filter: url(#barrel)` — a real `feDisplacementMap` over the live DOM, so the
content is actually distorted rather than having a vignette painted over it.
One `barrel()` function feeds the three things that have to agree: the
displacement field, the screen mask silhouette, and the pointer inverse.

CSS filters do not move hit testing, so the warped layer takes no pointer
events; a capture layer runs every click, wheel and hover back through the
inverse of the same function before handing it to the document underneath.
Measured: a click aimed at the pixel where a rail button *appears* is 27px from
where that button actually is in layout, and it opens the right panel.

`CRT MODE: ON/OFF` is the A/B against the shipping game. `GEOMETRY ONLY` strips
scanlines, phosphor, bloom, vignette, noise and colour and leaves the
displacement — the screen still reads as curved, which was the acceptance test.

Every tunable is in the `:root` block at the top of the file, and the panel on
the right edits exactly those.

### Known costs, not yet resolved

- **Sharpness at 1x DPR.** Displacement resamples whatever the browser
  rasterised, which softens the smallest table type toward the edges. The
  centre stays sharp. Supersampling by laying the game out at 2x and scaling
  back does not work — CSS `zoom` on an iframe's root does not halve its layout
  viewport — and doing it properly needs a real second buffer (canvas or
  texture), which is a different architecture.
- **Text selection** inside the tube is approximate. Clicks, wheel and hover
  are exact; drag-selecting text is not remapped.

### The open question

A real P1 tube has one phosphor. The game says money, danger, good and cold in
four different colours and a monochrome screen cannot say any of them — only
brighter and dimmer. `Green` keeps the hues and drags them into the tube's
gamut, which no real monitor could do and which stays readable for a long
session. `P1 mono` is the honest version. Both are one click apart in the panel
and the choice has not been made.

### Superseded

The shipped `crt` skin (`src/styles/crt.css`, IBM DOS grey) carries its
curvature entirely in a vignette, and says so in a comment at line 295. That
was the wrong call. If this prototype is approved it replaces that approach;
if it is not, the comment should at least stop claiming the vignette is
sufficient.
