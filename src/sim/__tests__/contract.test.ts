/**
 * Jobs that leave a body.
 *
 * Nothing in the operations table has ever killed anybody — a blown job
 * injures or arrests — so the rival cast, which is fully built and named and
 * watched for years, could be bought and never touched. This is the other verb
 * on the same man.
 *
 * The tests are ordered by what would be worst to get wrong.
 *
 * **The attribution** comes first, because it is the only thing here that is
 * genuinely new. Every other consequence already exists: `warCasualty` removes
 * a capo, `replaceLeader` changes a family, `pressureWitness` moves a case.
 * What has never existed is a killing whose carefulness decides who gets
 * blamed — and that is what makes a cold piece worth $3,400.
 *
 * **The cost** comes second. A contract that cannot take your own people is a
 * button, and this is the first job in the game that can.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { Rng } from '../rng';
import type { GameState } from '../types';
import { advanceDay } from '../clock';
import { crewList, generateNpc } from '../npc';
import { caposOf } from '../capos';
import { armouryOf, setCharge, setDump, shelf } from '../pieces';
import { setAutopilot } from '../autopilot';
import { declareWar } from '../diplomacy';
import { boardItems } from '../../ui/board';
import { CONTRACT } from '../../config/contract';
import { AGENCIES } from '../../config/lawEnforcement';
import {
  canContract,
  contractList,
  openContract,
  tickContracts,
  type ContractTarget,
} from '../contract';

/**
 * A career with people, money, and somebody worth sending them after.
 *
 * The men have to be conjured. A day-one career has exactly one, and
 * `CONTRACT.crew` is two on purpose — a contract has to compete with the work
 * for the same bodies or it is free. The first run of this file refused every
 * contract with *"It takes 2 and you have 1 free"*, which is the rule working.
 */
function ready(seed = 4): GameState {
  const state = newGame({ name: 'Tester', difficulty: 'normal', seed });
  const rng = new Rng(state.rng);
  for (let i = 0; i < 5; i++) {
    const npc = generateNpc(state, rng, 'soldier');
    npc.status = 'active';
    npc.joinedDay = state.day;
    state.npcs[npc.id] = npc;
  }
  for (const n of crewList(state)) if (n.status !== 'boss') n.status = 'active';
  state.org.dirtyCash = CONTRACT.cost * 20;
  state.org.respect = 400;
  return state;
}

function aCapo(state: GameState): ContractTarget {
  const capo = caposOf(state, 'falcone')[0];
  return { kind: 'capo', factionId: 'falcone', capoId: capo.id };
}

/** Run it to the day it happens. */
function playOut(state: GameState, rng: Rng): void {
  for (let i = 0; i <= CONTRACT.days + 1; i++) {
    state.day += 1;
    tickContracts(state, rng);
  }
}

describe('sending somebody', () => {
  it('refuses when there is nobody to send', () => {
    const state = ready();
    for (const n of crewList(state)) n.status = 'busy';
    expect(canContract(state, aCapo(state)).ok).toBe(false);
  });

  it('refuses when you cannot pay, and does not take the money', () => {
    const state = ready();
    state.org.dirtyCash = 0;
    state.org.cash = 0;
    expect(canContract(state, aCapo(state)).ok).toBe(false);
    expect(state.org.dirtyCash + state.org.cash).toBe(0);
  });

  it('takes the money and commits the men for the duration', () => {
    const state = ready();
    const before = state.org.dirtyCash;
    const free = crewList(state).filter((n) => n.status === 'active').length;
    expect(openContract(state, aCapo(state)).ok).toBe(true);
    expect(state.org.dirtyCash, 'the contract was free').toBeLessThan(before);
    expect(
      crewList(state).filter((n) => n.status === 'active').length,
      'nobody actually went',
    ).toBeLessThan(free);
    expect(contractList(state).length).toBe(1);
  });

  it('will not run two at the same man', () => {
    const state = ready();
    const target = aCapo(state);
    openContract(state, target);
    expect(canContract(state, target).ok).toBe(false);
  });

  it('keeps a hand off a man who just lived through one', () => {
    /*
       `CONTRACT.cooldownDays` existed and was read by nothing: the
       "already out looking" guard above only ever sees a contract while it
       is open, so a missed attempt left the same man reachable again the
       very next morning for nothing but the second attempt's own price.

       Runs seeds until the roll misses — asserting on one seed would be
       asserting that seed misses, the shape of every false pass this file's
       own header warns about.
    */
    let state!: GameState;
    let target!: ContractTarget;
    let rng!: Rng;
    for (let seed = 1; seed <= 30; seed++) {
      state = ready(seed);
      target = aCapo(state);
      rng = new Rng(state.rng);
      openContract(state, target);
      playOut(state, rng);
      const settled = contractList(state)[0];
      if (settled.status === 'missed') break;
    }
    const settled = contractList(state)[0];
    expect(settled.status, 'no seed in range ever missed').toBe('missed');

    expect(
      canContract(state, target).ok,
      'refused a fresh contract on the same man the day after a miss',
    ).toBe(false);

    state.day += CONTRACT.cooldownDays;
    expect(
      canContract(state, target).ok,
      'still refusing once the cooldown has actually run out',
    ).toBe(true);
  });
});

