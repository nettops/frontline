/**
 * The memos the simulation writes for itself.
 *
 * The design note is in `config/eventgen.ts`. The mechanics that matter:
 *
 * **Every shape is instantiated against a real subject.** `applies` goes and
 * finds a man who is actually aggrieved, a front that is actually failing, a
 * street that has actually turned. There is no shape that can fire against
 * nothing, which is the same rule the authored events follow and the reason
 * they feel caused rather than sprinkled.
 *
 * **Nothing here is a new mechanic.** Every outcome moves a number an existing
 * system already owns and reads back through that system's own machinery —
 * `remember`, `recordTie`, `adjustSentiment`, `startLayLow`, the civic roster.
 * A generated memo is the existing simulation given a mouth, not a second
 * simulation running beside it.
 *
 * **They are ordinary on purpose.** A memo the player has never seen before is
 * worth more than a memo that is cleverer, and the way to keep producing the
 * first kind is to write six situations that recur in a family's life and let
 * twenty men, eight districts and however many fronts supply the particulars.
 */

import { Rng, clamp } from './rng';
import type { EventDef } from './events';
import type { GameState, Npc, PendingEvent } from './types';
import { money, oneOf, payable } from './memo';
import { addLog } from './util';
import { addNote, crewList } from './npc';
import { remember } from './memory';
import { recordTie } from './ties';
import { spend, totalFunds } from './economy';
import { addHeat } from './heat';
import { gainFear, gainRespect, trainAttribute } from './player';
import { ownedBusinesses, weeklyRevenue } from './business';
import { adjustSentiment, playerInfluence, territoryDef, territoryList } from './territory';
import { activeCases, agencyOf, legalCostAt, retainLawyer } from './investigation';
import { figure } from './civic';
import { readWhispers } from './whispers';
import { goHome, home } from './personal';
import { RELATIONS } from '../config/personal';
import { CIVIC_FIGURES } from '../config/civic';
import { GEN_EFFECT, GEN_SHAPES, GEN_WHEN } from '../config/eventgen';
import { ROLE_LABEL } from '../config/economy';
import { MEMORIES } from '../config/memories';

/** Whether a memo came out of here rather than out of the authored table. */
export function isGenerated(defId: string): boolean {
  return defId.startsWith('gen_');
}

function active(state: GameState): Npc[] {
  return crewList(state).filter((n) => n.status === 'active' || n.status === 'busy');
}

/**
 * The most recent thing that happened to somebody, in their own record.
 *
 * A generated memo that says "they are unhappy" is a stat readout with a
 * button under it. One that says what they are unhappy *about* is a scene, and
 * `memories` already holds exactly that: one event, on a date, sometimes about
 * somebody in particular. This is the whole difference between the two.
 */
function grievanceOf(npc: Npc, day: number): string | null {
  /*
     Memories are newest-first, and their text is a verb phrase with an implied
     subject — "were not paid, and remember the week" — so it reads straight
     into a sentence about them.

     Only recent ones. Round 15 watched a man raise the same injury from day 9
     on days 45, 101, 174 and 226. The memory is real and `memory.ts` keeps it
     on purpose, but a man walking in to raise a two-hundred-day-old grievance
     for the fourth time reads as a bug because it is one.
  */
  const bad = npc.memories.find(
    (m) => MEMORIES[m.kind]?.tone === 'bad' && day - m.day <= GEN_WHEN.grievanceStaleAfterDays,
  );
  if (bad) return MEMORIES[bad.kind].text;
  const note = npc.notes.find((n) => n.kind === 'bad' && day - n.day <= GEN_WHEN.grievanceStaleAfterDays);
  return note ? note.text : null;
}

// ------------------------------------------------------------- the shapes ---

function shape(id: string): { weight: number; cooldownDays: number } {
  const def = GEN_SHAPES.find((s) => s.id === id);
  // Every id below is declared in the catalogue; the fallback exists so a
  // shape removed from config fails quietly rather than crashing a save.
  return def ?? { weight: 0, cooldownDays: 30 };
}

