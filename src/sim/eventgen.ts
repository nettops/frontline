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
import type { GameState, Npc, PendingEvent, Territory } from './types';
import { money, oneOf, payable } from './memo';
import { addLog } from './util';
import { addNote, crewList } from './npc';
import { remember } from './memory';
import { recordTie } from './ties';
import { earnDirty, spend, totalFunds } from './economy';
import { addHeat } from './heat';
import { gainFear, gainRespect, trainAttribute } from './player';
import { ownedBusinesses, weeklyRevenue } from './business';
import {
  addInfluence,
  adjustSentiment,
  playerInfluence,
  prosperity,
  territoryDef,
  territoryList,
} from './territory';
import { activeCases, agencyOf, legalCostAt, retainLawyer } from './investigation';
import { figure, helpFigure } from './civic';
import { stewardOf } from './delegation';
import { nicknameOf } from './nicknames';
import { priced } from './market';
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

  /*
     And nothing else, which is a correction rather than a narrowing.

     This used to fall back to `npc.notes`, and notes do not have the shape the
     comment above describes. A memory's text is a verb phrase with an implied
     subject — "were not paid, and remember the week" — and a note is a whole
     capitalised sentence with its own full stop. Spliced into the same slot it
     produced, verbatim, in front of two round-17 testers:

         "They have not forgotten it: they Was on the Fence Stolen Goods. It
          went wrong.. Soldier, 61 days with you."

     Reproduced twice by one of them, and the same defect reported independently
     by a second as a "broken template string". In a game whose testers scored
     the writing 10, 10 and 9, a garbled sentence inside a character-drama modal
     is worth more than the sentence it was covering for.

     The caller already handles null — it says "They will not say what it is
     about, which is its own answer", which is a better line than any note would
     have produced anyway.
  */
  return null;
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


/**
 * The man running a district for you, asking for something.
 *
 * Delegation is the largest system in the late game with no memo surface: a
 * player hands somebody a street and then never hears from him except through
 * a weekly ledger line. Every other shape in this file fires on something an
 * early family already has, so the generated supply thinned exactly where the
 * authored pool had also been round twice.
 *
 * Gated on a season in the job, so this is a man reporting in rather than an
 * introduction — and on the district being worth something, so the ask has a
 * reason behind it.
 */
const stewardAsks: EventDef = {
  id: 'gen_steward_asks',
  ...shape('gen_steward_asks'),
  applies(state, rng) {
    const held = territoryList(state).filter((t) => {
      const man = stewardOf(state, t);
      if (!man || man.status !== 'active') return false;
      return state.day - (t.stewardSince ?? state.day) >= GEN_WHEN.stewardSeasonDays;
    });
    if (held.length === 0) return null;
    const t = rng.pick(held);
    const man = stewardOf(state, t)!;
    return { territory: t, npc: man };
  },
  build(state, rng, ctx) {
    const t = ctx.territory!;
    const man = ctx.npc!;
    const where = territoryDef(t.id).name;
    const months = Math.round((state.day - (t.stewardSince ?? state.day)) / 30);
    return {
      defId: 'gen_steward_asks',
      title: `${man.name} wants a free hand in ${where}`,
      body: oneOf(rng, [
        `${man.name} has had ${where} for ${months} months and stopped asking permission ` +
          `for the small things a while ago. Now the big one: money to do it properly, and ` +
          `nobody standing over the work while it is done.`,
        `A message from ${where}, ${months} months into ${man.name} running it. The street ` +
          `could do more than it is doing, and what is stopping it is you. Respectfully put, ` +
          `and clearly rehearsed.`,
      ]),
      severity: 'opportunity',
      npcId: man.id,
      data: { territoryId: t.id },
      choices: [
        {
          id: 'back',
          label: 'Give them the free hand',
          ...payable(state, priced(state, GEN_EFFECT.stewardBackingCost), 'and the run of the place'),
        },
        {
          id: 'refuse',
          label: 'Your way, or not at all',
          hint: 'That answer will be heard, and not only by the one who asked.',
        },
      ],
    };
  },
};

/*
   What a frightened street puts in an envelope.

   Off `prosperity` rather than a flat figure, so a collection from a rich
   district is worth taking and one from a poor district is mostly a message.
   Shared between the shape and its resolution, because the number in the
   button has to be the number that arrives.
*/
function frightenedTake(state: GameState, t: Territory): number {
  return Math.max(
    500,
    Math.round(prosperity(state, t.id) * GEN_WHEN.frightenedTakeShare),
  );
}

