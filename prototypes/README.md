# Prototypes

Not shipped. Nothing in `src/` imports anything here, and nothing here is in the
build output — that is the point of the folder. These are things that were built
to be looked at and then argued with.

## pixel-boss.html — three mockups, awaiting a pick

The game has no character art. Three drafts of the same man — the boss of a
rival family — drawn to three different specs, because the thing actually being
decided is not what he looks like but what every character drawn after him is
committed to.

### To look at it

Open the file. No dev server, no build, no assets — it is one self-contained
page.

```bash
open prototypes/pixel-boss.html          # or: xdg-open
```

Query string sets the controls, for capturing a still at an exact setting:
`?scale=8&bg=ledger&grid=on`. Backgrounds are `alpha`, `ledger`, `paper`, `crt`.

### The three

| | Grid | Colours | Framing | Where it would live |
| --- | --- | --- | --- | --- |
| **A** The stamp | 24 × 24 | 6 | bust | beside a name, in a row |
| **B** The sitting | 32 × 40 | 12 | half-figure, holds a cigar | a panel header, the sit-down |
| **C** The standing | 32 × 48 | 9 | full figure | a district, a board |

They are the same man on purpose. What varies between them is only the spec, so
the comparison is about cost and reach rather than about taste.

Each is authored in the page as rows of palette keys, one character per pixel:

```js
'........cdeddedc........',
'........cdd00ddc........',
```

That is the whole asset pipeline, and it is deliberate — the art is source, so a
change to a face shows up in a diff as a changed face, and nobody has to open a
binary to review it.

### What it costs, in the only two places it costs anything

**Four new palette entries.** `theme.css` defines ten colours and not one of
them is skin, because until now nothing in this interface has been a person.
Characters need a warm three-step skin ramp and one lift above `--line` to keep
a lapel off a shoulder. They are pulled toward the tobacco end so a face does
not read as an asset from a different game — but they are still four tokens the
visual system did not have, and they are marked NEW in the palette strip at the
bottom of the page.

**The CRT skin cannot have them for free.** The shipped `crt` skin is not
monochrome, it is the sixteen CGA colours, which is worse: no brown, nothing
near skin. Snapping each colour to its nearest CGA entry — the obvious
automatic answer — turns every lit cheekbone bright red, because `#b3835a` is
genuinely closer to `#ff5555` than to anything else in the set. The metric is
not wrong; it just does not know a face is a face. The page ships a hand-picked
CGA colour per palette key instead, and the `crt mono` background renders
through it. So: every sprite the game gains needs that table written by hand,
and no conversion will produce it.

### The open question

Which spec, and it is not a tie.

**A** is the only one whose cast is affordable — twenty of these is a weekend,
twenty of B is an art budget — and the only one that fits where character art
would help most, which is a row of names the player cannot currently tell apart.
It also cannot ever show state: this man has no room on him to look worried when
his family is losing, and the game's whole subject is people whose feelings
about you change.

**B** is the one that can. It is also the only one that can hold a prop, which
matters more than it sounds — the sit-down is the one screen where the game
stops and looks at a person.

**C** is the only one that answers a question the game is actually asking,
because territory is about someone standing on ground. It is also the one whose
face will never be the character.

The likely real answer is A now and B later for the four or five people the game
names repeatedly, with C parked until the territory view is something you look
at rather than read. That is a recommendation, not a decision.

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