const wantsAWord: EventDef = {
  id: 'gen_wants_a_word',
  ...shape('gen_wants_a_word'),
  applies(state, rng) {
    const sore = active(state).filter(
      (n) =>
        (n.stats.grievance >= GEN_WHEN.grievance || n.stats.loyalty <= GEN_WHEN.loyaltyUnder) &&
        // Dealt with recently, whatever the answer was. See
        // `GEN_WHEN.askedAgainAfterDays` for what this cost round 15.
        state.day - (state.flags[`asked_${n.id}`] ?? -9999) >= GEN_WHEN.askedAgainAfterDays,
    );
    return sore.length ? { npc: rng.pick(sore) } : null;
  },
  build(state, rng, ctx) {
    const npc = ctx.npc!;
    const about = grievanceOf(npc, state.day);
    const ask = Math.max(500, Math.round(npc.wage * GEN_EFFECT.payWages));
    const carrying = about
      ? `They have not forgotten it: they ${about}.`
      : `They will not say what it is about, which is its own answer.`;
    const who = `${ROLE_LABEL[npc.role]}, ${npc.daysInCrew} days with you.`;
    return {
      defId: 'gen_wants_a_word',
      title: `${npc.name} wants a word`,
      body: oneOf(rng, [
        `${npc.name} has been waiting outside since this morning. ${carrying} ${who}`,
        `${npc.name} asked whether you had five minutes, then asked again. ${carrying} ${who}`,
        `Somebody put it to you that ${npc.name} would like to be heard. ${carrying} ${who}`,
      ]),
      severity: 'warning',
      npcId: npc.id,
      data: {},
      choices: [
        {
          id: 'hear',
          label: 'Hear them out',
          hint: 'Costs nothing but the time. It is not nothing.',
        },
        {
          id: 'pay',
          label: 'Put something in their hand',
          ...payable(state, ask, 'and it is settled'),
        },
        {
          id: 'refuse',
          label: 'Tell them it is not the time',
          hint: 'They will remember being told.',
        },
      ],
    };
  },
};

const badBlood: EventDef = {
  id: 'gen_bad_blood',
  ...shape('gen_bad_blood'),
  applies(state, rng) {
    const crew = active(state);
    const pairs: { npc: Npc; other: Npc }[] = [];
    for (const n of crew) {
      for (const tie of n.ties) {
        if (tie.resentment < GEN_WHEN.resentment) continue;
        const other = state.npcs[tie.id];
        if (!other || other.status === 'dead' || other.status === 'defected') continue;
        pairs.push({ npc: n, other });
      }
    }
    return pairs.length ? rng.pick(pairs) : null;
  },
  build(_state, rng, ctx) {
    const a = ctx.npc!;
    const b = ctx.other!;
    const tie = a.ties.find((t) => t.id === b.id);
    const because = tie ? ` — ${tieCause(tie.cause)}` : '';
    const end = `Somebody is going to have to be told they are wrong.`;
    return {
      defId: 'gen_bad_blood',
      title: `${a.name} and ${b.name}`,
      body: oneOf(rng, [
        `They will not work the same night. ${a.name} has not let it go${because}, ` +
          `and it is starting to cost you people who could be earning. ${end}`,
        `It came to shouting in front of people who are not family. ` +
          `${a.name} started it${because}, and it is costing you two earners ` +
          `instead of one. ${end}`,
        `Two of yours have stopped being in rooms together. ${a.name} is the one ` +
          `carrying it${because}, and the work is going round them both. ${end}`,
      ]),
      severity: 'warning',
      npcId: a.id,
      data: { otherId: b.id },
      /*
         The answer that does the least damage is listed first, and that is a
         decision about the reader rather than about the bots.

         Taking a side writes a memory into the man you did not back. Listed
         first, it became the default for every instrument in the project — all
         of them answer with the cheapest open choice, and every one of these
         is free — and `ladder.probe` watched careers reaching Capo fall from
         fourteen in thirty-six to seven. A memo whose harmless answer is
         buried under two harmful ones is a trap for anybody clicking quickly,
         which on a bad night is the player too.
      */
      choices: [
        {
          id: 'leave',
          label: 'Let them sort it out',
          hint: 'They will not sort it out.',
        },
        { id: 'back_a', label: `Side with ${a.name}`, hint: `${b.name} will hear about it.` },
        { id: 'back_b', label: `Side with ${b.name}`, hint: `${a.name} will hear about it.` },
      ],
    };
  },
};

/** The tie's cause, said the way a person would say it. */
function tieCause(cause: string): string {
  switch (cause) {
    case 'took_the_blame':
      return 'somebody took a charge that was not theirs';
    case 'passed_over':
      return 'one of them got the job the other wanted';
    case 'worked_together':
      return 'they have worked too many nights together';
    default:
      return 'nobody will say what started it';
  }
}

