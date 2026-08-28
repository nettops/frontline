/**
 * The things a boss owns that are theirs rather than the organization's.
 *
 * The design note is in `config/possessions.ts`. The mechanics that matter:
 *
 * **The list is lazily created and touches the random stream nowhere.** Same
 * idiom as `promises`, `civic`, `home` and `whispers`, so `SAVE_VERSION` does
 * not move. Unlike `home` there is nothing to derive, so there is not even a
 * `stableNoise` call — a boss who has bought nothing owns nothing, and an
 * empty array is the whole of the initialiser.
 *
 * **Clean money only, so `spend()` is deliberately not used.** `spend` takes
 * dirty first by design, which is right for everything the organization does
 * and wrong for this: a house bought out of a suitcase is a laundry, and
 * laundering is what fronts are for. The two lines that move the pool by hand
 * are the point rather than a shortcut.
 *
 * **A leaf, near enough.** It reads config, the market for prices, and the
 * papers for the item that runs when you buy something loud. `estate.ts`,
 * `legacy.ts`, `investigation.ts` and `personal.ts` all read *this*; it reads
 * none of them, which is what keeps `estate` → `possessions` → `estate` from
 * being a cycle.
 */

import { Rng } from './rng';
import { addLog, formatMoney } from './util';
import { priced } from './market';
import { cover } from './perception';
import { note } from './ledger';
import { adjustSentiment, hasPresence, territoryList } from './territory';
import { PAYDAY_INTERVAL } from '../config/economy';
import { POSSESSION, POSSESSIONS, POSSESSION_BY_ID, type PossessionDef } from '../config/possessions';
import type { GameState, Possession } from './types';

/**
 * Everything the boss has ever owned, sold ones and seized ones included.
 *
 * Created on first read. No roll, so a save written before this existed loads
 * without moving a single later call in that career.
 */
export function possessions(state: GameState): Possession[] {
  if (!state.possessions) state.possessions = [];
  return state.possessions;
}

/** The ones that are still yours. */
export function heldPossessions(state: GameState): Possession[] {
  return possessions(state).filter((p) => p.status === 'held');
}

export function possessionDef(p: Possession): PossessionDef | undefined {
  return POSSESSION_BY_ID[p.defId];
}

/**
 * What a thing is worth today, in this year's money.
 *
 * Face value, exactly as `holdings` counts. What was actually handed over is
 * kept on the record separately, because prices move and the resale line has
 * to be able to say what the player paid rather than what the catalogue says
 * today.
 */
export function possessionValue(state: GameState, def: PossessionDef): number {
  return priced(state, def.cost);
}

/**
 * What a boss can put toward something in his own name.
 *
 * The wallet plus what is put away, and no dirty money at any point — money in
 * a box at a bank got there through `putAway`, which only ever draws on the
 * clean pool, so none of it can be a suitcase.
 *
 * Holdings were left out of this for a long time, and the omission was a side
 * effect rather than a decision: the rule the catalogue rests on is about
 * *dirty* money, and the refusal message says so. Measured over 10,569
 * career-days, the cash-only rule put the dearest thing on the shelf out of
 * reach on every single one — the $160,000 house was affordable on 0% of days
 * against 39% once holdings count. It was not priced high, it was walled off.
 *
 * `canAcquire` has always counted holdings toward a front, and diplomacy has
 * always counted them toward what you can put on the table. This is the third
 * system agreeing with the two that already did.
 */
export function cleanPurse(state: GameState): number {
  return state.org.cash + (state.org.holdings ?? 0);
}

/** What everything still owned would be counted at. */
export function possessionsWorth(state: GameState): number {
  return heldPossessions(state).reduce((sum, p) => {
    const def = possessionDef(p);
    return def ? sum + possessionValue(state, def) : sum;
  }, 0);
}

/**
 * The share of that worth which is out where people can see it.
 *
 * `legitimacy` asks what proportion of a family's worth is visible rather than
 * in a drawer, and a watch under a cuff is a drawer. Same `visibility` figure
 * that decides how loudly the papers cover the purchase — one number, both
 * halves of the same fact.
 */
export function possessionsVisible(state: GameState): number {
  return heldPossessions(state).reduce((sum, p) => {
    const def = possessionDef(p);
    return def ? sum + possessionValue(state, def) * def.visibility : sum;
  }, 0);
}

/** Whether there is a roof anywhere with the boss's own name on it. */
export function ownsHome(state: GameState): boolean {
  return heldPossessions(state).some((p) => possessionDef(p)?.kind === 'home');
}

export interface Refusal {
  ok: boolean;
  reason?: string;
}