/**
 * The name the street gave you, said to your face.
 *
 * `nicknames.ts` hands out a byname on a weekly roll and then nothing in the
 * game ever mentions it again — it sits on the player screen next to the title
 * and pays a stat point. A name is other people's opinion, so the surface it
 * belongs on is somebody using it in a room, and whether you let them is the
 * only question worth asking about it.
 *
 * Gated on having one, which means this cannot fire before day 120 at the
 * earliest and usually much later. That is the point: it is content for the
 * half of a career where the authored pool has been round twice.
 */
const theNameStuck: EventDef = {
  id: 'gen_the_name_stuck',
  ...shape('gen_the_name_stuck'),
  applies(state, rng) {
    if (!nicknameOf(state)) return null;
    const crew = active(state);
    return crew.length ? { npc: rng.pick(crew) } : null;
  },
  build(state, rng, ctx) {
    const npc = ctx.npc!;
    const name = nicknameOf(state)!.name;
    return {
      defId: 'gen_the_name_stuck',
      title: `They are calling you ${name}`,
      body: oneOf(rng, [
        `${npc.name} used it in front of four people and did not look up. ` +
          `Nobody corrected them. It has stopped being a thing said behind your back ` +
          `and become a thing said in rooms you are standing in.`,
        `It came up twice at the table. ${npc.name} said it the second time, ` +
          `to your face, the way you would use somebody's actual name. ` +
          `Everybody waited to see what you did about it.`,
        `A message came in addressed to ${name}. ${npc.name} brought it through ` +
          `and put it down without a word, which is its own kind of question.`,
      ]),
      severity: 'opportunity',
      npcId: npc.id,
      data: {},
      choices: [
        {
          id: 'own',
          label: 'Let it stand',
          hint: 'People will say it more, and mean it.',
        },
        {
          id: 'refuse',
          label: 'Put a stop to it',
          hint: 'They will use your name. They will also remember being told.',
        },
      ],
    };
  },
};

/**
 * The man you bought the front from, who is still in the front.
 *
 * `frontDeal.ts` lets a place be closed on "they keep a piece", which is
 * cheaper up front and leaves somebody in the building with a claim on it. The
 * terms moved revenue and exposure from the day they shipped and nothing ever
 * said his name again — a deal with a person in it that becomes a percentage
 * the following morning is a deal the player forgets making.
 *
 * So he comes back, once the place has had time to become his again.
 */
const oldOwner: EventDef = {
  id: 'gen_old_owner',
  ...shape('gen_old_owner'),
  applies(state, rng) {
    const kept = ownedBusinesses(state).filter(
      (b) =>
        b.terms?.includes('he_stays') &&
        state.day - b.purchasedDay < GEN_WHEN.oldOwnerSettlesAfterDays,
    );
    return kept.length ? { business: rng.pick(kept) } : null;
  },
  build(state, rng, ctx) {
    const b = ctx.business!;
    const where = territoryDef(b.territoryId).name;
    const weekly = weeklyRevenue(state, b);
    const buyout = Math.max(3_000, Math.round(weekly * GEN_EFFECT.oldOwnerBuyoutWeeks));
    return {
      defId: 'gen_old_owner',
      title: `The old owner in ${where}`,
      body: oneOf(rng, [
        `They still have a key and still call it theirs. The staff go to them first ` +
          `and to your manager second, and the piece they kept is starting to look, ` +
          `from where they are standing, like the part that matters.`,
        `They have been telling people in ${where} that what they sold was the ` +
          `paperwork and not the place. It is the kind of thing that is funny ` +
          `until somebody official writes it down.`,
        `A word from ${where}: the one you left in there has been taking meetings ` +
          `in the back that nobody told you about. Nothing you could point at. ` +
          `Everything you would recognise.`,
      ]),
      severity: 'warning',
      npcId: null,
      data: { businessId: b.id },
      choices: [
        {
          id: 'buy',
          label: 'Buy the rest of it off them',
          ...payable(state, priced(state, buyout), 'and the place is only yours'),
        },
        {
          id: 'lean',
          label: 'Remind them what they signed',
          hint: 'They will stop. The place will feel it.',
        },
        {
          id: 'leave',
          label: 'Let them keep the corner',
          hint: 'Cheapest today. They are still there tomorrow.',
        },
      ],
    };
  },
};