const frontTrouble: EventDef = {
  id: 'gen_front_trouble',
  ...shape('gen_front_trouble'),
  applies(state, rng) {
    const bad = ownedBusinesses(state).filter(
      (b) =>
        b.health <= GEN_WHEN.frontHealthUnder || b.exposure >= GEN_WHEN.frontExposureOver,
    );
    return bad.length ? { business: rng.pick(bad) } : null;
  },
  build(state, rng, ctx) {
    const b = ctx.business!;
    const where = territoryDef(b.territoryId).name;
    const cost = Math.max(2_000, Math.round(weeklyRevenue(state, b) * GEN_EFFECT.frontRepairWeeks));
    const failing = b.health <= GEN_WHEN.frontHealthUnder;
    return {
      defId: 'gen_front_trouble',
      title: `The place in ${where}`,
      body: failing
        ? oneOf(rng, [
            `The manager has stopped pretending. Takings are down, two of the staff ` +
              `have left, and the place is running at ${Math.round(b.health)} out of a ` +
              `hundred. Another season of this and it closes on its own.`,
            `Nobody has been through the door since Tuesday. The place is at ` +
              `${Math.round(b.health)} out of a hundred and the man running it has ` +
              `started talking about getting out. It closes on its own if you let it.`,
          ])
        : oneOf(rng, [
            `Somebody has been sitting across the street from it. Exposure is ` +
              `${Math.round(b.exposure)} out of a hundred, which is the number that ` +
              `decides whether a file gets opened with this address on it.`,
            `A car has been parked opposite three mornings running. Exposure is ` +
              `${Math.round(b.exposure)} out of a hundred, and that is the number a ` +
              `warrant gets written against.`,
          ]),
      severity: failing ? 'warning' : 'danger',
      npcId: null,
      data: { businessId: b.id },
      choices: [
        {
          id: 'spend',
          label: 'Put money into it',
          ...payable(state, cost, 'and it is a going concern again'),
        },
        {
          id: 'quiet',
          label: 'Run it clean for a while',
          hint: 'Less through the till, and less to look at.',
        },
        {
          id: 'ride',
          label: 'Leave it alone',
          hint: 'It is not the only thing you own.',
        },
      ],
    };
  },
};

const streetTurning: EventDef = {
  id: 'gen_street_turning',
  ...shape('gen_street_turning'),
  applies(state, rng) {
    const turned = territoryList(state).filter(
      (t) =>
        playerInfluence(t) >= GEN_WHEN.districtInfluence && t.sentiment <= GEN_WHEN.sentimentUnder,
    );
    return turned.length ? { territory: rng.pick(turned) } : null;
  },
  build(state, rng, ctx) {
    const t = ctx.territory!;
    const consequence =
      `at that number the shopkeepers stop selling, the jobs get harder, and ` +
      `somebody eventually talks to a detective because they have no reason not to.`;
    return {
      defId: 'gen_street_turning',
      title: `${territoryDef(t.id).name} has gone quiet on you`,
      body: oneOf(rng, [
        `Nobody says anything to your people any more. Public feeling there is ` +
          `${Math.round(t.sentiment)} out of a hundred, and ${consequence}`,
        `Two of your men were served last and charged first. Public feeling in the ` +
          `district is ${Math.round(t.sentiment)} out of a hundred, and ${consequence}`,
        `There was a meeting about you above the hardware shop. Public feeling is ` +
          `${Math.round(t.sentiment)} out of a hundred, and ${consequence}`,
      ]),
      severity: 'warning',
      npcId: null,
      data: { territoryId: t.id },
      // Same ordering rule as `gen_bad_blood`: leaning on a street costs
      // feeling and adds heat, and it should not be what a fast click does.
      choices: [
        { id: 'ride', label: 'Let it pass', hint: 'It may pass.' },
        {
          id: 'spend',
          label: 'Put money back into the street',
          ...payable(state, GEN_EFFECT.streetSpend, 'and they remember who pays for things'),
        },
        {
          id: 'lean',
          label: 'Remind them whose street it is',
          hint: 'It works. It works the way that costs you later.',
        },
      ],
    };
  },
};

