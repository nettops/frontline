/**
 * A memo that quotes a price must not take a click it cannot honour.
 *
 * `payable` exists to keep the hint and the guard in one expression, and the
 * note above it records that eleven choices had already drifted apart once. It
 * happened again: two options on `arrest_pressure` quoted $20,000 and $6,000
 * with no guard, and round 10's tester clicked the $6,000 one holding $3,842.
 * The modal dismissed, no money moved, no line was written, and they had no way
 * to know whether the effect had applied.
 *
 * The drift is not carelessness, it is structural — three choices moved their
 * price out of the `hint` and into the `label`, where `payable` cannot reach.
 * So this checks the rendered text of both, which is what a player reads.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { Rng } from '../rng';
import { advanceDay } from '../clock';
import { resolveEvent } from '../events';
import { totalFunds } from '../economy';
import { canRecruit, recruit, recruitCost } from '../crew';
import { availableOperations, launchOperation } from '../operations';
import { operableTerritories, playerInfluence } from '../territory';
import { availableCrew } from '../npc';

/** Every dollar figure a player can read on this choice, label or hint. */
function pricesIn(text: string): number[] {
  return [...text.matchAll(/\$([\d,]+)/g)].map((m) => Number(m[1].replace(/,/g, '')));
}

describe('priced choices', () => {
  it('are never clickable at a price the player cannot cover', () => {
    const offenders: string[] = [];


    for (let seed = 1; seed <= 8; seed++) {
      const state = newGame({ name: 'Priced', difficulty: 'normal', seed });
      const rng = new Rng(state.rng);

      for (let day = 0; day < 900; day++) {
        /*
           It has to actually play, which the first version did not.

           That version advanced the clock and answered memos, so it never ran
           a job, never generated heat, never had a case opened and never had a
           man leaned on — and `arrest_pressure`, the one defect this file was
           written for, was unreachable. It passed with the bug present. Number
           twenty, and caught only by putting the bug back to watch it fail.

           It also hires to the cap and never holds a reserve, on purpose: the
           offence only exists when a priced choice meets an empty wallet, so a
           comfortable bot would never see one either.
        */
        if (totalFunds(state) > recruitCost(state)) {
          for (const id of Object.keys(state.recruits)) {
            if (canRecruit(state, id).ok) {
              recruit(state, id);
              break;
            }
          }
        }
        const where = [...operableTerritories(state)].sort(
          (a, b) => playerInfluence(b.territory) - playerInfluence(a.territory),
        )[0]?.territory.id;
        if (where) {
          for (const def of availableOperations(state)) {
            if (availableCrew(state).length < def.crewRequired) continue;
            launchOperation(
              state,
              def.id,
              availableCrew(state).slice(0, def.crewRequired).map((n) => n.id),
              where,
            );
          }
        }
        let guard = 0;
        while (state.pendingEvents.length > 0 && guard++ < 20) {
          const event = state.pendingEvents[0];
          const funds = totalFunds(state);

          for (const choice of event.choices) {
            /*
               The guard as the screen applies it, which is not the one stored.

               `disabledReason` is fixed when the memo is built and memos queue,
               so a week's payroll can run underneath one. MemoModal re-checks
               `choice.cost` against the balance at the moment of rendering; this
               has to use the same rule or it tests a button nobody sees.
            */
            if (choice.disabledReason) continue;
            if (choice.cost !== undefined && funds < choice.cost) continue;
            /*
               The largest figure quoted, not every figure. Several choices
               name a cost and a return in the same breath — "$3,000 up front,
               $9,000 if it works" — and only one of them is being asked for.
               Taking the maximum is the conservative reading and would catch a
               real offender; taking the minimum would miss one.

               Choices that *pay* the player are the reason this is a warning
               list rather than a bare assertion on every match: a loan offer
               quotes a figure it is handing over. Those are excluded by name
               below, and the exclusion is deliberately short so a new one has
               to be looked at rather than absorbed.
            */
            const receiving = /take the \$|they paid|comes back as/i.test(
              `${choice.label} ${choice.hint}`,
            );
            if (receiving) continue;

            const quoted = pricesIn(`${choice.label} ${choice.hint}`);
            const worst = quoted.length ? Math.max(...quoted) : 0;
            if (worst > funds) {
              offenders.push(
                `${event.defId}/${choice.id}: quotes $${worst.toLocaleString('en-US')} ` +
                  `with $${Math.round(funds).toLocaleString('en-US')} held, and is enabled`,
              );
            }
          }

          const pick = event.choices.find((c) => !c.disabledReason) ?? event.choices[0];
          resolveEvent(state, rng, event.id, pick.id);
        }
        advanceDay(state);
        if (state.gameOver) break;
      }
    }

    expect([...new Set(offenders)]).toEqual([]);
  });
});
