# Prototypes

Not shipped. Nothing in `src/` imports anything here, and nothing here is in the
build output — that is the point of the folder. These are things that were built
to be looked at and then argued with.

## pixel-arms.html — thirty-one pieces, and a warning about where they go

Thirty-one pieces of 1978 hardware, side-on in a fixed 48 × 16 cell, business
end left, in three finishes: firearms, edge and point and wire, blunt objects
that are also tools, fire, and charges. Drafted off a modern shooter's weapon
sheet, of which almost nothing survived contact with this game and two things
did.

### To look at it

```bash
open prototypes/pixel-arms.html          # or: xdg-open
```

`?scale=4&finish=nickel&by=kind&bg=paper` — finishes are `blued`, `blacked`,
`nickel`; sorts are `cls` and `kind`; grounds are `panel`, `paper`, `alpha`.

### What translated, and what did not

The reference sorts sixty guns by damage and hangs an ammo column and a
crosshair column off the sides. None of that is this game: it is 1978, nobody
aims anything, and there is no damage number anywhere in `src/`. What is worth
stealing is the craft — side-on silhouette, one hard outline, three values, a
fixed cell so a list of them lines up — and the trick that makes such a sheet
affordable, which is that black, silver and gold are one shape and three
palettes rather than three drawings.

So the sheet keeps the technique and re-points both of its axes at things this
game already has an opinion about.

**Down the sheet: what it costs to carry.** `contraband.ts` prices heat per
unit, and a razor in a coat pocket and a shotgun carried down a street are not
the same risk. The classes are `pocket`, `coat`, `long`, and the cell says
which by how much of it the thing fills — the sprite is the stat.

**The other sort: what it leaves behind.** Every row carries one line of it,
and switching the sheet to **by kind** groups on it. This is the axis that
turned out to matter most, because it exposes something in the simulation:
`EvidenceTrace.source` is `'operation' | 'violence' | 'finance' | 'informant'`,
which puts a straight razor and a bundle of sticks in the same bucket. They
are not the same bucket. A razor leaves a body and nothing that traces back; a
charge leaves a crater and three agencies, and in 1978 that is federal rather
than city. If hardware is ever modelled, that distinction is worth more than
any damage number would be — it is the difference between the case the player
is already playing against and a different one opening beside it.

**Across the sheet: where it came from.** Not rarity, which this game has no
concept of. Provenance. *Blued* is what you buy, with a serial on it and a
paper trail somebody else started. *Blacked* is what you use, and no loss when
it goes in a river. *Nickel* is what you were given, worth more than the job
and impossible to sell without saying who by.

### Palette

The metal ramp is the game's own `--carbon` and `--carbon-dim` — the cold
institutional blue reserved for law enforcement. That started as an accident of
what was already in `theme.css` and then it stopped being one: it is the right
colour for steel and the right joke about it. Walnut reuses the brown skin ramp
from `pixel-cast.html` unchanged, and the charges use `--stamp` and
`--stamp-deep` for wrapped paper and `--ok`/`--ok-dim` for a surplus tin —
both already in `theme.css`. Two new darks for the deepest metal, and nothing
else.

### The warning

**Thirty of these thirty-one sprites have nowhere to go.** The simulation does
not model weapons. Crew do not carry anything, operations roll a consequence
rather than a firefight, and violence is a number in `evidence: 'violence'`.
The one sprite the game can ask for today is the crate, because
`TRADE_IDS = ['product', 'arms']` counts crates and nothing finer.

That is not an argument against drawing them, but it is an argument against
pretending this is an art task. Shipping the other fifteen means deciding
first that hardware is a thing the player owns, loses, is traced through and
gives away — and that is a systems decision with a real cost, most of it in
`heat.ts` and `investigation.ts` rather than in pixels.

The cheapest version, if one is wanted: the class is already a heat modifier
and nothing else. A piece carried on an operation shifts the heat it generates
and what a failure leaves behind, and provenance decides whether a recovered
one points at you. That is three numbers and one field on a person, and it
would use most of the firearms and all of the close work. Charges are the one
group that cannot be done that cheaply — the whole reason to have them is that
they change *who* is looking, and there is nowhere in `lawEnforcement.ts` that
currently models a second agency arriving. Draw them, park them, and do not
ship them until that exists.

### One deliberate limit

