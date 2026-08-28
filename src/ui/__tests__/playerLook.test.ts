import { describe, expect, it } from 'vitest';

import { newGame } from '../../sim/state';
import { RANKS } from '../../config/economy';
import type { Player, PlayerLook, RankId } from '../../sim/types';
import {
  DEFAULT_PLAYER_LOOK,
  KIT_NOTE,
  PLAYER_FIELDS,
  PLAYER_LABELS,
  PLAYER_OPTIONS,
  lookForPlayer,
  lookFromName,
  randomPlayerLook,
} from '../art/playerLook';
import { compose, paletteFor, SPRITE_H, SPRITE_W } from '../art/parts';

const player = (over: Partial<Player> = {}): Player => ({
  name: 'Vincent Ricci',
  rank: 'street_criminal',
  attributes: {} as Player['attributes'],
  attributeProgress: {} as Player['attributes'],
  opsCompleted: 0,
  opsFailed: 0,
  ...over,
});

describe('what you chose and what the ladder chose', () => {
  /*
     The whole design, as an assertion. You pick the person; the rank picks
     the clothes. If a promotion changed the man rather than the coat, the
     customiser would be handing the player something the game then takes
     away.
  */
  it('keeps the person and changes the clothes as you climb', () => {
    const look: PlayerLook = {
      build: 'heavy', skin: 'deep', hair: 'grey', hair_style: 'bald',
      facial: 'beard', hat: false,
    };
    const low = lookForPlayer(player({ look, rank: 'street_criminal' }));
    const high = lookForPlayer(player({ look, rank: 'underboss' }));

    for (const key of ['build', 'skin', 'hair', 'facial'] as const) {
      expect(high[key], `${key} changed with rank`).toBe(low[key]);
    }
    // and the cloth did move
    expect(high.suit).not.toBe(low.suit);
    expect(high.garment).not.toBe(low.garment);
  });

  it('dresses every rank, and has a line to say what in', () => {
    const seen = new Set<string>();
    for (const rank of RANKS.map((r) => r.id as RankId)) {
      const look = lookForPlayer(player({ rank }));
      expect(look.suit, `${rank} has no suit`).toBeTruthy();
      expect(KIT_NOTE[rank], `${rank} has no kit note`).toBeTruthy();
      seen.add(`${look.hat}/${look.garment}/${look.suit}`);
    }
    // The point of a gradient is that it is one: several distinct kits across
    // the seven rungs, not the same coat with the label changed.
    expect(seen.size, 'the ladder is wearing one outfit').toBeGreaterThanOrEqual(4);
  });

  /*
     A hat covers the hair, so a player who picked a haircut and was then
     promoted into a fedora would silently lose the thing they chose. That is
     why wearing one is a choice and the rank only decides which.
  */
  it('lets you keep your own head', () => {
    const bare = { ...DEFAULT_PLAYER_LOOK, hair_style: 'bob' as const, hat: false };
    const hatted = { ...bare, hat: true };
    const capoBare = lookForPlayer(player({ look: bare, rank: 'capo' }));
    const capoHat = lookForPlayer(player({ look: hatted, rank: 'capo' }));

    expect(capoBare.hat).toBe('none');
    expect(capoBare.hair_style).toBe('bob');
    expect(capoHat.hat).not.toBe('none');
    expect(capoHat.hair_style).toBe('none'); // the hat is over it
  });

  it('gives a low rank nothing to put on even if you would wear it', () => {
    // You cannot be handed a homburg on day one; there is nothing to wear yet.
    const look = { ...DEFAULT_PLAYER_LOOK, hat: true, hair_style: 'slick' as const };
    const day1 = lookForPlayer(player({ look, rank: 'street_criminal' }));
    expect(day1.hat).toBe('none');
    expect(day1.hair_style).toBe('slick');
  });
});