const someoneOutside: EventDef = {
  id: 'gen_someone_outside',
  ...shape('gen_someone_outside'),
  applies(state, rng) {
    // Somebody who knows you and does not owe you anything yet. A figure
    // already holding favours has no reason to call.
    const known = CIVIC_FIGURES.filter((def) => {
      const held = figure(state, def.id);
      return held.standing >= 20 && held.owed === 0;
    });
    return known.length ? { civicId: rng.pick(known).id } : null;
  },
  build(state, rng, ctx) {
    const id = ctx.civicId!;
    const def = CIVIC_FIGURES.find((f) => f.id === id)!;
    const held = figure(state, id);
    const bar =
      `Standing with them is ${Math.round(held.standing)}; they start owing you above ` +
      `${def.owesAbove}. Nobody involved will ever use the word favour.`;
    return {
      defId: 'gen_someone_outside',
      title: `${def.title} has a problem`,
      body: oneOf(rng, [
        `It is not your problem and they have not asked directly, which is how these ` +
          `conversations go. ${bar}`,
        `It came up at the end of a conversation about something else, the way these ` +
          `things are raised. ${bar}`,
        `A third party mentioned it to you, which means it was meant to be ` +
          `mentioned. ${bar}`,
      ]),
      severity: 'opportunity',
      npcId: null,
      data: { civicId: id },
      choices: [
        {
          id: 'help',
          label: 'Make it go away',
          ...payable(state, GEN_EFFECT.outsideSpend, 'and they know who did it'),
        },
        {
          id: 'decline',
          label: 'Stay out of it',
          hint: 'They will understand. They will also remember.',
        },
      ],
    };
  },
};

const paperMoving: EventDef = {
  id: 'gen_paper_moving',
  ...shape('gen_paper_moving'),
  applies(state, rng) {
    /*
       Only for a boss with nobody acting for them.

       The answer this memo offers is a retainer, and a retainer is a weekly
       cost for the rest of the career. Offered to everybody it became a
       standing drain that the scorecard bot — which takes the first enabled
       answer — paid over and over, and Pacing fell with it. Offered to a boss
       with no representation at all it is a one-time transition, and it is the
       moment the warning is actually worth something.
    */
    if (state.law.lawyer !== 'none') return null;
    const live = activeCases(state).filter((c) => c.strength >= GEN_WHEN.caseStrength);
    return live.length ? { investigation: rng.pick(live) } : null;
  },
  build(state, rng, ctx) {
    const c = ctx.investigation!;
    const agency = agencyOf(c);
    return {
      defId: 'gen_paper_moving',
      title: `The file is moving`,
      body: oneOf(rng, [
        `${agency.name} have been at it long enough to have something. The case is at ` +
          `${Math.round(c.strength)} out of a hundred and it is not cooling on its own. ` +
          `You are not supposed to know this, which is the only advantage you have.`,
        `Somebody who owes somebody told somebody. ${agency.name} are further along ` +
          `than they were: the case is at ${Math.round(c.strength)} out of a hundred ` +
          `and nothing about it is going quiet. You are not supposed to know, which ` +
          `is the only advantage you have.`,
      ]),
      severity: 'danger',
      npcId: null,
      data: { caseId: c.id },
      choices: [
        {
          id: 'counsel',
          label: 'Put a proper firm on it',
          ...payable(state, legalCostAt(state, 'firm'), 'a week, from now on'),
        },
        {
          id: 'ride',
          label: 'Carry on as normal',
          hint: 'The men see you unbothered. So does everybody else.',
        },
      ],
    };
  },
};

/**
 * Somebody at home has asked where you are.
 *
 * Fires only once the house has actually noticed, so it is an answer to
 * something rather than an interruption — and the cost of going is the week
 * itself, which is charged by the memo turning up on a week that had other
 * plans. There is nothing to pay and nothing to buy back.
 */
const askedForYou: EventDef = {
  id: 'gen_asked_for_you',
  ...shape('gen_asked_for_you'),
  applies(state) {
    const house = home(state);
    return house.neglect >= GEN_WHEN.neglect && house.people.length > 0 ? { atHome: true } : null;
  },
  build(state, rng) {
    const house = home(state);
    const who = house.people[Math.min(house.people.length - 1, Math.floor(rng.next() * house.people.length))];
    const def = RELATIONS.find((r) => r.id === who.relationId);
    const relation = def ? def.label : 'somebody at home';
    const asks = def ? def.asks : 'has asked after you';
    const days = state.day - house.lastVisitDay;
    return {
      defId: 'gen_asked_for_you',
      title: `${who.name} asked where you were`,
      body: oneOf(rng, [
        `${who.name}, ${relation}, ${asks}. It has been ${days} days. ` +
          `Nobody in the house is going to say it twice.`,
        `Word came through somebody else, which is how you know it matters. ` +
          `${who.name}, ${relation}, ${asks}. It has been ${days} days.`,
        `It was mentioned in the way that means it has been discussed. ` +
          `${who.name}, ${relation}, ${asks}, and it has been ${days} days.`,
      ]),
      severity: 'info',
      npcId: null,
      data: {},
      choices: [
        {
          id: 'go',
          label: 'Go home for the evening',
          hint: 'The work is still there tomorrow. It is always still there tomorrow.',
        },
        {
          id: 'later',
          label: 'Not this week',
          hint: 'It has been said before.',
        },
      ],
    };
  },
};