Following the note at the top of `contraband.ts` — that the contraband economy
is abstract on purpose and nothing should be added that describes how anything
is made, moved or concealed — these are objects, drawn as objects, and the file
says so where somebody adding to it will see it.

## pixel-cast.html — the cast, from parts

`pixel-boss.html` settled what one character is. This is the question that
decides whether the game can have twenty of them: how to draw a cast without
drawing a cast.

Nobody in it is drawn whole. A character is a spec —

```js
{ build:'heavy', hat:'fedora', facial:'tache', garment:'tie', prop:'cigar',
  skin:'olive', suit:'charcoal', hair:'pepper', tie:'blood' }
```

— and `compose()` stamps the parts onto one 32 × 40 grid in order: torso,
garment, neck, face, jaw, facial hair, hair, hat, prop. Later parts win, which
is how a brim shadows a forehead and a beard buries a mouth.

### To look at it

```bash
open prototypes/pixel-cast.html          # or: xdg-open
```

`?scale=6` sets the zoom, `?only=cast|strangers|library|swaps|context` renders
one section alone for capturing a still. **Reroll the strangers** is the button
that matters — see below.

### The one rule that makes it work

Every part shares an anchor. Every face is the same ten columns wide (x11–x20),
every torso opens on the same six (x13–x18), every jaw starts on the same row.
That is why any moustache fits any head and any collar fits any build, and it
is the entire reason the library multiplies instead of accumulating. Break the
anchor for one part and that part needs a variant per head, and the whole thing
degenerates back into a pile of sprites.

Current library: 3 builds × 4 hats (or 5 hairstyles) × 7 kinds of facial hair ×
5 garments × 5 props, over 5 skin tones, 5 cloth colours, 5 hair colours, 3
shirts and 6 ties. Thirty-odd hand-drawn parts; the combinations run to six
figures. Nobody needs six figures of bosses, but the game needs never to draw
the twenty-first one.

### Colour is not shape

The grid holds palette *keys*, not colours; a character supplies the hexes. So
skin, cloth, hair, shirt and tie are free — the **Colour is not shape** section
is one spec rendered five ways twice, and it costs zero pixels. The skin ramp
is five tones from deep to fair, all pulled warm so a face reads as belonging
to this game's palette rather than borrowed from another one.

### Strangers

The **Strangers** row rolls the library at random and is the only honest test
of a parts system: combinations nobody chose, nobody checked, and nobody drew.
If those still read as people, the anchors hold. Anything ugly in that row is a
part that needs fixing, not a bad roll — that is the standard the library is
held to, and it is why the button is there.

### Notes on what is in the cast

The names are the game's own, out of `LEADER_FIRST_NAMES` in
`config/factionLeaders.ts`. That list already generates women as bosses —
Ottavia, Rosalia, Concetta, Serafina — so the cast has them, which is why the
library carries `bun` and `bob` and why nothing about the torso assumes a man.

### The open questions

**Ageing.** The simulation ages people for decades and re-rolls a family's boss
when he dies. A character's portrait should age with him, and the parts system
makes that nearly free — `hair: 'black' → 'pepper' → 'white'`, `hair_style:
'slick' → 'balding'`, and a `build` that widens. Nothing here does it yet, and
the spec is stored as flat strings rather than as anything the simulation could
drive.

**Where the spec lives.** Right now a character is hand-written JSON in the
prototype. In the game it would have to be derived from the person — seeded off
the same RNG that makes them, so the same capo looks the same across a save and
across a reload. That is a small function and it does not exist.

**How much a face should say.** Every one of these has the same eyes. The game's
argument is that you cannot read people, so a portrait that telegraphs mood
would undercut `perceive()` — but a portrait that never changes at all wastes
the one screen where the game stops and looks at somebody. Untouched here.

## pixel-boss.html — three specs, and the direction that won

The game has no character art. Three drafts of the same man — the boss of a
rival family — drawn to three different specs, because the thing actually being
decided is not what he looks like but what every character drawn after him is
committed to. This is the direction that was picked; `pixel-cast.html` is what
was built on top of it.

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

## pixel-boss-silhouette.html — parked, not chosen

The same three specs drawn the opposite way, off an anime reference: the man
as a hole in the light rather than a lit portrait. It was not picked — the
portraits were — and it is kept because two of the things it establishes
survive the decision: character art costs nothing in palette if it has no
skin in it, and a figure needs light behind it before it needs detail on it.

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
open prototypes/pixel-boss-silhouette.html          # or: xdg-open
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