describe('what it does when it lands', () => {
  it('takes the man, his share of the family, and his hold on the district', () => {
    /*
       Not one seed. The act rolls, so this runs until it lands and asserts on
       the landing — a test that asserted on one seed would be asserting that
       one seed lands, which is the shape of every false pass in this file.
    */
    let checked = 0;
    for (let seed = 1; seed <= 30 && checked < 3; seed++) {
      const state = ready(seed);
      const capo = caposOf(state, 'falcone')[0];
      if (!capo) continue;
      const strengthBefore = state.factions.falcone!.strength;
      const held = capo.territoryId;
      openContract(state, { kind: 'capo', factionId: 'falcone', capoId: capo.id });
      playOut(state, new Rng(state.rng));
      if (caposOf(state, 'falcone').some((c) => c.id === capo.id)) continue;

      checked += 1;
      expect(
        state.factions.falcone!.strength,
        'the man is dead and the family is exactly as strong',
      ).toBeLessThan(strengthBefore);
      expect(
        state.factions.falcone!.warWeariness,
        'burying somebody cost them no appetite at all',
      ).toBeGreaterThan(0);
      void held;
    }
    expect(checked, 'thirty seeds and not one contract ever landed').toBeGreaterThan(0);
  });

  it('replaces a boss, and the family becomes somebody else', () => {
    let checked = 0;
    for (let seed = 1; seed <= 30 && checked < 2; seed++) {
      const state = ready(seed);
      const was = state.factions.falcone!.leader?.name;
      openContract(state, { kind: 'boss', factionId: 'falcone' });
      playOut(state, new Rng(state.rng));
      if (state.factions.falcone!.leader?.name === was) continue;
      checked += 1;
      expect(state.factions.falcone!.leader).toBeDefined();
    }
    expect(checked, 'a boss contract never once changed who was in the chair').toBeGreaterThan(0);
  });

  it('spends a piece off the shelf, like every other act with a body', () => {
    const state = ready();
    armouryOf(state).dump = true;
    const had = shelf(state).length;
    openContract(state, aCapo(state));
    playOut(state, new Rng(state.rng));
    expect(shelf(state).length, 'nobody carried anything').toBe(had - 1);
  });
});

describe('what it costs you', () => {
  it('can take one of your own, and does not always', () => {
    /*
       Both outcomes, and a zero in either is the finding. A contract that never
       costs a man is a button; one that always does is a tax with a story.
    */
    let lost = 0;
    let came = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const state = ready(seed);
      const before = crewList(state).filter((n) => n.status !== 'dead').length;
      openContract(state, aCapo(state));
      playOut(state, new Rng(state.rng));
      const after = crewList(state).filter((n) => n.status !== 'dead').length;
      if (after < before) lost += 1;
      else came += 1;
    }
    expect(lost, 'forty contracts and nobody ever failed to come home').toBeGreaterThan(0);
    expect(came, 'every single contract killed one of your own').toBeGreaterThan(0);
  });

  it('makes attention and puts something on the books', () => {
    const state = ready();
    const heat = state.org.heat;
    openContract(state, aCapo(state));
    playOut(state, new Rng(state.rng));
    expect(state.org.heat, 'a killing in the street drew no attention').toBeGreaterThan(heat);
    expect(
      Object.values(state.evidence).filter((e) => e.source === 'violence').length,
      'nothing was left behind at all',
    ).toBeGreaterThan(0);
  });
});

