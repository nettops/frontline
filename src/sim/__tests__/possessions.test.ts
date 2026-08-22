/**
 * Things that are yours, and what they cost you.
 *
 * The design note is in `config/possessions.ts`. This file holds the layer to
 * the standard the blueprint set for it, which is higher than usual because
 * the evidence behind it is one sentence from one tester about a
 * neighbourhood, and a neighbourhood is not a car.
 *
 * Five properties, and the layer is decoration if any one of them fails.
 *
 * **It has to be a trade.** A possession that only gives is a reward, and the
 * game has enough of those. Buying must cost liquidity and selling must cost
 * money, or the correct play is to buy everything.
 *
 * **It has to be two-sided.** The loud things raise standing *and* put your
 * name in the papers. If the flashy car were strictly better than the quiet
 * one the catalogue would be a ladder rather than a choice.
 *
 * **It has to be reachable.** Thirty of thirty-six careers finish under
 * $100,000. A catalogue whose cheapest item is $20,000 is content for the
 * players who least need it.
 *
 * **It can be taken.** An asset a warrant cannot reach is a trophy.
 *
 * **It must not move the random stream when nobody bought anything.** The
 * lazy-initialiser rule that whispers broke on the day it was written.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { estate } from '../estate';
import { legitimacy, postMortem } from '../legacy';
import { priced } from '../market';
import { home, goHome } from '../personal';
import {
  buyPossession,
  canBuyPossession,
  heldPossessions,
  ownsHome,
  possessionValue,
  possessions,
  sellPossession,
  seizeOnePossession,
} from '../possessions';
import { POSSESSION, POSSESSION_BY_ID, POSSESSIONS } from '../../config/possessions';
import type { GameState } from '../types';

function game(seed = 4, clean = 250_000): GameState {
  const state = newGame({ name: 'Owner', difficulty: 'normal', seed });
  state.org.cash = clean;
  return state;
}

/** The one thing everything else here is measured against. */
function buy(state: GameState, defId: string) {
  const rng = new Rng(state.rng);
  const result = buyPossession(state, rng, defId);
  expect(result.ok, result.ok ? '' : result.reason).toBe(true);
  return result;
}

describe('owning something', () => {
  it('is empty before anybody asks, and does not roll to find that out', () => {
    const state = game();
    const before = state.rng.calls;
    expect(possessions(state)).toEqual([]);
    expect(heldPossessions(state)).toEqual([]);
    expect(ownsHome(state)).toBe(false);
    // The whispers mistake: a lazy initialiser that touches the stream
    // reshuffles every later roll in a career that loaded an old save.
    expect(state.rng.calls).toBe(before);
  });

  it('takes the money out of the clean pool and nowhere else', () => {
    const state = game();
    state.org.dirtyCash = 500_000;
    const cleanBefore = state.org.cash;
    const dirtyBefore = state.org.dirtyCash;

    buy(state, 'lincoln');

    const price = priced(state, POSSESSION_BY_ID.lincoln.cost);
    expect(state.org.cash).toBe(cleanBefore - price);
    /*
       The rule the whole catalogue rests on. `spend()` takes dirty first, so
       using it here would let a boss turn a suitcase into a Lincoln — which is
       laundering, and laundering is what fronts are for.
    */
    expect(state.org.dirtyCash).toBe(dirtyBefore);
  });

  it('refuses by naming both figures, the way every other refusal here does', () => {
    const state = game(4, 900);
    const no = canBuyPossession(state, 'roadster');
    expect(no.ok).toBe(false);
    expect(no.reason).toMatch(/\$/);
    // Not "you cannot afford this". What it costs, and what you have.
    expect(no.reason).toMatch(/900/);

    const rng = new Rng(state.rng);
    const attempt = buyPossession(state, rng, 'roadster');
    expect(attempt.ok).toBe(false);
    expect(state.org.cash).toBe(900);
  });

  it('cannot be bought twice', () => {
    const state = game();
    buy(state, 'watch');
    expect(canBuyPossession(state, 'watch').ok).toBe(false);
  });
});