/**
 * One of yours is in a cell.
 *
 * The state comes and goes, which is what makes it a memo rather than a
 * subscription — and it is the moment `memory` was built for: a man you left
 * inside carries it for years, and an investigator sitting across from him
 * later is having a very different conversation because of it.
 */
const somebodyInside: EventDef = {
  id: 'gen_somebody_inside',
  ...shape('gen_somebody_inside'),
  applies(state, rng) {
    const inside = crewList(state).filter((n) => n.status === 'arrested');
    return inside.length ? { npc: rng.pick(inside) } : null;
  },
  build(state, rng, ctx) {
    const npc = ctx.npc!;
    const bail = Math.max(1_500, Math.round(npc.wage * GEN_EFFECT.insideBailWeeks));
    return {
      defId: 'gen_somebody_inside',
      title: `${npc.name} is inside`,
      body: oneOf(rng, [
        `They took ${npc.name} on Tuesday and nobody has been told what for. ` +
          `${ROLE_LABEL[npc.role]}, ${npc.daysInCrew} days with you, and whatever they are ` +
          `asking them, they have not answered it yet.`,
        `${npc.name} has been in a room since Tuesday with people who do this for a living. ` +
          `${ROLE_LABEL[npc.role]}, ${npc.daysInCrew} days with you. Nobody has said what they have.`,
      ]),
      severity: 'danger',
      npcId: npc.id,
      data: {},
      choices: [
        {
          id: 'bail',
          label: 'Get somebody down there',
          ...payable(state, bail, 'and they know who sent them'),
        },
        {
          id: 'wait',
          label: 'Let it run',
          hint: 'They know the arrangement. They will also remember it.',
        },
      ],
    };
  },
};

/**
 * The district is earning and you are not seeing it.
 *
 * Reads `isSkimming` and `skimTotal`, which the delegation system has been
 * writing since it existed and which nothing has ever walked into the room
 * about. The player could always have found it on the crew sheet; almost
 * nobody does.
 */
const takeIsShort: EventDef = {
  id: 'gen_the_take_is_short',
  ...shape('gen_the_take_is_short'),
  applies(state, rng) {
    const bent = territoryList(state)
      .map((t) => ({ t, npc: t.stewardId ? state.npcs[t.stewardId] : null }))
      .filter(
        (pair): pair is { t: (typeof pair)['t']; npc: Npc } =>
          !!pair.npc && pair.npc.isSkimming && pair.npc.skimTotal >= GEN_WHEN.skimmed,
      );
    if (!bent.length) return null;
    const picked = rng.pick(bent);
    return { npc: picked.npc, territory: picked.t };
  },
  build(_state, rng, ctx) {
    const npc = ctx.npc!;
    const t = ctx.territory!;
    const where = territoryDef(t.id).name;
    return {
      defId: 'gen_the_take_is_short',
      title: `The take out of ${where}`,
      body: oneOf(rng, [
        `It does not match what the street says that district does. ${npc.name} has been ` +
          `running it for you and the difference has been going somewhere. ` +
          `Nobody has said the word out loud.`,
        `Somebody who counts for a living had a look at ${where} and came back quiet. ` +
          `${npc.name} runs it. The number that arrives is not the number that leaves.`,
      ]),
      severity: 'warning',
      npcId: npc.id,
      data: { territoryId: t.id },
      choices: [
        {
          id: 'let_it_go',
          label: 'Say nothing this time',
          hint: 'They will know you know. That is sometimes enough.',
        },
        {
          id: 'call_it_in',
          label: 'Have it said to them',
          hint: 'It stops. Nobody forgets being accused, and they were guilty.',
        },
      ],
    };
  },
};

/**
 * A name has come round twice.
 *
 * The only shape that reads the whisper feed, and the point of it: a
 * corroborated claim is the one piece of intelligence in this game that is
 * worth acting on, and until now nothing ever asked the player to. It names
 * the subject and still does not say whether it is true — `Whisper.truth` is
 * never read here, and must not be.
 */
