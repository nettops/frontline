/**
 * Legitimacy, and what a career turns out to have been.
 *
 * Both are readings rather than state, derived on demand in the same spirit as
 * `estate.ts`: they are opinions about the world, and a stored copy is a
 * second thing to keep true.
 *
 * A leaf module by necessity as well as taste. It reads the estate, the city
 * and the roster; nothing reads it back.
 */

import { clamp } from './rng';
import { estate } from './estate';
import { territoryList, playerInfluence, controlLevel } from './territory';
import { figure } from './civic';
import { possessions } from './possessions';
import { POSSESSION_BY_ID } from '../config/possessions';
import { CIVIC_FIGURES } from '../config/civic';
import {
  CAREER_SHAPES,
  LEGITIMACY,
  SHAPE_BARS,
  type CareerShapeDef,
} from '../config/legacy';
import type { GameState } from './types';

/**
 * How legitimate the family looks from outside, 0..100.
 *
 * Four terms, each a share rather than a raw number, so the reading does not
 * drift as the economy inflates. A boss with two restaurants and no heat reads
 * high; the same boss with the same restaurants and a task force reading their
 * mail does not, which is the point — legitimacy is other people's opinion and
 * it can be taken away by something you did not do.
 */
export function legitimacy(state: GameState): number {
  const worth = estate(state);
  const total = Math.max(1, worth.total);

  // What you visibly own, against what is in a drawer. `estate` works the
  // share out, because it is the module that knows what the family owns —
  // and because a possessions field added here and not there would have
  // grown the denominator without the numerator.
  const visible = clamp(worth.visible / total, 0, 1);
  const quiet = clamp(1 - state.org.heat / 100, 0, 1);
  const unnamed = clamp(1 - (state.city?.notoriety ?? 0) / 100, 0, 1);

  const onHand = state.org.cash + state.org.dirtyCash;
  const explainable = onHand <= 0 ? 1 : clamp(state.org.cash / onHand, 0, 1);

  return Math.round(
    (visible * LEGITIMACY.visibleHoldings +
      quiet * LEGITIMACY.quiet +
      unnamed * LEGITIMACY.unnamed +
      explainable * LEGITIMACY.explainable) *
      100,
  );
}

export interface CareerShape {
  id: string;
  name: string;
  verdict: string;
  /** The figure that earned the name, already worded. */
  because: string;
}

/**
 * What this career was, read off what it did.
 *
 * Every shape that matches is collected and the heaviest wins, so adding one
 * cannot silently outrank an existing one by being declared earlier in the
 * list. `unremarkable` sits at weight 0 and always matches, which is what
 * stops this being a horoscope — most careers are unremarkable and the game
 * should be willing to say so.
 */