describe('the trade it is meant to be', () => {
  it('leaves the estate where it was — you swapped money for a thing', () => {
    const state = game();
    const before = estate(state).total;
    buy(state, 'house_hill');
    /*
       Counts at face, exactly as `holdings` does. Buying a possession is not
       supposed to move rank in either direction; what it moves is what you can
       do tomorrow.
    */
    expect(estate(state).total).toBe(before);
    expect(estate(state).possessions).toBe(priced(state, POSSESSION_BY_ID.house_hill.cost));
  });

  it('gives back less than it took', () => {
    const state = game();
    const before = state.org.cash;
    buy(state, 'necklace');
    const paid = before - state.org.cash;

    const back = sellPossession(state, 'necklace');
    expect(back.ok).toBe(true);
    expect(state.org.cash).toBeLessThan(before);
    expect(state.org.cash - (before - paid)).toBe(
      Math.round(paid * POSSESSION.sellBackShare),
    );
    expect(heldPossessions(state)).toEqual([]);
    // Kept on file rather than spliced out — a career is partly a record.
    expect(possessions(state).some((p) => p.status === 'sold')).toBe(true);
  });

  it('cannot be sold twice, and an unowned thing cannot be sold at all', () => {
    const state = game();
    buy(state, 'sedan');
    expect(sellPossession(state, 'sedan').ok).toBe(true);
    expect(sellPossession(state, 'sedan').ok).toBe(false);
    expect(sellPossession(state, 'roadster').ok).toBe(false);
  });
});

describe('the two sides of being seen', () => {
  /*
     The property that stops the catalogue being a ladder.

     A visible thing raises the share of your worth that is out in the open,
     which is what `legitimacy` rewards. The same visibility is what the papers
     print, which raises notoriety, which `legitimacy` punishes through
     `unnamed` and which every civic figure reads as a reason to keep their
     distance.

     Measured against a *matched pair*: same money, different visibility. Two
     different prices would confound the thing being measured with the size of
     the purchase, which is how this project has produced thirty instruments
     that measured something other than what they claimed.
  */
  it('buys standing with the quiet thing and attention with the loud one', () => {
    const price = (id: string) => POSSESSION_BY_ID[id].cost;
    /*
       The pair the catalogue was built to contain, and it is checked rather
       than assumed — this guard has already earned its place. The original
       pair was the necklace against the apartment, and repricing the
       apartment down to the median career's ceiling silently turned a
       visibility experiment into a price experiment. The test went red on its
       own premise instead of passing while measuring the wrong thing.
    */
    expect(Math.abs(price('lincoln') - price('apartment'))).toBeLessThan(
      price('lincoln') * 0.25,
    );
    expect(POSSESSION_BY_ID.apartment.visibility).toBeLessThan(
      POSSESSION_BY_ID.lincoln.visibility,
    );

    const loud = game();
    const quiet = game();
    const noteBefore = loud.city.notoriety;

    buy(loud, 'lincoln');
    buy(quiet, 'apartment');

    expect(loud.city.notoriety).toBeGreaterThan(noteBefore);
    expect(loud.city.notoriety).toBeGreaterThan(quiet.city.notoriety);
    // And the visible half of it is worth more standing, before the papers
    // take their cut back off again.
    expect(estate(loud).visible).toBeGreaterThan(estate(quiet).visible);
  });

  it('raises legitimacy for a boss with something to show', () => {
    /*
       Held to the term rather than to the total, and the difference matters.

       `legitimacy` has four parts and buying something moves two of them in
       opposite directions, so a bare "legitimacy went up" would pass or fail
       on the balance of two config weights rather than on whether possessions
       work. The claim being made is narrower and it is the true one: a boss
       whose worth is all wallet reads as less legitimate than the same boss
       who put some of it into something people can see.
    */
    const wallet = game(9, 120_000);
    const shown = game(9, 120_000);
    buy(shown, 'house_hill');
    // Notoriety held equal, so only the visible-holdings term differs.
    shown.city.notoriety = wallet.city.notoriety;
    expect(legitimacy(shown)).toBeGreaterThan(legitimacy(wallet));
  });
});