const nameCameUp: EventDef = {
  id: 'gen_a_name_came_up',
  ...shape('gen_a_name_came_up'),
  applies(state, rng) {
    const hard = readWhispers(state).filter(
      (w) => w.corroborated && w.confidence >= GEN_WHEN.corroboratedConfidence,
    );
    if (!hard.length) return null;
    const about = rng.pick(hard);
    // Whisper subjects are ids where the claim is about a person.
    const npc = state.npcs[about.subject];
    if (!npc || npc.status === 'dead' || npc.status === 'defected') return null;
    return { npc };
  },
  build(_state, rng, ctx) {
    const npc = ctx.npc!;
    return {
      defId: 'gen_a_name_came_up',
      title: `${npc.name}, again`,
      body: oneOf(rng, [
        `It is the second time somebody has brought you the same name without being asked. ` +
          `That is not proof of anything and it is not nothing either. ` +
          `${ROLE_LABEL[npc.role]}, ${npc.daysInCrew} days with you.`,
        `Two people, separately, and neither of them knew the other had said it. ` +
          `${npc.name} — ${ROLE_LABEL[npc.role]}, ${npc.daysInCrew} days with you. ` +
          `Nobody has anything you could call evidence.`,
      ]),
      severity: 'warning',
      npcId: npc.id,
      data: {},
      choices: [
        {
          id: 'leave_it',
          label: 'Leave it alone',
          hint: 'Half of what reaches you is wrong. This might be the half.',
        },
        {
          id: 'ask',
          label: 'Have somebody ask them',
          hint: 'They will know they were talked about. So will everybody else.',
        },
      ],
    };
  },
};

export const GEN_DEFS: EventDef[] = [
  wantsAWord,
  badBlood,
  frontTrouble,
  streetTurning,
  someoneOutside,
  paperMoving,
  somebodyInside,
  takeIsShort,
  nameCameUp,
  askedForYou,
];

// ------------------------------------------------------------- resolution ---

/**
 * What the answer did.
 *
 * One function rather than six cases bolted onto the table in `events.ts`,
 * because everything in here reaches for a system that already exists and none
 * of it belongs in that file.
 */
