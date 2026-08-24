# Art direction — what has to match, and what shouldn't

Written after a correction that was right: several entries in this folder
argued that a piece "could not ship" or that two pixel scales "cannot both be
right". That is not art direction. That is uniformity being enforced and
called rigour, and a game whose art is all held to one grid is a game with no
character in it.

A panel portrait, a map token, an inventory icon and a cutscene frame have
different jobs. They should look like it.

## The three things that actually have to match

**1. The palette family.** Warm tobacco darks, brass used sparingly, stamp red
for danger, carbon blue for the cold institutional things. Every sheet in this
folder draws from it; the alley scene extends it with concrete, haze and
sunlight and stays recognisably the same world. Extending the palette for a
piece is fine. Leaving the family is not — that is what makes an asset look
borrowed from a different game.

**2. One light logic per piece, and a warm key.** Not one light *direction*
across the whole project — a portrait lit from the front and a scene lit from
the upper left are both correct. What has to hold is that a piece decides where
its light is and then obeys itself: same key, same fill, shadows that agree
about direction, and warm highlights against cool shadow rather than the other
way round.

**3. Craft floor.** No smoothing, integer scale, a considered outline where a
sprite sits on unpredictable ground, and no gradient that is not dithered.
These are the things that make pixel art read as pixel art rather than as a
scaled-down image, and they are cheap to hold everywhere.

## The things that are deliberately free

**Pixel scale.** 32 × 40 for a cast portrait, 48 × 16 for an inventory object,
64 × 24 for a vehicle, 96 × 56 for a room, 320 × 200 for a cinematic frame.
These are different resolutions on purpose, because the alternative is either
an icon with wasted pixels or a scene with none to spare.

**Fidelity.** An icon that has to read at 1× wants flat colour and a strong
silhouette. A frame the player looks at for thirty seconds wants dithered
ramps, contact shadows and ambient occlusion. Holding the frame down to the
icon's fidelity, which is what the earlier entries in this folder argued for,
just makes the frame worse.

**Framing, and how much of a thing you see.** A bust, a half-figure, a whole
man in a lot — all three are on this branch and all three are correct for
where they go.

**Mood.** The armoury is inventory: even light, no drama. The alley is a
scene: low sun, deep shadow, one warm shaft. The sit-down room is a place
somebody is waiting in. These *should* feel different.

## How to tell the difference in review

The question is never "does this match the other sheets". It is:

- Does it belong to the same **world** — palette, period, materials?
- Does it obey **its own** light?
- Is the craft floor held?
- Does the extra fidelity **do something**, or is it detail for its own sake?

Four yeses is a piece that belongs, whatever grid it is drawn on.

## What was corrected in this folder

`pixel-alley.html` was written up with two claims that have been removed: that
its ~140px figures and the cast sheet's 32 × 40 figures "cannot both be right",
and that a cinematic frame "does not belong in the shipping UI". The first is
false — they are different shots. The second is a product decision and not the
art's to make; the honest version is that the game has no screen for it *yet*,
which is a reason to build one, not a reason to hold the art back.

The engineering caveats elsewhere in the README stay, because they are about
systems rather than style: the armoury really does draw hardware the
simulation does not model, and saying so is useful. "This does not match the
other sheets" is not the same kind of statement and has been taken out.