/**
 * A street that pays because it is frightened, which is not the same as a
 * street that pays.
 *
 * Fear was reworked this cycle into something a career can actually reach, and
 * every consequence of it is a multiplier somewhere — recruit costs, witness
 * odds, defection. None of it is ever *said*, so a boss at fear 80 and a boss
 * at fear 20 read the same log. This is the one place the game tells you what
 * being frightening looks like from the other side, and it makes you decide
 * whether you want it.
 */
const theyAreFrightened: EventDef = {
  id: 'gen_they_are_frightened',
  ...shape('gen_they_are_frightened'),
  applies(state, rng) {
    if (state.org.fear < GEN_WHEN.frightenedFear) return null;
    const sour = territoryList(state).filter(
      (t) =>
        t.influence.player >= GEN_WHEN.districtInfluence &&
        t.sentiment <= GEN_WHEN.frightenedSentimentUnder,
    );
    return sour.length ? { territory: rng.pick(sour) } : null;
  },
  build(state, rng, ctx) {
    const t = ctx.territory!;
    const where = territoryDef(t.id).name;
    const take = frightenedTake(state, t);
    return {
      defId: 'gen_they_are_frightened',
      title: `${where} has taken a collection`,
      body: oneOf(rng, [
        `Nobody asked them to. Somebody in ${where} went round the shops with an ` +
          `envelope and it came back full, and whoever brought it would not ` +
          `look at anybody while they were holding it.`,
        `An envelope arrived from ${where} with no name on it and no message. ` +
          `The street decided on its own what the rate was. Nobody wants to be ` +
          `the one who did not put in.`,
        `They have started paying before anybody comes. A shopkeeper in ${where} ` +
          `asked one of yours whether it was enough, and one of yours had no ` +
          `idea what they were being asked about.`,
      ]),
      severity: 'opportunity',
      npcId: null,
      data: { territoryId: t.id },
      choices: [
        {
          id: 'take',
          label: `Take it — ${money(take)}`,
          hint: 'It spends. They will remember why they gave it.',
        },
        {
          id: 'refuse',
          label: 'Send it back',
          hint: 'Costs you the money and buys something the money cannot.',
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
  stewardAsks,
  theNameStuck,
  oldOwner,
  theyAreFrightened,
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
        if (!spend(state, ask, 'world')) {
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
        if (!spend(state, cost, 'world')) {
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
        if (!spend(state, GEN_EFFECT.streetSpend, 'world')) {
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
        if (!spend(state, GEN_EFFECT.outsideSpend, 'world')) {
          addLog(state, `You could not cover it, so nothing was done for ${def.title.toLowerCase()}.`, 'failure');
          return;
        }
        /*
           Through `helpFigure`, which caps the credit at a fortnight.

           This wrote the standing directly and paid +1 influence on top, every
           time, with nothing stopping a boss answering the same memo as often
           as it regenerated: nine of them and $81,000 bought the patron's
           Influence 9. The influence is gone entirely — helping a man makes
           *him* think better of you, and general political pull is what
           `INFLUENCE_FROM` is for.

           The money goes either way. That is the same rule the diplomatic
           approach follows: what is limited is the credit, not the act.
        */
        const counted = helpFigure(state, id, GEN_EFFECT.outsideStanding);
        addLog(
          state,
          counted
            ? `${def.title} has one less problem. Standing is ${Math.round(held.standing)}.`
            : `${def.title} took the money. You have done this lately and it did not land twice.`,
          'crew',
        );
        return;
      }
      held.standing = clamp(held.standing + GEN_EFFECT.outsideDeclineStanding, 0, 100);
      return;
    }

    case 'gen_somebody_inside': {
      if (!npc) return;
      if (choiceId === 'bail') {
        const bail = Math.max(1_500, Math.round(npc.wage * GEN_EFFECT.insideBailWeeks));
        if (!spend(state, bail, 'law')) {
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

    case 'gen_the_name_stuck': {
      if (choiceId === 'own') {
        gainFear(state, GEN_EFFECT.nameOwnedFear);
        gainRespect(state, GEN_EFFECT.nameOwnedRespect);
        addLog(state, `Nobody is going to stop saying it now.`, 'neutral');
        return;
      }
      /*
         Refusing a name costs standing, and it costs it with the man who used
         it. Both, because the name is other people's opinion and telling them
         to stop having it is a thing they notice.
      */
      gainRespect(state, GEN_EFFECT.nameRefusedRespect);
      if (npc) {
        npc.stats.loyalty = clamp(npc.stats.loyalty + GEN_EFFECT.nameRefusedLoyalty, 0, 100);
        addNote(npc, state.day, 'Was told what not to call you.', 'bad');
        addLog(state, `${npc.name} will use your name. So will everybody else, now.`, 'crew');
      }
      return;
    }

    case 'gen_old_owner': {
      const b = ownedBusinesses(state).find((x) => x.id === String(event.data.businessId ?? ''));
      if (!b) return;
      const where = territoryDef(b.territoryId).name;
      if (choiceId === 'buy') {
        const cost = priced(
          state,
          Math.max(3_000, Math.round(weeklyRevenue(state, b) * GEN_EFFECT.oldOwnerBuyoutWeeks)),
        );
        if (!spend(state, cost, 'world')) {
          addLog(state, `The money was not there, so the corner in ${where} stays theirs.`, 'failure');
          return;
        }
        /*
           The terms come off, which is the whole point of paying.

           `termRevenueShare` and `termExposure` read this array every week, so
           removing the entry is not cosmetic — it is the eighteen percent of
           revenue and the exposure the deal was costing, bought back.
        */
        b.terms = (b.terms ?? []).filter((t) => t !== 'he_stays');
        b.health = clamp(b.health + GEN_EFFECT.oldOwnerBoughtHealth, 0, 100);
        b.exposure = clamp(b.exposure + GEN_EFFECT.oldOwnerBoughtExposure, 0, 100);
        addLog(state, `${where} is yours outright. They took the money and the door.`, 'money');
        return;
      }
      if (choiceId === 'lean') {
        /*
           He stops, and the place suffers for it. The terms stay — you did not
           buy him out, you frightened him, and a frightened manager is worse
           at managing.
        */
        b.health = clamp(b.health + GEN_EFFECT.oldOwnerLeanedHealth, 0, 100);
        gainFear(state, GEN_EFFECT.oldOwnerLeanedFear);
        addLog(state, `They were reminded. ${where} has been quiet since, in every sense.`, 'neutral');
        return;
      }
      b.exposure = clamp(b.exposure + GEN_EFFECT.oldOwnerLeftExposure, 0, 100);
      addLog(state, `The corner in ${where} stays theirs, and so do the opinions.`, 'neutral');
      return;
    }

    case 'gen_they_are_frightened': {
      const t = state.territories[String(event.data.territoryId ?? '')];
      if (!t) return;
      const where = territoryDef(t.id).name;
      if (choiceId === 'take') {
        /*
           Dirty rather than clean. Nobody wrote a receipt for an envelope, and
           routing it through the wash is the same decision every other take in
           this game makes the player face.
        */
        earnDirty(state, frightenedTake(state, t), 'other_in');
        adjustSentiment(state, t.id, GEN_EFFECT.frightenedTakenSentiment);
        addLog(state, `${where} paid without being asked, and knows it.`, 'money');
        return;
      }
      adjustSentiment(state, t.id, GEN_EFFECT.frightenedRefusedSentiment);
      gainFear(state, GEN_EFFECT.frightenedRefusedFear);
      addLog(state, `The envelope went back to ${where} unopened. That will be talked about.`, 'neutral');
      return;
    }

    case 'gen_steward_asks': {
      const t = state.territories[String(event.data.territoryId ?? '')];
      if (!t || !npc) return;
      if (choiceId === 'back') {
        if (!spend(state, priced(state, GEN_EFFECT.stewardBackingCost), 'world')) {
          addLog(state, `The money was not there, so ${npc.name} was refused by default.`, 'failure');
          npc.stats.loyalty = clamp(npc.stats.loyalty - GEN_EFFECT.stewardRefusedLoyalty, 0, 100);
          return;
        }
        npc.stats.loyalty = clamp(npc.stats.loyalty + GEN_EFFECT.stewardBackedLoyalty, 0, 100);
        addInfluence(state, t.id, GEN_EFFECT.stewardBackedInfluence);
        addNote(npc, state.day, `Given the run of ${territoryDef(t.id).name}.`, 'good');
        addLog(state, `${territoryDef(t.id).name} is run the way ${npc.name} asked for now.`, 'crew');
        return;
      }
      npc.stats.loyalty = clamp(npc.stats.loyalty - GEN_EFFECT.stewardRefusedLoyalty, 0, 100);
      addNote(npc, state.day, `Asked for the run of a district and was refused.`, 'bad');
      addLog(state, `${npc.name} took it well enough, in front of you.`, 'crew');
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