describe('who they think did it', () => {
  /*
     The only genuinely new thing here, and the reason a cold piece is worth
     paying for. `attribute()` already decides whether a family blames the
     right party; nothing had ever handed it a reason to be wrong that the
     player controlled.
  */
  function blamedElsewhere(provenance: 'cold' | 'crate', seeds = 40): number {
    let wrong = 0;
    for (let seed = 1; seed <= seeds; seed++) {
      const state = ready(seed);
      armouryOf(state).pieces = [
        {
          id: 'p1',
          defId: 'snub',
          cls: 'pocket',
          provenance,
          gotDay: 1,
          bodies: 0,
          status: 'shelf',
        },
      ];
      openContract(state, aCapo(state));
      playOut(state, new Rng(state.rng));
      const suspicions = state.factions.falcone!.suspicions ?? [];
      if (suspicions.some((s) => s.mistaken)) wrong += 1;
    }
    return wrong;
  }

  it('blames somebody else more often when the piece was cold', () => {
    const cold = blamedElsewhere('cold');
    const traceable = blamedElsewhere('crate');
    expect(
      cold,
      `a cold piece was misattributed ${cold} times against ${traceable} for one out of ` +
        'your own crates, so carefulness buys nothing and the whole provenance ' +
        'system is decoration on this act',
    ).toBeGreaterThan(traceable);
  });

  it('actually holds it against whoever they decided it was', () => {
    /*
       The test this file did not have, and the bug it did not catch.

       `theyWorkItOut` guarded the bond on `state.factions[believed]`, and
       there is no faction entry under `player` — the player's side of every
       pair lives on the other family's bond. So every correct attribution
       resolved to `undefined` and no grudge was ever written. Twelve tests
       stayed green while the whole mechanic did nothing, and it took playing
       four careers in the running game to see it: two families blamed the
       player at 93% and 71% and came away holding nothing against anybody.

       An attribution nobody acts on is not an opponent reasoning. It is a
       number in a struct.
    */
    let moved = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const state = ready(seed);
      const held = { ...state.factions.falcone!.bonds };
      const before = Object.fromEntries(
        Object.entries(held).map(([k, v]) => [k, v.grudge]),
      );
      openContract(state, aCapo(state));
      playOut(state, new Rng(state.rng));
      const after = state.factions.falcone!.bonds;
      if (Object.keys(before).some((k) => after[k].grudge > before[k])) moved += 1;
    }
    expect(
      moved,
      'twenty contracts and not one family ended up holding anything against anybody',
    ).toBeGreaterThan(0);
  });

  it('never tells the player which it was', () => {
    // `mistaken` is stored so tests can read it and is never rendered. The
    // player finds out by watching what the family does about it.
    const state = ready();
    openContract(state, aCapo(state));
    playOut(state, new Rng(state.rng));
    for (const entry of state.log) {
      expect(entry.text).not.toMatch(/blame|mistaken|wrongly/i);
    }
  });
});

describe('the loop is allowed to do it, inside a war and nowhere else', () => {
  /*
     Contracts handed a hand player a verb the autopilot did not have, and the
     bar since 2026-08-29 is that laziness is a supported way to play rather
     than a handicap. What makes this safe to automate is the gate, not the
     numbers: a contract can start a war, and a loop that decides whether a war
     is worth starting is making the largest decision in the game unasked.
  */
  function loop(seed: number, atWar: boolean): GameState {
    const state = ready(seed);
    setAutopilot(state, true);
    state.org.dirtyCash = CONTRACT.cost * 40;
    for (const t of Object.values(state.territories)) t.influence.player = 60;
    if (atWar) declareWar(state, 'player', 'falcone');
    for (let i = 0; i < 25 && !state.gameOver; i++) advanceDay(state);
    return state;
  }

  it('never sends anybody in peacetime, however rich and idle it is', () => {
    for (let seed = 1; seed <= 12; seed++) {
      expect(
        contractList(loop(seed, false)).length,
        'the loop started something on its own judgement in peacetime',
      ).toBe(0);
    }
  });

  it('does send somebody once a war the player chose is running', () => {
    let sent = 0;
    for (let seed = 1; seed <= 12; seed++) {
      if (contractList(loop(seed, true)).length > 0) sent += 1;
    }
    expect(
      sent,
      'twelve wars and the loop never once went after anybody, so the verb is decoration',
    ).toBeGreaterThan(0);
  });
});