describe('a player who never chose', () => {
  /*
     Every save written before the customiser existed. `Player.look` is
     optional precisely so those load rather than being rejected — save.ts has
     no migrations, so an additive optional field is the only kind that can be
     added without invalidating every save anybody has.
  */
  it('still has a face, derived from the name', () => {
    const look = lookForPlayer(player({ look: undefined }));
    expect(look.skin).toBeTruthy();
    expect(look.suit).toBeTruthy();
    expect(compose(look)).toHaveLength(SPRITE_H);
  });

  it('derives the same face every time', () => {
    expect(lookFromName('Vincent Ricci')).toEqual(lookFromName('Vincent Ricci'));
    expect(lookFromName('Vincent Ricci')).not.toEqual(lookFromName('Maria Ricci'));
  });

  it('reads the name flag rather than guessing', () => {
    // config/names.ts: the pools carry it, and a derived face must obey it.
    expect(lookFromName('Maria Ricci').facial).toBe('none');
    expect(lookFromName('Rosa Corveti').facial).toBe('none');
    // ...and asserts nothing about a name from no pool
    expect(lookFromName('Zephaniah Quill').facial).toBe('none');
  });

  it('has something to draw even with no name at all', () => {
    expect(() => compose(lookForPlayer(player({ name: '', look: undefined })))).not.toThrow();
  });
});

describe('the customiser', () => {
  it('offers every field it claims to, with a label for every value', () => {
    for (const { key } of PLAYER_FIELDS) {
      const options = PLAYER_OPTIONS[key] as unknown[];
      expect(options?.length, `${key} has no options`).toBeGreaterThan(1);
      for (const o of options) {
        expect(PLAYER_LABELS[key]?.[String(o)], `${key}=${o} has no label`).toBeTruthy();
      }
    }
  });

  it('only ever randomises into options the cyclers can reach', () => {
    // Otherwise Randomise could produce a look the player cannot get back to.
    for (let i = 0; i < 200; i++) {
      const look = randomPlayerLook(() => (i * 0.0137 + 0.01) % 1);
      for (const { key } of PLAYER_FIELDS) {
        expect(PLAYER_OPTIONS[key] as unknown[]).toContain(look[key]);
      }
    }
  });

  it('composes a full sprite for every single option', () => {
    for (const { key } of PLAYER_FIELDS) {
      for (const value of PLAYER_OPTIONS[key] as unknown[]) {
        for (const rank of RANKS.map((r) => r.id as RankId)) {
          const look = lookForPlayer(
            player({ look: { ...DEFAULT_PLAYER_LOOK, [key]: value }, rank }),
          );
          const rows = compose(look);
          expect(rows, `${key}=${value} at ${rank}`).toHaveLength(SPRITE_H);
          expect(rows[0]).toHaveLength(SPRITE_W);
          // every key in the grid has to be in the palette, or it paints magenta
          const pal = paletteFor(look);
          for (const row of rows) {
            for (const k of row) {
              if (k === '.') continue;
              expect(pal[k], `${key}=${value} at ${rank}: no palette entry for "${k}"`).toBeTruthy();
            }
          }
        }
      }
    }
  });
});

describe('starting a game with a face', () => {
  it('carries the choice onto the player', () => {
    const look = randomPlayerLook(() => 0.42);
    const state = newGame({ name: 'Rosa Corveti', difficulty: 'normal', seed: 7, look });
    expect(state.player.look).toEqual(look);
  });

  it('leaves it unset when nobody chose, rather than inventing a default', () => {
    const state = newGame({ name: 'Rosa Corveti', difficulty: 'normal', seed: 7 });
    expect(state.player.look).toBeUndefined();
    // ...and the portrait still resolves
    expect(lookForPlayer(state.player).skin).toBeTruthy();
  });

  it('costs the simulation no random draws', () => {
    const state = newGame({ name: 'Rosa Corveti', difficulty: 'normal', seed: 909 });
    const before = state.rng.calls;
    lookForPlayer(state.player);
    lookFromName(state.player.name);
    expect(state.rng.calls).toBe(before);
  });
});