export function resolveGenerated(
  state: GameState,
  _rng: Rng,
  event: PendingEvent,
  choiceId: string,
): void {
  const npc = event.npcId ? state.npcs[event.npcId] : null;

  switch (event.defId) {
    case 'gen_wants_a_word': {
      if (!npc) return;
      /*
         Whatever you decide, this person has been dealt with for a while.

         Set before the branches rather than inside each of them, so a branch
         added later cannot forget it — which is exactly how this became a
         subscription in the first place.
      */
      state.flags[`asked_${npc.id}`] = state.day;
      if (choiceId === 'pay') {
        const ask = Math.max(500, Math.round(npc.wage * GEN_EFFECT.payWages));
        if (!spend(state, ask)) {
          addLog(state, `You had nothing to give ${npc.name}. They noticed that too.`, 'failure');
          return;
        }
        move(npc, GEN_EFFECT.paidLoyalty, GEN_EFFECT.paidGrievance);
        remember(npc, state.day, 'looked_after');
        addLog(state, `${money(ask)} to ${npc.name}. Whatever it was, it is closed.`, 'money');
        return;
      }
      if (choiceId === 'refuse') {
        move(npc, GEN_EFFECT.refusedLoyalty, GEN_EFFECT.refusedGrievance);
        gainFear(state, GEN_EFFECT.refusedFear);
        addNote(npc, state.day, 'Asked for a word and did not get one.', 'bad');
        remember(npc, state.day, 'passed_over');
        return;
      }
      move(npc, GEN_EFFECT.heardLoyalty, GEN_EFFECT.heardGrievance);
      npc.stats.respectForBoss = clamp(npc.stats.respectForBoss + 5, 0, 100);
      addNote(npc, state.day, 'You heard them out.', 'good');
      trainAttribute(state, 'leadership', 1);
      return;
    }

    case 'gen_bad_blood': {
      const other = state.npcs[String(event.data.otherId ?? '')];
      if (!npc || !other) return;
      if (choiceId === 'leave') {
        /*
           One side, not both, and lightly.

           This used to add resentment to each of them every time the memo came
           round, which double-counted a thing `ties.ts` already does on its own
           weekly drift. Ten firings across a career was enough crew damage to
           cost six careers in thirty-six their Capo rung — measured, not
           guessed. Declining to spend your authority is a real answer with a
           real cost; it is not supposed to be the most expensive one on the
           memo.
        */
        bump(npc, other.id, GEN_EFFECT.ignoredResentment);
        addLog(state, `${npc.name} and ${other.name} were left to it. They were not sorting it out.`, 'crew');
        return;
      }
      const backed = choiceId === 'back_a' ? npc : other;
      const passed = choiceId === 'back_a' ? other : npc;
      backed.stats.respectForBoss = clamp(backed.stats.respectForBoss + GEN_EFFECT.backedTrust, 0, 100);
      bump(backed, passed.id, GEN_EFFECT.backedResentment);
      passed.stats.grievance = clamp(passed.stats.grievance + GEN_EFFECT.passedOverResentment, 0, 100);
      recordTie(state.day, passed, backed, 'passed_over');
      remember(passed, state.day, 'passed_over');
      addLog(state, `You told ${passed.name} they were wrong. ${backed.name} heard about it within the hour.`, 'crew');
      return;
    }

    case 'gen_front_trouble': {
      const b = state.businesses[String(event.data.businessId ?? '')];
      if (!b) return;
      if (choiceId === 'spend') {
        const cost = Math.max(2_000, Math.round(weeklyRevenue(state, b) * GEN_EFFECT.frontRepairWeeks));
        if (!spend(state, cost)) {
          addLog(state, 'There was nothing to put into it.', 'failure');
          return;
        }
        b.health = clamp(b.health + GEN_EFFECT.frontRepairHealth, 0, 100);
        addLog(state, `${money(cost)} into the place in ${territoryDef(b.territoryId).name}. It opens tomorrow.`, 'money');
        return;
      }
      if (choiceId === 'quiet') {
        /*
           A one-off scrub, and deliberately not a write to `b.pressure`.

           The first version set the dial to `clean` and left it there. Two
           things were wrong with that and only the second was visible. The dial
           belongs to the player — a memo silently changing a standing setting
           is the kind of thing a boss discovers three months later. And because
           `answerCheaply` takes the cheapest open answer, every troubled front
           in the probe got pinned to a quarter of its laundering capacity for
           the rest of the career: `scorecard.probe` reported Pacing falling
           from 3.8 to 2.4 and the longest quiet stretch growing by 246 days.

           "For a while" now means what it says. The dial is on the Businesses
           screen, where the player put it.
        */
        b.exposure = clamp(b.exposure + GEN_EFFECT.frontQuietExposure, 0, 100);
        b.health = clamp(b.health + GEN_EFFECT.frontQuietHealth, 0, 100);
        addLog(state, `The back room in ${territoryDef(b.territoryId).name} was shut for a fortnight.`, 'neutral');
        return;
      }
      return;
    }

    case 'gen_street_turning': {
      const id = String(event.data.territoryId ?? '');
      const t = state.territories[id];
      if (!t) return;
      if (choiceId === 'spend') {
        if (!spend(state, GEN_EFFECT.streetSpend)) {
          addLog(state, 'You could not put anything into the street this week.', 'failure');
          return;
        }
        adjustSentiment(state, id, GEN_EFFECT.streetSentiment);
        addLog(state, `${money(GEN_EFFECT.streetSpend)} spread around ${territoryDef(id).name}. Feeling is ${Math.round(t.sentiment)}.`, 'money');
        return;
      }
      if (choiceId === 'lean') {
        adjustSentiment(state, id, GEN_EFFECT.streetLeanSentiment);
        gainFear(state, GEN_EFFECT.streetLeanFear);
        addHeat(state, GEN_EFFECT.streetLeanHeat, 'street', 'Somebody made a point in the street');
        addLog(state, `${territoryDef(id).name} was reminded. Nobody will say anything for a while.`, 'heat');
        return;
      }
      return;
    }

    case 'gen_someone_outside': {
      const id = String(event.data.civicId ?? '');
      const held = figure(state, id);
      const def = CIVIC_FIGURES.find((f) => f.id === id);
      if (!def) return;
      if (choiceId === 'help') {
        if (!spend(state, GEN_EFFECT.outsideSpend)) {
          addLog(state, `You could not cover it, so nothing was done for ${def.title.toLowerCase()}.`, 'failure');
          return;
        }
        held.standing = clamp(held.standing + GEN_EFFECT.outsideStanding, 0, 100);
        addLog(state, `${def.title} has one less problem. Standing is ${Math.round(held.standing)}.`, 'crew');
        trainAttribute(state, 'influence', 1);
        return;
      }
      held.standing = clamp(held.standing + GEN_EFFECT.outsideDeclineStanding, 0, 100);
      return;
    }

    case 'gen_somebody_inside': {
      if (!npc) return;
      if (choiceId === 'bail') {
        const bail = Math.max(1_500, Math.round(npc.wage * GEN_EFFECT.insideBailWeeks));
        if (!spend(state, bail)) {
          addLog(state, `Nobody went down for ${npc.name}. There was nothing to send.`, 'failure');
          return;
        }
        npc.stats.loyalty = clamp(npc.stats.loyalty + GEN_EFFECT.insideLoyalty, 0, 100);
        remember(npc, state.day, 'looked_after');
        addLog(state, `${money(bail)} and somebody who knows the desk sergeant. ${npc.name} was seen to.`, 'money');
        return;
      }
      npc.stats.loyalty = clamp(npc.stats.loyalty + GEN_EFFECT.insideAbandonedLoyalty, 0, 100);
      gainFear(state, GEN_EFFECT.insideAbandonedFear);
      remember(npc, state.day, 'took_a_charge');
      addNote(npc, state.day, 'Was left in there.', 'bad');
      return;
    }

    case 'gen_the_take_is_short': {
      if (!npc) return;
      if (choiceId === 'call_it_in') {
        npc.isSkimming = false;
        npc.stats.loyalty = clamp(npc.stats.loyalty + GEN_EFFECT.callItInLoyalty, 0, 100);
        gainFear(state, GEN_EFFECT.callItInFear);
        addNote(npc, state.day, 'Was told the numbers had been looked at.', 'bad');
        addLog(state, `${npc.name} was spoken to. The take came up the following week.`, 'crew');
        return;
      }
      npc.stats.loyalty = clamp(npc.stats.loyalty + GEN_EFFECT.letItGoLoyalty, 0, 100);
      npc.skimTotal += GEN_EFFECT.letItGoTakes;
      return;
    }

    case 'gen_a_name_came_up': {
      if (!npc) return;
      if (choiceId === 'ask') {
        npc.stats.grievance = clamp(npc.stats.grievance + GEN_EFFECT.askedAboutGrievance, 0, 100);
        npc.stats.fear = clamp(npc.stats.fear + GEN_EFFECT.askedAboutFear, 0, 100);
        addNote(npc, state.day, 'Somebody was sent to ask about them.', 'bad');
        addLog(state, `Somebody had a word with ${npc.name}. They said what you would expect.`, 'crew');
        return;
      }
      trainAttribute(state, 'strategy', GEN_EFFECT.ignoredItRespect);
      return;
    }

    case 'gen_asked_for_you': {
      if (choiceId === 'go') goHome(state);
      return;
    }

    case 'gen_paper_moving': {
      /*
         The first version of this offered to put everybody indoors, and it was
         free, so `answerCheaply` took it every single time — a bot picking by
         price cannot see that stopping all earning for a fortnight is the most
         expensive answer on the memo. Across `broke.probe` it compressed three
         hiring policies into each other and nearly cost the file its rule.

         Laying low already has a button on the Law panel, where the machinery
         and the warning live. A memo does not need to duplicate it, and
         duplicating it produced an option whose price is invisible to
         everything that reads prices.
      */
      if (choiceId === 'counsel') {
        const level = state.law.lawyer;
        if (level === 'firm' || level === 'best') {
          addLog(state, 'You already have people for this. They have been told.', 'neutral');
          return;
        }
        if (totalFunds(state) < legalCostAt(state, 'firm')) {
          addLog(state, 'You could not cover a week of it, so nobody was retained.', 'failure');
          return;
        }
        retainLawyer(state, 'firm');
        return;
      }
      gainRespect(state, GEN_EFFECT.paperRideRespect);
      return;
    }

    default:
      return;
  }
}

/** Loyalty and grievance move together often enough to be worth one line. */
function move(npc: Npc, loyalty: number, grievance: number): void {
  npc.stats.loyalty = clamp(npc.stats.loyalty + loyalty, 0, 100);
  npc.stats.grievance = clamp(npc.stats.grievance + grievance, 0, 100);
}

/** Nudge what one person holds against another, if the edge exists. */
function bump(npc: Npc, otherId: string, amount: number): void {
  const tie = npc.ties.find((t) => t.id === otherId);
  if (!tie) return;
  tie.resentment = clamp(tie.resentment + amount, 0, 100);
}