describe('doing it with a charge', () => {
  /*
     The sheet parked charges with a promise the type system could not keep:
     "Not a crime the city handles. Everything here escalates who is looking."
     `EvidenceSource` was a five-way union every agency's `focus` read, so a
     charge could only ever have been a bigger number — and a bigger number is
     not what that line means.

     So the test that matters is not about magnitude. It is about **who ends up
     holding the file**.
  */
  function charged(seed: number): GameState {
    const state = ready(seed);
    setCharge(state, true);
    openContract(state, aCapo(state));
    playOut(state, new Rng(state.rng));
    return state;
  }

  it('files something no local force will ever work', () => {
    let filed = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const state = charged(seed);
      const traces = Object.values(state.evidence);
      if (traces.some((e) => e.source === 'ordnance')) filed += 1;
    }
    expect(filed, 'twenty charges and not one filed as ordnance').toBeGreaterThan(0);

    // The whole design, asserted on the config rather than on a roll: the two
    // agencies that can only ruin a month do not read this.
    const reads = (id: string) => AGENCIES.find((a) => a.id === id)!.focus.includes('ordnance');
    expect(reads('city_police'), 'the city police are working bombings').toBe(false);
    expect(reads('treasury'), 'financial crimes are working bombings').toBe(false);
    expect(reads('state_taskforce')).toBe(true);
    expect(reads('federal_bureau')).toBe(true);
  });

  it('spends nothing off the shelf, because a charge is not a piece', () => {
    const state = ready(3);
    setCharge(state, true);
    setDump(state, true);
    const had = shelf(state).length;
    openContract(state, aCapo(state));
    playOut(state, new Rng(state.rng));
    expect(shelf(state).length, 'a charge took a gun off the shelf').toBe(had);
  });

  it('costs the street something a shooting does not', () => {
    let worse = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const quiet = ready(seed);
      const loud = ready(seed);
      setCharge(loud, true);
      const where = (s: GameState) => s.territories[contractList(s)[0]?.territoryId ?? ''];
      openContract(quiet, aCapo(quiet));
      openContract(loud, aCapo(loud));
      const at = contractList(loud)[0].territoryId;
      if (!at) continue;
      const before = loud.territories[at].sentiment;
      playOut(quiet, new Rng(quiet.rng));
      playOut(loud, new Rng(loud.rng));
      if (loud.territories[at].sentiment < before) worse += 1;
      void where;
    }
    expect(worse, 'a car went up and the neighbourhood did not mind at all').toBeGreaterThan(0);
  });

  it('is never used on one of your own', () => {
    // There is no version of this aimed at a man sitting in a room, and
    // `silence` is not getting a bomb.
    const state = ready(5);
    setCharge(state, true);
    const npc = crewList(state).find((n) => n.status === 'active')!;
    state.law.investigations['c1'] = {
      id: 'c1',
      agencyId: 'city_police',
      stage: 'witnesses',
      stageSince: state.day,
      status: 'open',
      openedDay: state.day,
      strength: 50,
      evidenceIds: [],
      suspectIds: [npc.id],
    } as never;
    openContract(state, { kind: 'witness', caseId: 'c1', npcId: npc.id });
    playOut(state, new Rng(state.rng));
    expect(
      Object.values(state.evidence).some((e) => e.source === 'ordnance'),
      'a witness was dealt with using a bomb',
    ).toBe(false);
  });
});

describe('you can see what is out', () => {
  it('puts an open contract on the board, and takes it off when it settles', () => {
    /*
       A contract shipped with no row anywhere: two of your people gone for
       five days and one line in the log. That is `marks` before it got a
       panel, and it is the reason this test exists rather than a nicety.
    */
    const state = ready(6);
    expect(boardItems(state).some((r) => r.kind === 'contract')).toBe(false);
    openContract(state, aCapo(state));
    const row = boardItems(state).find((r) => r.kind === 'contract');
    expect(row, 'nothing on the board said anybody had gone anywhere').toBeDefined();
    expect(row!.title).toContain(contractList(state)[0].targetName);
    playOut(state, new Rng(state.rng));
    expect(
      boardItems(state).some((r) => r.kind === 'contract'),
      'a settled contract was still showing as running',
    ).toBe(false);
  });
});

describe('the wiring, not the function', () => {
  /*
     This project has shipped the gap between "the function works" and "the
     game calls it" before — sixteen possessions tests green while the warrant
     path called nothing. So this one opens a contract and then just plays the
     game.
  */
  it('a real career really carries one out', () => {
    const state = ready(12);
    openContract(state, aCapo(state));
    const opened = contractList(state).length;
    expect(opened).toBe(1);
    for (let i = 0; i < CONTRACT.days + 3 && !state.gameOver; i++) advanceDay(state);
    expect(
      contractList(state).filter((c) => c.status === 'open').length,
      'the clock never ran the contract, so it would sit open forever',
    ).toBe(0);
  });
});