/**
 * Whether it can be bought, refusing by naming both figures.
 *
 * The project rule, and round 14 paid for the version that did not follow it:
 * a refusal that says "you cannot afford this" tells the player nothing they
 * did not already suspect and nothing about how far off they are.
 */
/**
 * What the work brings back.
 *
 * The catalogue used to be a shop. Measured across 36 ordinary careers at day
 * 300 — the first time this project ever looked — **0 of 36 bought anything**,
 * and the only figure that existed beforehand came from a probe arm that had
 * been told to shop and duly ended $782,674 poorer for it.
 *
 * Nobody was making a mistake. Front income is paid into holdings and
 * compounds; a possession is money turned into a thing that sits there. A
 * dollar spent in the shop was a dollar not spent on premises that pay every
 * week for four years, so the catalogue was a strictly worse use of every
 * dollar in the game and ignoring it was correct play. A shop whose right
 * answer is "do not" is not a decision, and the repair is not a discount.
 *
 * So the shop is gone and the object stays. Everything possessions were ever
 * load-bearing for had nothing to do with buying them: they count toward the
 * estate, `seizeOnePossession` is the law taking one off you when a case
 * lands, the post-mortem lists what a career had, and owning a roof makes an
 * evening at home worth `POSSESSION.clearedByVisitAtHome` instead of
 * `HOME.clearedByVisit`. Five systems, none of them a catalogue.
 *
 * What arrives instead is what a score brought home. A thing you own is now a
 * record of something you did rather than something you went and bought, which
 * is also the only reading under which the post-mortem's list means anything.
 */
export function takeSomething(state: GameState, rng: Rng, take: number): Possession | null {
  /*
     The dearest thing the job could plausibly have come back with.

     A share of the take rather than the whole of it, because the crew did not
     spend the money on it — they came back with something, and the something
     is smaller than the haul. Read against the catalogue price so a thing that
     arrives is a thing the player would recognise the value of.
  */
  const ceiling = take * POSSESSION.fromTakeShare;
  const already = new Set(heldPossessions(state).map((p) => p.defId));

  const candidates = POSSESSIONS.filter(
    (def) => !already.has(def.id) && possessionValue(state, def) <= ceiling,
  ).sort((a, b) => possessionValue(state, b) - possessionValue(state, a));
  if (candidates.length === 0) return null;

  return grantPossession(state, rng, candidates[0].id);
}

/**
 * Somebody hands you a thing.
 *
 * Split out from `takeSomething` because choosing *which* thing and recording
 * that you now have it are two different jobs, and only the first one is a
 * policy. Nothing in the game calls this directly — a score is the one way a
 * possession arrives — but a test that needs a specific object in the room
 * should not have to reverse-engineer a take that produces it.
 */
export function grantPossession(state: GameState, rng: Rng, defId: string): Possession | null {
  const def = POSSESSION_BY_ID[defId];
  if (!def) return null;
  if (heldPossessions(state).some((p) => p.defId === defId)) return null;

  const possession: Possession = {
    id: `pos_${state.nextId++}`,
    defId: def.id,
    boughtDay: state.day,
    /*
       What it would have cost, kept for the estate and for selling.

       Nothing was paid, but the thing is still worth what the thing is worth,
       and `sellPossession` prices off this field. Recording zero here would
       make everything the family ever took unsellable and invisible to the
       estate, which is the opposite of the point.
    */
    paid: possessionValue(state, def),
    status: 'held',
  };
  possessions(state).push(possession);

  addLog(state, `${def.name} came back with them. Nobody asked whose it was.`, 'money');

  // And whatever the city makes of it, through `cover` like every other story.
  if (def.visibility > 0) {
    cover(state, rng, 'display', {
      named: true,
      scale: def.visibility * POSSESSION.coverageScale,
      territoryId: state.home?.districtId ?? null,
    });
  }

  return possession;
}

/**
 * Selling, at what somebody in a hurry will pay.
 *
 * Priced off what the player actually paid rather than off today's catalogue,
 * so a boss cannot sit on a car through an inflationary year and come out
 * ahead. The loss is the cost of having turned money into a thing.
 */
export function sellPossession(state: GameState, defId: string): Refusal {
  const owned = heldPossessions(state).find((p) => p.defId === defId);
  if (!owned) return { ok: false, reason: 'You do not own that.' };

  const def = possessionDef(owned);
  const back = Math.round(owned.paid * POSSESSION.sellBackShare);
  state.org.cash += back;
  owned.status = 'sold';
  owned.goneDay = state.day;

  addLog(
    state,
    `Sold ${def ? def.name.toLowerCase() : 'something of yours'} for ${formatMoney(back)}. ` +
      `You paid ${formatMoney(owned.paid)}.`,
    'money',
  );
  return { ok: true };
}

