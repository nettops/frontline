# Prototypes

Not shipped. Nothing in `src/` imports anything here, and nothing here is in the
build output — that is the point of the folder. These are things that were built
to be looked at and then argued with.

## pixel-boss.html — three mockups, awaiting a pick

The game has no character art. Three drafts of the same man — the boss of a
rival family — because the thing actually being decided is not what he looks
like but what every character drawn after him is committed to.

### The direction

He is not drawn, he is subtracted. A flat near-black mass against a lit wall,
no face, no shading, no rim light. The only warm thing in the frame is the coal
of a cigarette and the only thing that moves is its smoke.

That is a better fit for this game than the lit portrait it replaced, and not
only because it looks like the reference it came from. `perceive()` exists
because the player is never told what a person actually is — a face with an
expression on it contradicts that on sight. A silhouette does not. It is a man
you can see perfectly well and still cannot read, which is the game's whole
argument about people, drawn.

### To look at it

Open the file. No dev server, no build, no assets — one self-contained page.

```bash
open prototypes/pixel-boss.html          # or: xdg-open
```

Query string sets the controls, for capturing a still at an exact setting:
`?scale=8&bg=lot&grid=on`. Backgrounds are `lot`, `well`, `ledger`, `paper`,
`crt`.

### The three

| | Grid | Framing | Where it would live |
| --- | --- | --- | --- |
| **A** The ember | 24 × 24 | bust | beside a name, in a row |
| **B** The doorway | 32 × 40 | half-figure | a panel header, the sit-down |
| **C** The lot | 32 × 48 | standing | a district, a board |

Same man three times; only the spec varies, so the comparison is about cost and
reach rather than taste. Each is authored in the page as rows of palette keys,
one character per pixel:

```js
'          1111111111  a         ',
'           00000000  a          ',
'             00000055a          ',
'             000000167          ',
```

That is the whole asset pipeline, deliberately — the art is source, so a change
to a figure arrives in review as a changed figure and nobody has to open a
binary to see it.

### What it costs

**Nothing, in palette.** This is the direction's best argument. The lit-portrait
draft needed four new tokens, three of them skin, because `theme.css` defines
ten colours and not one of them is a person. A man who is a hole in the light
has no skin in him: the mass is `--ink-900/800/700`, the coal is `--stamp` and
`--stamp-bright` over `--stamp-deep`, the smoke is `--text-dim` and
`--text-faint`, and the room is `--carbon` and `--carbon-dim`. Every key in the
palette strip at the bottom of the page is a token the game already ships.

**He needs light behind him, and the game is made of shadow.** This is the real
ask and it is not small. Dropped onto `--ink-800`, which is what every panel in
this interface is made of, a black silhouette is nothing — the first context
panel on the page is that failure, deliberately, and all you can see of three
bosses is three coals. The fix is one flat `--carbon-dim` rectangle behind him,
which the next two panels show working at 1x and 2x. But that rectangle is a
new kind of surface in a UI that currently has two, and C wants a floor and a
ceiling as well: it does not sit in the interface, it drags a room in with it.

**The crt skin is fine.** Better than fine — this is the first thing in the
project that looks *more* like itself on the second skin. The shipped `crt` skin
is not monochrome but the sixteen CGA colours, which is what killed the previous
draft: nearest-colour snapping put every lit cheekbone at `#ff5555`, because
`#b3835a` genuinely is closer to bright red than to anything else in the set.
A silhouette does not care. Black stays black, the coal is the one thing CGA is
actually good at, and the room goes grey. Set `?bg=crt` and look.

### The open questions

**Which spec.** A is the only affordable cast — twenty silhouettes is a weekend,
because there is no face to get wrong twenty times — and it goes where character
art helps most, which is a list of three names the player currently cannot tell
apart. Its ceiling is low: every character at that size is the same shape in a
different hat, and there are not many hats. B is the one that can hold four
frames of drifting smoke, which is the cheapest way to make a still interface
feel like somebody is waiting in it. C is the only one standing on ground, which
is the question the territory system is actually asking.

The likely answer is A now, B for the four or five people the game names
repeatedly, C parked until the territory view is something you look at rather
than read.

**Where the light comes from.** A lit well behind a character is a new surface
in a game whose whole visual argument is that there is exactly one light source
and it is a sheet of paper. Either that rule bends for people, or the character
art carries its own room and stops being an icon. Nothing on this page settles
that, and it should be settled before anyone draws the second character.

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