export function careerShape(state: GameState): CareerShape {
  const worth = estate(state);
  /*
     Districts you dominate, not districts you have a foot in.

     This counted influence at 25 — a foothold — and a family with three
     districts under control has a toe in six or seven besides. Measured over
     36 careers at day 300, the histogram of what it was reading was
     `2:1 3:1 4:31 5:3`, and the Kingpin was the verdict on 35 of them: the
     horoscope this file's header forbids, arriving at the population level
     where no single-career test could see it. Control reads no better —
     `2:1 3:4 4:30 5:1` — because the highest district gate anywhere in
     `OPERATIONS` is three, so nothing asks for a fourth and a rational player
     stops there.

     Dominance is the only band that spreads: `1:4 2:6 3:15 4:11`. It is also
     the honest reading of "the city moved around you" — a foot in the door is
     not a map somebody else inherits.

     The same defect the union boss had in `config/civic.ts`, twice over: a bar
     re-placed against a quantity that had stopped varying, rather than the
     quantity being questioned.
  */
  const held = territoryList(state).filter((t) => controlLevel(t) === 'dominance').length;
  const owed = CIVIC_FIGURES.reduce((sum, def) => sum + figure(state, def.id).owed, 0);
  const peak = state.org.record?.estate ?? worth.total;
  const notoriety = state.city?.notoriety ?? 0;
  const legit = legitimacy(state);

  /*
     Claimed in a deliberately different order from their weights.

     The sort below is the thing that decides, and a first version called these
     in exactly descending weight order — so removing the sort changed nothing,
     every test still passed, and the guarantee it was there to provide was
     never being exercised. Declaration order now disagrees with weight order
     on purpose, which is the only way this stays honest when somebody adds a
     shape.
  */
  const matched: { def: CareerShapeDef; because: string }[] = [];
  const claim = (id: string, when: boolean, because: string) => {
    if (!when) return;
    const def = CAREER_SHAPES.find((s) => s.id === id);
    if (def) matched.push({ def, because });
  };

  claim(
    'street_king',
    state.org.fear >= SHAPE_BARS.streetKingFear,
    `Fear at ${Math.round(state.org.fear)}. Nobody needed telling twice.`,
  );
  claim(
    'ghost',
    notoriety <= SHAPE_BARS.ghostNotorietyUnder && worth.total >= SHAPE_BARS.ghostEstate,
    `Worth $${worth.total.toLocaleString('en-US')}, and notoriety ${Math.round(notoriety)}. Nobody wrote it down.`,
  );
  claim(
    'tragic',
    peak >= SHAPE_BARS.tragicPeakAbove &&
      worth.total <= peak * (1 - SHAPE_BARS.tragicLostShare),
    `Worth $${peak.toLocaleString('en-US')} at the best of it, and $${worth.total.toLocaleString('en-US')} at the end.`,
  );
  claim(
    'kingpin',
    held >= SHAPE_BARS.kingpinDistricts,
    `${held} districts answering, of ${territoryList(state).length} in the city.`,
  );
  claim(
    'legitimate',
    legit >= SHAPE_BARS.legitimateAbove && worth.fronts > 0,
    `Legitimacy ${legit}, with $${worth.fronts.toLocaleString('en-US')} of it in businesses somebody could walk into.`,
  );
  claim(
    'financier',
    worth.total >= SHAPE_BARS.financierEstate,
    `The family was worth $${worth.total.toLocaleString('en-US')}.`,
  );
  claim(
    'don',
    state.org.respect >= SHAPE_BARS.donRespect,
    `${Math.round(state.org.respect)} respect, which is not a thing anybody can be given.`,
  );
  claim(
    'diplomat',
    owed >= SHAPE_BARS.diplomatOwed &&
      state.player.attributes.influence >= SHAPE_BARS.diplomatInfluence,
    `${owed} favours outstanding with people who are not in the family, and the pull to have gone and got them.`,
  );
  claim('unremarkable', true, `Rank held, and not much else that anybody outside would notice.`);

  matched.sort((a, b) => b.def.weight - a.def.weight);
  const won = matched[0];
  return {
    id: won.def.id,
    name: won.def.name,
    verdict: won.def.verdict,
    because: won.because,
  };
}

export interface LegacyLine {
  label: string;
  value: string;
}

/**
 * The post-mortem, for the screen that currently has none.
 *
 * F11: "the death screen has no post-mortem. 495 bytes and one button. No
 * rank, no net worth, no roster, no week it turned. The moment the player most
 * needs to be shown what he missed shows him the least."
 *
 * Peaks rather than final values wherever the game keeps one, because the
 * interesting number at the end is what it was worth at its best — the final
 * balance of a family that just lost everything is a fact about the last week,
 * not about the career.
 */
export function postMortem(state: GameState): LegacyLine[] {
  const worth = estate(state);
  const record = state.org.record;
  const held = territoryList(state).filter((t) => playerInfluence(t) >= 25).length;
  const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
  // Everything ever owned, not only what survived — a career is partly a
  // record of what was taken off it.
  const everOwned = possessions(state);

  return [
    { label: 'Worth at the end', value: money(worth.total) },
    { label: 'Worth at its best', value: money(record?.estate ?? worth.total) },
    { label: 'Districts held', value: `${held} now, ${record?.districts ?? held} at the most` },
    {
      label: 'Respect',
      value: `${Math.round(state.org.respect)} now, ${Math.round(record?.respect ?? state.org.respect)} at the most`,
    },
    { label: 'Operations run', value: `${state.player.opsCompleted} done, ${state.player.opsFailed} not` },
    /*
       What was yours, and what happened to it.

       This row is the reason possessions exist. Round 15 was asked what would
       have gone if it had all gone and answered *"honestly: not much, and that
       is the damning part"* — $673 and a laundromat. A career that ends with a
       house on the hill and a Lincoln the Bureau took in a raid has an answer
       to that question, and this is where it gets given.

       Silent for a career that never bought anything, rather than a row
       reading "nothing" for the two thirds of players who never open the
       catalogue.
    */
    ...(everOwned.length
      ? [
          {
            label: 'Yours, not the family\'s',
            value: everOwned
              .map((p) => {
                const def = POSSESSION_BY_ID[p.defId];
                const name = def ? def.name.toLowerCase() : 'something';
                if (p.status === 'seized') return `${name} (taken on day ${p.goneDay})`;
                if (p.status === 'lost') return `${name} (lost at cards on day ${p.goneDay})`;
                if (p.status === 'sold') return `${name} (sold on day ${p.goneDay})`;
                return name;
              })
              .join('; '),
          },
        ]
      : []),
    { label: 'How legitimate it looked', value: `${legitimacy(state)} out of 100` },
    { label: 'Heat at the end', value: `${Math.round(state.org.heat)} out of 100` },
  ];
}