/**
 * What a warrant takes, beyond the money and the stock.
 *
 * The best single thing in the house, and nothing comes back. One per raid
 * rather than the lot: a raid that clears somebody out in one visit ends the
 * career rather than pressuring it, and the drama of this is the specific
 * item — the Lincoln, taken on day 212 — which a list of four does not have.
 *
 * Returns what went, so the caller can put it in its own record. Null when
 * there was nothing to take, which is most careers.
 */
export function seizeOnePossession(state: GameState, agency: string): Possession | null {
  const held = heldPossessions(state);
  if (held.length === 0) return null;

  let best = held[0];
  let bestValue = -1;
  for (const p of held) {
    const def = possessionDef(p);
    const value = def ? possessionValue(state, def) : 0;
    if (value > bestValue) {
      best = p;
      bestValue = value;
    }
  }

  best.status = 'seized';
  best.goneDay = state.day;
  const def = possessionDef(best);
  addLog(
    state,
    `${agency} took ${def ? def.name.toLowerCase() : 'something of yours'}. ` +
      `It was in your name, so there was nothing to argue about.`,
    'failure',
  );
  return best;
}

export interface PossessionRow {
  possession: Possession;
  def: PossessionDef;
  value: number;
  /** What selling it would put back in the clean pool. */
  back: number;
}

/** What the panel shows, already priced. */
export function possessionRows(state: GameState): PossessionRow[] {
  const rows: PossessionRow[] = [];
  for (const p of heldPossessions(state)) {
    const def = possessionDef(p);
    if (!def) continue;
    rows.push({
      possession: p,
      def,
      value: possessionValue(state, def),
      back: Math.round(p.paid * POSSESSION.sellBackShare),
    });
  }
  return rows.sort((a, b) => b.value - a.value);
}

/**
 * What a boss keeps, and what keeping it costs.
 *
 * Weekly. The nine original items are free to hold; the tier above them is not,
 * and that is the whole reason it exists. A one-off price absorbs a few months
 * of a surplus and then the pile resumes — measured, a family earns $1,128,015
 * of clean money across a career and spends $142,297 of it. A standing bill is
 * the only thing that makes an ornament a decision you keep making.
 *
 * ## Missing a week costs you the work, not the thing
 *
 * A yacht is not repossessed over one bad Friday, and a family that cannot find
 * the mooring fee has larger problems than the boat. So an unpayable bill is
 * skipped and everything stays owned.
 *
 * What it does lose is the week. An unfunded foundation moves no sentiment,
 * because a foundation nobody paid for is a name on a letterhead. That keeps
 * "what can I afford to keep running" a live question without building a
 * repossession system nobody asked for.
 *
 * ## Why the money comes out by hand
 *
 * Same reason `buyPossession` does it: `spend()` takes dirty first, and a
 * suitcase does not pay a country club subscription. This draws holdings then
 * clean, exactly as buying does, so the money that funds the thing is the money
 * that bought it.
 */
export function tickPossessions(state: GameState): void {
  if (state.day % PAYDAY_INTERVAL !== 0) return;

  const held = heldPossessions(state);
  if (held.length === 0) return;

  const kept = held
    .map((p) => possessionDef(p))
    .filter((d): d is PossessionDef => d !== undefined);

  const bill = kept.reduce((sum, d) => sum + (d.upkeep ? priced(state, d.upkeep) : 0), 0);
  const rounded = Math.round(bill);

  if (rounded > 0) {
    if (cleanPurse(state) < rounded) {
      addLog(
        state,
        `Nothing went out on the upkeep this week. ${formatMoney(rounded)} was owed on what you keep.`,
        'failure',
      );
      return;
    }
    const fromHoldings = Math.min(state.org.holdings ?? 0, rounded);
    state.org.holdings = (state.org.holdings ?? 0) - fromHoldings;
    state.org.cash -= rounded - fromHoldings;
    note(state, 'premises', -rounded);
  }

  /*
     And what the paid-for things do.

     Only where the family is actually standing. Charity in a neighbourhood you
     have never set foot in buys nothing, because nobody there was watching you
     to begin with — and `hasPresence` is the same ten-point line every other
     system uses to mean "they know who you are here".
  */
  const lift = kept.reduce((sum, d) => sum + (d.effect?.sentimentPerWeek ?? 0), 0);
  if (lift > 0) {
    for (const t of territoryList(state)) {
      if (hasPresence(t)) adjustSentiment(state, t.id, lift);
    }
  }
}