describe('reachable by the careers that need it', () => {
  it('opens well below what a stuck career finishes with', () => {
    const state = game();
    const cheapest = Math.min(...POSSESSIONS.map((p) => p.cost));
    /*
       Thirty of thirty-six careers finish under $100,000 and the median
       estate at day 300 is $29,759. A catalogue that starts above five
       thousand is a catalogue for the sixth of players who least need one.
    */
    expect(cheapest).toBeLessThanOrEqual(5_000);
    expect(possessionValue(state, POSSESSION_BY_ID.watch)).toBeLessThanOrEqual(
      priced(state, 5_000),
    );
  });

  it('offers something in every kind at the bottom of the money', () => {
    const kinds = new Set(POSSESSIONS.filter((p) => p.cost <= 25_000).map((p) => p.kind));
    expect([...kinds].sort()).toEqual(['car', 'home', 'jewellery']);
  });
});

describe('what a warrant can reach', () => {
  it('takes the best thing in the house and says so', () => {
    const state = game();
    buy(state, 'watch');
    buy(state, 'roadster');
    const logBefore = state.log.length;

    const taken = seizeOnePossession(state, 'the Bureau');
    expect(taken?.defId).toBe('roadster');
    expect(heldPossessions(state).map((p) => p.defId)).toEqual(['watch']);
    expect(possessions(state).find((p) => p.defId === 'roadster')?.status).toBe('seized');
    expect(state.log.length).toBeGreaterThan(logBefore);
  });

  it('gives nothing back, which is the whole point of it', () => {
    const state = game();
    buy(state, 'lincoln');
    const cash = state.org.cash;
    seizeOnePossession(state, 'the Bureau');
    expect(state.org.cash).toBe(cash);
    expect(estate(state).possessions).toBe(0);
  });

  it('is quiet when there is nothing to take', () => {
    const state = game();
    expect(seizeOnePossession(state, 'the Bureau')).toBeNull();
  });
});

describe('what you would have lost', () => {
  /*
     The row that is the whole reason this layer exists.

     Round 15 was asked what would have gone if it had all gone and answered
     *"honestly: not much, and that is the damning part"*. A career that ends
     holding something, or having had something taken, has an answer.
  */
  it('names what was yours on the post-mortem, and what happened to it', () => {
    const state = game();
    buy(state, 'lincoln');
    buy(state, 'watch');
    state.day = 212;
    seizeOnePossession(state, 'the Bureau');
    sellPossession(state, 'watch');

    const row = postMortem(state).find((l) => /yours/i.test(l.label));
    expect(row, 'the post-mortem says nothing about what was yours').toBeDefined();
    expect(String(row!.value)).toMatch(/lincoln continental \(taken on day 212\)/i);
    expect(String(row!.value)).toMatch(/watch \(sold on day 212\)/i);
  });

  it('says nothing at all for a boss who never bought anything', () => {
    const state = game();
    expect(postMortem(state).some((l) => /yours/i.test(l.label))).toBe(false);
  });
});

describe('the personal half', () => {
  it('makes an evening at home worth more when the house is yours', () => {
    const rented = game();
    const owned = game();
    buy(owned, 'apartment');
    expect(ownsHome(owned)).toBe(true);
    expect(ownsHome(rented)).toBe(false);

    for (const state of [rented, owned]) {
      const house = home(state);
      house.neglect = 90;
      house.lastVisitDay = -999;
      goHome(state);
    }
    expect(home(owned).neglect).toBeLessThan(home(rented).neglect);
  });

  it('does not count a car as somewhere to live', () => {
    const state = game();
    buy(state, 'roadster');
    expect(ownsHome(state)).toBe(false);
  });
});
