/**
 * Events: the game talking back.
 *
 * Nothing here is drawn from a flat random table. Every definition declares
 * when it *applies* to the current state, and only applicable ones are rolled.
 * A skimming event needs an actual skimmer; an informant scare needs a
 * frightened man and real heat. That is what makes the stories feel caused
 * rather than sprinkled.
 */

import { Rng, clamp } from './rng';
import type {
  Business,
  Faction,
  GameState,
  Investigation,
  Npc,
  PendingEvent,
  Territory,
} from './types';
import { addEvidence, addLog, pushEvent, weightedPick, withArticle } from './util';
import { askable, money, oneOf, payable, shortOf } from './memo';
import { GEN_DEFS, isGenerated, resolveGenerated } from './eventgen';
import { GEN_CHANCE_PER_DAY, GEN_WHEN } from '../config/eventgen';
import { endConditionEarly } from './world';
import { addNote, creditOperation, crewList, generateNpc } from './npc';
import { informFromMemory, remember } from './memory';
import { recordTie } from './ties';
import { earnDirty, refund, spend, spendSplit, totalFunds } from './economy';
import { addHeat, reduceHeat, startLayLow } from './heat';
import { gainFear, gainRespect, trainAttribute } from './player';
import { dismiss, promote } from './crew';
import {
  addInfluence,
  adjustSentiment,
  businessSlots,
  controlLevel,
  operableTerritories,
  playerInfluence,
  territoryDef,
  territoryList,
  usedSlots,
} from './territory';
import {
  acquireBusiness,
  businessDef,
  acquisitionCost,
  canAcquire,
  ownedBusinesses,
  shutterBusiness,
} from './business';
import { BUSINESS_BY_ID } from '../config/businesses';
import { contestedWith, factionInfluence, rivals } from './faction';
import {
  adjustBond,
  adjustRelationship,
  alliesOf,
  atWar,
  makePeace,
  relationship,
} from './diplomacy';
import { activeCases, hasContact } from './investigation';
import { borrow, loans, priced } from './market';
import { partnerOffer, refusePartner, takePartner } from './partner';
import { FEAR, ROLE_LABEL } from '../config/economy';
import { type FactionId } from '../config/factions';
import { AGENCY_BY_ID, CONTACT } from '../config/lawEnforcement';
import { BOND, DIPLOMACY } from '../config/diplomacy';
import { BEHAVIOUR } from '../config/npcs';
import { DIFFICULTY_BY_ID } from '../config/difficulty';
import { houseDef, houseShort } from './houses';

/** Base chance per day that *something* happens, before difficulty pressure. */
const EVENT_CHANCE_PER_DAY = 0.16;

/**
 * Sending people instead of money, on the short-notice job.
 *
 * Kept beside the event rather than in `config/`, because every other number
 * in this file is, and one balance constant living somewhere else is a thing
 * the next person has to go and find.
 */
const SHORT_NOTICE = {
  crewNeeded: 2,
  /** Labour is worth less than a stake, and everybody in the room knows it. */
  rewardShare: 0.55,
  /** And nobody is smoothing anything over on the night. */
  oddsPenalty: 0.08,
  /*
     The actual price, and it is not the money.

     The first version of this locked the two men out as `busy` for three days,
     which the soak in `sim.test.ts` correctly refused: `busy` means *on an
     operation*, and a man marked busy with no operation behind him is a hole
     in the model. That was the right refusal for a better reason than the one
     it gave. Time was a weak price anyway. What a boss with no money is really
     staking here is people, and round 15 was explicit about which of his
     holdings he would have missed:

       "What I would actually have lost was Little Sicily... and four men whose
       loyalty readings I could recite from memory. The money and the rank I
       would not have missed at all."

     So a rushed job that goes wrong hurts whoever was standing in it.
  */
  hurtDays: 9,
} as const;
/** Never stack more than this many unanswered events. */
const MAX_PENDING = 3;

export interface EventContext {
  npc?: Npc;
  other?: Npc;
  territory?: Territory;
  business?: Business;
  faction?: Faction;
  investigation?: Investigation;
  /**
   * A civic figure, by id.
   *
   * Not an object like the others because the roster is state and the
   * catalogue is config — `eventgen.ts` carries the id and looks both up. The
   * generated memos are the only thing that needs it.
   */
  civicId?: string;
  /** Set when the memo is about the house rather than the business. */
  atHome?: true;
}

export interface EventDef {
  id: string;
  weight: number;
  cooldownDays: number;
  /** Null when the current state cannot produce this event. */
  applies(state: GameState, rng: Rng): EventContext | null;
  build(state: GameState, rng: Rng, ctx: EventContext): Omit<PendingEvent, 'id' | 'day'>;
}

// -------------------------------------------------------------- helpers ----

function activeCrew(state: GameState): Npc[] {
  return crewList(state).filter((n) => n.status === 'active' || n.status === 'busy');
}

/**
 * The people who could actually be sent somewhere tonight.
 *
 * Not `activeCrew`, which counts the busy ones — it is used to decide whether
 * a memo is worth raising at all, and a man on a job is still a man you have.
 * This is the narrower question: who is standing there right now.
 */
function freeCrew(state: GameState): Npc[] {
  return crewList(state).filter((n) => n.status === 'active');
}

function pickWhere(
  state: GameState,
  rng: Rng,
  predicate: (npc: Npc) => boolean,
): Npc | null {
  const matches = activeCrew(state).filter(predicate);
  return matches.length ? rng.pick(matches) : null;
}

const EVENT_DEFS: EventDef[] = [
  // -- crew pressure ------------------------------------------------------
  {
    id: 'promotion_demand',
    weight: 22,
    cooldownDays: 12,
    applies: (state, rng) =>
      wrap(
        pickWhere(
          state,
          rng,
          (n) =>
            n.stats.ambition > BEHAVIOUR.demandAmbitionAbove &&
            n.stats.loyalty < BEHAVIOUR.demandLoyaltyBelow &&
            n.daysInCrew > 25,
        ),
      ),
    build: (_state, rng, { npc }) => ({
      defId: 'promotion_demand',
      title: oneOf(rng, [
        `${npc!.name} wants more`,
        `${npc!.name} has asked for more`,
        `${npc!.name} thinks they have waited long enough`,
      ]),
      body: oneOf(rng, [
        `They ask for a word and do not sit down.\n\n` +
          `"I've been carrying weight as ${withArticle(ROLE_LABEL[npc!.role])} for a while now. ` +
          `Longer than some people who moved up past me. I'm not complaining. I'm asking."\n\n` +
          `They are not wrong about the time. Whether they are ready is a different question, ` +
          `and one you cannot answer from where you are standing.`,
          `They do not put it as a demand. They put it as a list: what they have done ` +
            `as ${withArticle(ROLE_LABEL[npc!.role])}, who they did it with, and how long ago ` +
          `the last of it was.\n\n` +
            `The list is accurate. That is the difficulty with it.`,
          `It comes up sideways, at the end of something else, in the voice men use ` +
            `when they have rehearsed a thing and want it to sound unrehearsed.\n\n` +
            `They have been ${withArticle(ROLE_LABEL[npc!.role])} long enough to have counted it, ` +
            `and they would rather hear where they stand badly than not hear it at all.`,
      ]),
      severity: 'warning',
      npcId: npc!.id,
      data: {},
      choices: [
        { id: 'promote', label: 'Move them up', hint: 'Buys real loyalty — and gives them standing' },
        { id: 'raise', label: 'Give them more money instead', hint: 'Costs cash, does not settle it' },
        { id: 'refuse', label: 'Tell them to wait', hint: 'They will remember this' },
      ],
    }),
  },

  /*
     A grudge that comes out in front of everybody.

     **This and `gen_wants_a_word` were one memo wearing two coats**, and round
     16's tester said so: same man, same complaint, "Hear them out" as the
     first option on both, one of them titled *wants a word* and the other
     *is carrying something*.

     They were also unequal in a way nobody could see. Round 15's second MUST
     FIX was this exact situation becoming a subscription — a tester paid one
     man on days 202, 215 and 225 against an option that read "and the matter
     is closed" — and the repair was `GEN_WHEN.askedAgainAfterDays`, a
     *per-person* cooldown. It was applied to the generated half only. The
     authored twin kept its ten-day per-shape cooldown and no memory of the
     person at all, so the fixed memo and the unfixed one sat side by side
     drawing from two different halves of `tickEvents` and never blocking each
     other.

     So the two now share one guard: dealing with somebody deals with them,
     whichever memo asked. And what is left is a real difference rather than a
     reskin — **this one happened in front of the room.** The prose always said
     so ("a comment in front of others", "going round the room before it came
     to you") and nothing in the effects ever did. The crew who watched now
     learn what the boss does when somebody says it out loud, in the idiom
     `skim_discovered` already uses six blocks down.
  */
  {
    id: 'grievance_raised',
    weight: 18,
    cooldownDays: 10,
    applies: (state, rng) =>
      wrap(
        pickWhere(
          state,
          rng,
          (n) =>
            n.stats.grievance > 40 &&
            state.day - (state.flags[`asked_${n.id}`] ?? -9999) >= GEN_WHEN.askedAgainAfterDays,
        ),
      ),
    build: (state, rng, { npc }) => ({
      defId: 'grievance_raised',
      title: oneOf(rng, [
        `${npc!.name} is carrying something`,
        `Something is eating ${npc!.name}`,
        `${npc!.name} has stopped pretending`,
      ]),
      body: oneOf(rng, [
        `They have been quiet in the wrong way for a couple of weeks. Tonight it comes out ` +
          `sideways — a comment in front of others, just sharp enough to land.\n\n` +
          `Whatever it is, they have been holding it a while, and holding it is doing more ` +
          `damage than saying it would.`,
          `They have been civil for a fortnight in the way a man is civil when they are ` +
            `keeping count.\n\n` +
            `Tonight some of the count comes out. Not all of it, and not in order, ` +
            `but enough to know it has been kept.`,
          `Somebody else mentions it first, which is how you learn it has been going ` +
            `round the room before it came to you.\n\n` +
            `By the time you put it to them they have had a week to decide how to say ` +
            `it, and they say it that way.`,
      ]),
      severity: 'warning',
      npcId: npc!.id,
      data: {},
      choices: [
        {
          id: 'listen',
          label: 'Answer it in front of them',
          hint: 'Costs nothing but time. Works better if you can lead — and the room is watching',
        },
        { id: 'pay', label: 'Make it right with money', ...payable(state, 3000, 'settles it, mostly') },
        { id: 'ignore', label: 'Let it sit', hint: 'It will keep growing, and it was said out loud' },
      ],
    }),
  },

  {
    id: 'skim_discovered',
    weight: 14,
    cooldownDays: 20,
    applies: (state, rng) =>
      wrap(pickWhere(state, rng, (n) => n.isSkimming && n.skimTotal > 1_500)),
    build: (_state, rng, { npc }) => ({
      defId: 'skim_discovered',
      title: oneOf(rng, [
        `The numbers on ${npc!.name} do not work`,
        `${npc!.name} has been taking`,
        `The books do not agree with ${npc!.name}`,
      ]),
      body: oneOf(rng, [
        `You went back through what came in against what should have. It is not a large ` +
          `gap, and it is not a single mistake. It is a pattern, and it runs through them.\n\n` +
          `Roughly ${money(npc!.skimTotal)} that never reached you.\n\n` +
          `They do not know you have looked.`,
          `You were not looking for it. You were looking for something else and it was ` +
            `in the way: small, regular, and running back further than you want to think ` +
            `about.\n\n` +
            `Roughly ${money(npc!.skimTotal)}.\n\n` +
            `They still believe nobody reads the books.`,
          `It is careful work. Never the same amount, never the same week, never enough ` +
            `to notice unless somebody sat down with a year of it and a pencil.\n\n` +
            `${money(npc!.skimTotal)}, near enough.\n\n` +
            `Somebody sat down with a year of it and a pencil.`,
      ]),
      severity: 'danger',
      npcId: npc!.id,
      data: { amount: npc!.skimTotal },
      choices: [
        { id: 'confront', label: 'Confront them', hint: 'They return most of it. Everyone hears about it' },
        { id: 'remove', label: 'Cut them out entirely', hint: 'Ends it. They walk out knowing things' },
        { id: 'watch', label: 'Say nothing and watch', hint: 'Learn where the money goes. It keeps going' },
      ],
    }),
  },

  {
    id: 'informant_scare',
    weight: 16,
    cooldownDays: 14,
    applies: (state, rng) => {
      if (state.org.heat < BEHAVIOUR.informantHeatAbove) return null;
      /*
       * Frightened, unconvinced, and carrying something.
       *
       * The first two were always the gate. The third is what memory is for:
       * an investigator sitting across a table from somebody you left inside
       * for three months is having a very different conversation from one
       * sitting across from a man whose family you paid for, and until this
       * existed the simulation could not tell those two men apart.
       */
      return wrap(
        pickWhere(
          state,
          rng,
          (n) =>
            n.stats.fear > BEHAVIOUR.informantFearAbove &&
            n.stats.loyalty < BEHAVIOUR.informantLoyaltyBelow &&
            informFromMemory(n, state.day) >= 1,
        ),
      );
    },
    build: (state, rng, { npc }) => ({
      defId: 'informant_scare',
      title: oneOf(rng, [
        `Somebody has been talking to ${npc!.name}`,
        `${npc!.name} has been approached`,
        `Somebody is working on ${npc!.name}`,
      ]),
      body: oneOf(rng, [
        `A car outside their place two nights running. A conversation at their sister's ` +
          `restaurant that they did not mention.\n\n` +
          `They may have said nothing. Frightened men often say nothing, right up until ` +
          `they say everything.`,
          `They were picked up on a Tuesday over nothing and let go the same afternoon, ` +
            `which is not what happens to people they actually want.\n\n` +
            `They mentioned it themselves, eventually, in a way that suggested they had ` +
            `spent a while deciding whether to mention it at all.`,
          `Their brother-in-law does not work for the city and has started saying they ` +
            `does. Somebody has been generous with somebody.\n\n` +
            `None of it is proof. All of it is the shape proof usually arrives in.`,
      ]),
      severity: 'danger',
      npcId: npc!.id,
      data: {},
      choices: [
        { id: 'reassure', label: 'Sit with them', hint: 'Steadies them if they trust you at all' },
        { id: 'pay', label: 'Put money in their hand', ...payable(state, 8000, 'fear is expensive') },
        { id: 'cut', label: 'Cut them loose now', hint: 'Removes them. Guarantees they have a reason' },
      ],
    }),
  },

  {
    id: 'crew_dispute',
    weight: 14,
    cooldownDays: 15,
    applies: (state, rng) => {
      const crew = activeCrew(state);
      if (crew.length < 3) return null;
      const pair = rng.sample(crew, 2);
      if (pair.length < 2) return null;
      return { npc: pair[0], other: pair[1] };
    },
    build: (_state, rng, { npc, other }) => ({
      defId: 'crew_dispute',
      title: `${npc!.name} and ${other!.name} are not speaking`,
      body: oneOf(rng, [
        `It started over a split and it has stopped being about the split. Two of your ` +
          `people, working the same streets, refusing to be in the same room.\n\n` +
          `Left alone, one of them will do something about it.`,
        `Nobody will tell you what it was about, which means everybody knows. ` +
          `${npc!.name} takes the long way round to avoid a door ${other!.name} is behind.\n\n` +
          `It has been three weeks. It is not going to burn itself out.`,
        `Something was said about somebody's family, and it was said in front of people. ` +
          `Neither of them has repeated it to you and neither of them has forgotten it.\n\n` +
          `They cannot be put on the same job now, which costs you before either of them ` +
          `does anything.`,
        `${other!.name} was given work that ${npc!.name} thought was theirs. That is the ` +
          `version you have been told, by a third man, who has their own reasons.\n\n` +
          `Whatever it actually is, they are two of yours and they are pointed at each other.`,
      ]),
      severity: 'warning',
      npcId: npc!.id,
      data: { otherId: other!.id },
      choices: [
        { id: 'side_a', label: `Back ${npc!.name}`, hint: 'One is satisfied, one is not' },
        { id: 'side_b', label: `Back ${other!.name}`, hint: 'One is satisfied, one is not' },
        { id: 'crush', label: 'Shut both of them down', hint: 'Nobody is happy. Nobody escalates' },
      ],
    }),
  },

  // -- law enforcement ----------------------------------------------------
  {
    id: 'police_sweep',
    weight: 20,
    cooldownDays: 18,
    applies: (state) => (state.org.heat > 38 ? {} : null),
    build: (state, rng) => ({
      defId: 'police_sweep',
      title: oneOf(rng, [
        'They are sweeping the neighbourhood',
        'There are a lot of uniforms about',
        'Somebody has ordered a clean-up',
      ]),
      body: oneOf(rng, [
        `Uniforms on corners that never had uniforms. Doors going in on people who are ` +
          `barely connected to you, which means somebody is building a map and filling in ` +
          `the edges first.\n\n` +
          `It will pass. What it leaves behind depends on what you do this week.`,
          `Three doors on one street in a week, none of them anybody who matters, ` +
            `all of them people who know somebody who does.\n\n` +
            `They are not looking for anything yet. They are finding out who moves ` +
            `when they push.`,
          `Cars parked where cars are not usually parked, for long enough that the ` +
            `street has stopped remarking on it.\n\n` +
            `Nobody has come to your door. That is either good news or a decision ` +
            `somebody has made about timing.`,
      ]),
      severity: 'danger',
      npcId: null,
      data: {},
      choices: [
        {
            id: 'lay_low',
            label: 'Go dark',
            /*
               It was 'Everything stops' / 'nothing earns', and it stopped
               being true when quiet work was allowed to move while laying low.
               Round 14 went dark four times, used the Quiet approach from day
               86, never discovered the two combine, and filed it as "there is
               no partial option". There is. Every string in the game said
               otherwise.
            */
            hint: `Lay low. Heat falls fast, respect suffers, and only quiet work moves`,
          },
        { id: 'lawyer', label: 'Put a lawyer in front of it', ...payable(state, 25_000, 'cuts the attention now') },
        { id: 'ride', label: 'Carry on as normal', hint: 'Costs nothing. Leaves more behind' },
      ],
    }),
  },

  /*
     Somebody they have arrested and are working on.

     This used to be one fixed page on a ten-day cooldown, so a man who stayed
     in custody produced the identical memo — same headline, same body, same
     three options — every couple of weeks for as long as he was inside. A
     playtester got it verbatim on day 40, day 57 and day 88 and read it as a
     fake choice, which it was not: leaving him alone has always cost real
     loyalty and filed real informant evidence. It just never said so, and a
     consequence the player cannot see is indistinguishable from no consequence
     at all.

     So it counts. Each time you leave him, the room gets closer and the page
     says which turn of the screw this is, and the third time he breaks and the
     event is over. Paying buys actual relief rather than a fortnight's delay:
     counsel ends it, looking after his family walks it back a step.
  */
  {
    id: 'arrest_pressure',
    weight: 15,
    cooldownDays: 10,
    applies: (state, rng) => {
      const held = crewList(state).filter(
        (n) => n.status === 'arrested' && (state.flags[`broke_${n.id}`] ?? 0) === 0,
      );
      return held.length ? { npc: rng.pick(held) } : null;
    },
    build: (state, _rng, { npc }) => {
      const times = state.flags[`pressed_${npc!.id}`] ?? 0;
      const stage = Math.min(times, 2);

      const title = [
        `They are working on ${npc!.name}`,
        `They are still working on ${npc!.name}`,
        `${npc!.name} is close to going`,
      ][stage];

      const body = [
        `Word comes back that they have had them in a room three times this week. They ` +
          `are not asking about the charge any more. They are asking about you.\n\n` +
          `They have not said anything yet. Yet is doing a lot of work in that sentence.`,

        `They have stopped asking them questions and started showing them answers. Dates, ` +
          `places, two names they have never said out loud in their life.\n\n` +
          `They know nobody came the last time. They have had a fortnight in a cell to think ` +
          `about what that meant.`,

        `Their cousin has been told to pass something along, and what they have been told to ` +
          `pass along is a question: is anybody coming.\n\n` +
          `They have put terms in front of them and they have not signed them. That is the ` +
          `whole of the good news, and it does not keep.`,
      ][stage];

      return {
        defId: 'arrest_pressure',
        title,
        body,
        severity: 'danger',
        npcId: npc!.id,
        data: { stage },
        choices: [
          {
            id: 'lawyer',
            label: 'Send a real lawyer',
            ...payable(state, 20_000, 'they stop talking to anyone, and this ends'),
          },
          {
            id: 'family',
            label: 'Look after their family',
            ...payable(state, 6_000, 'cheaper, and it buys back some ground'),
          },
          {
            id: 'nothing',
            label: 'Leave them to it',
            hint: stage < 2 ? 'Free. They will notice that too' : 'Free. This is the last time you will be asked',
          },
        ],
      };
    },
  },

  // -- opportunity --------------------------------------------------------
  {
    id: 'opportunity_score',
    weight: 18,
    cooldownDays: 14,
    applies: (state) => (crewList(state).length >= 2 ? {} : null),
    build: (state, rng) => {
      const scale = 2_000 + state.org.respect * 220;
      // Sized to your standing, then bounded by your bank. The reward is a
      // multiple of the stake, so a lean month still gets a real gamble —
      // just a smaller one.
      const cost = askable(state, Math.round(rng.float(scale * 0.35, scale * 0.6)), 400);
      const reward = Math.round(cost * rng.float(2.2, 3.6));
      const heat = rng.int(6, 16);
      return {
        defId: 'opportunity_score',
        title: oneOf(rng, [
          'A short-notice job',
          'Something tonight, or not at all',
          'A window, and it is closing',
          'Somebody wants an answer this afternoon',
        ]),
        body: oneOf(rng, [
          `Someone you half-trust brings a window: tonight only, no time to plan it ` +
            `properly, and the money is real.\n\n` +
            `${money(cost)} up front. If it works, ${money(reward)}.\n\n` +
            `If it does not work, it will be noticed, because there is no version of this ` +
            `that is done quietly.`,
          `A man you have used twice and liked once has something moving tonight and ` +
            `nobody to move it with.\n\n` +
            `They want ${money(cost)} in their hand before anything happens. They say it comes ` +
            `back as ${money(reward)}, and they say it like a man who has already spent it.\n\n` +
            `There is no quiet version. Whatever happens, somebody will know it was you.`,
          `The kind of thing that is only ever offered late: no plan, no second look, and ` +
            `an answer wanted before the evening is out.\n\n` +
            `${money(cost)} to be part of it. ${money(reward)} if it holds together.\n\n` +
            `Rushed work leaves more behind than careful work. That is the whole of the ` +
            `argument against it.`,
          `Word through two people, which is one more than you would like.\n\n` +
            `${money(cost)} tonight, ${money(reward)} by the weekend, and nothing in between ` +
            `that anybody has thought about properly.\n\n` +
            `It is a real number and a real window. It is also exactly how people end up ` +
            `explaining themselves in a room with no handle on the inside.`,
        ]),
        severity: 'opportunity',
        npcId: null,
        data: { cost, reward, heat },
        choices: [
          {
            id: 'take',
            label: `Take it — ${money(cost)}`,
            hint: 'Roughly even odds. Significant attention either way',
            disabledReason:
              totalFunds(state) < cost ? 'You cannot cover the up-front cost' : undefined,
            cost: cost,
          },
          {
            /*
               And the answer for a boss who has people but no money.

               Round 15 spent 126 days watching every priced option grey out:
               "the only clickable option was 'Leave them to it.' That is not a
               decision, it is a cutscene with a button." This memo was the one
               `obstacles.test.ts` caught — its free choice ran
               `if (choiceId !== 'take') return;`, which is a button that does
               nothing dressed as a decision.

               A man who cannot put money in can put bodies in. It pays less,
               because a stake is worth more than labour and everybody in the
               room knows it, and it costs the two things an organization with
               no money still has: people for a few days, and the attention
               that comes of doing a rushed job with your own name on it.
            */
            id: 'send',
            label: 'Send your own people instead',
            hint:
              `No money up front. A smaller cut, worse odds, and it is ` +
              `${SHORT_NOTICE.crewNeeded} of your own people in the room`,
            disabledReason:
              freeCrew(state).length < SHORT_NOTICE.crewNeeded
                ? `You would need ${SHORT_NOTICE.crewNeeded} people free tonight; ` +
                  `you have ${freeCrew(state).length}`
                : undefined,
          },
          { id: 'pass', label: 'Pass', hint: 'Nothing gained, nothing noticed' },
        ],
      };
    },
  },

  {
    id: 'recruit_offer',
    weight: 16,
    // Longer than most: this is "a stranger turns up", and a stranger turning
    // up every twelve days is not a city, it is a queue. The recruit pool in
    // the Organization panel is the ordinary way to hire; this is the one that
    // is supposed to feel like a favour being called in.
    cooldownDays: 26,
    /*
       And only when there is some chance of saying yes.

       The gate was `crew >= 1`, which is true from the first morning, and the
       fee starts at $1,500 against a starting balance of $2,500 that the first
       week's wages eat into. Played from a cold start: the first modal of the
       career arrived on day 6 offering somebody at $3,029 with the button
       greyed out and "You cannot cover it" under it. A favour being called in
       is not supposed to be the game's opening line to a player who cannot
       take it.

       The floor is the bottom of the fee range, so the offer can still be too
       expensive — that is a decision. It can no longer be impossible, which is
       not one.
    */
    applies: (state) =>
      crewList(state).length >= 1 && totalFunds(state) >= 1_500 ? {} : null,
    build: (state, rng) => {
      const fee = Math.round(rng.float(1_500, 4_000) * (1 + state.org.respect / 200));
      return {
        defId: 'recruit_offer',
        title: 'Somebody is available',
        body: oneOf(rng, [
          `A name comes to you through two people you trust and one you do not. They have ` +
            `done real work elsewhere and that arrangement has ended, for reasons nobody ` +
            `is being specific about.\n\n` +
            `They are better than what walks in off the street. They also come from somewhere, ` +
            `and somewhere remembers them.`,
          `They ask for the meeting themselves, which is either confidence or need. Fifteen ` +
            `years in it, no convictions, and a last employer they will not name.\n\n` +
            `Everything about them is better than you can currently afford to be choosy ` +
            `about. That is usually the problem.`,
          `Somebody's cousin, except the somebody is a man whose calls you take. The ` +
            `recommendation is warm and entirely unspecific about the last four years.\n\n` +
            `Good hands, by all accounts. Turning them down is a conversation too.`,
          `They have been sitting in the same bar for a week, being seen. Word is they walked ` +
            `out of something rather than being put out of it.\n\n` +
            `A man who leaves one table will leave another. They are also the best you have ` +
            `been offered this year.`,
        ]),
        severity: 'opportunity',
        npcId: null,
        data: { fee },
        choices: [
          {
            id: 'take',
            label: `Bring them in — ${money(fee)}`,
            hint: 'Skilled, experienced, and an unknown',
            disabledReason:
              totalFunds(state) < fee ? 'You cannot cover the fee' : undefined,
            cost: fee,
          },
          { id: 'pass', label: 'Not interested', hint: 'Fewer unknowns' },
        ],
      };
    },
  },

  {
    id: 'respect_challenge',
    weight: 14,
    cooldownDays: 16,
    applies: (state) => (state.org.respect > 15 ? {} : null),
    /*
       Three stages, and the stage is how many times you let it go.

       This shipped with three titles and three bodies, and a playtester saw it
       three times and called it filler anyway — correctly. Variants were never
       the problem: the event did not escalate and did not remember what you
       had answered, so the third appearance carried exactly as much weight as
       the first. Writing more pages for it would have been the same mistake in
       a longer form.

       `arrest_pressure` was given real staging for the same complaint and has
       not been raised since. This is that, applied to the thing the room says
       about you: answer it and the counter resets, let it go and the next one
       arrives further along.
    */
    build: (state, rng) => {
      const ignored = state.flags['let_it_go'] ?? 0;
      const stage = Math.min(ignored, 2);

      const title = [
        oneOf(rng, [
          'You were spoken about',
          'Your name came up, and nothing happened',
          'Somebody tested it in public',
        ]),
        oneOf(rng, [
          'It has been said again, louder',
          'The same thing, and now people are waiting',
        ]),
        oneOf(rng, [
          'It is not a rumour any more',
          'Nobody is testing it now. They have decided',
        ]),
      ][stage];

      const body = [
        oneOf(rng, [
          `In a room with a dozen people in it, somebody said your name the way you say ` +
            `the name of a man who is not a problem.\n\n` +
            `Half of them are already telling other people. What happens next is the part ` +
            `they will repeat.`,
          `It was not an insult, which would have been easier. A man asked a question ` +
            `about you and the room waited to see whether anybody would answer for you.\n\n` +
            `Nobody did. A silence like that gets described later.`,
          `They said it lightly, in the voice men use for a thing they have already ` +
            `decided is safe to say.\n\n` +
            `By tomorrow it will have been repeated by people who were not in the room, ` +
            `which is how these things stop being opinions.`,
        ]),
        oneOf(rng, [
          `The same voice, the same room, and this time it was not lowered for it.\n\n` +
            `The first time it was a question about you. This time it was a statement, and ` +
            `the difference is that nobody in the room looked surprised.`,
          `It has been repeated by somebody who was not there, to somebody who was not ` +
            `there either, and it came back to you through a third man who thought you ` +
            `already knew.\n\n` +
            `That is the shape a thing takes on its way to becoming what people think.`,
        ]),
        oneOf(rng, [
          `Two of your own were in the room this time and neither of them said anything.\n\n` +
            `That is not disloyalty. That is arithmetic: they have watched this happen ` +
            `twice and watched nothing come of it, and they have drawn the obvious ` +
            `conclusion about what standing next to you is worth.`,
          `Nobody bothered to say it out of your hearing. It was said to a man who works ` +
            `for you, in a bar you drink in, by somebody who wanted you to be told.\n\n` +
            `It has stopped being about the thing that was said. It is now about the two ` +
            `times you heard it and did nothing.`,
        ]),
      ][stage];

      return {
        defId: 'respect_challenge',
        title,
        body,
        severity: stage >= 2 ? 'danger' : 'warning',
        npcId: null,
        data: { stage },
        choices: [
          {
            id: 'violence',
            label: 'Answer it',
            hint: 'Respect and fear. Attention comes with them',
          },
          {
            id: 'talk',
            label: 'Handle it in person, quietly',
            hint: 'Depends on whether you can talk',
          },
          {
            id: 'ignore',
            label: 'Let it go',
            hint:
              stage === 0
                ? 'Costs standing. Costs nothing else'
                : stage === 1
                  ? 'Costs standing again, and it will come back worse'
                  : 'It has already cost you twice. This is the third',
          },
        ],
      };
    },
  },

  {
    id: 'loan_offer',
    weight: 12,
    cooldownDays: 20,
    applies: (state) =>
      totalFunds(state) < priced(state, 3_000) && !loans(state).some((l) => l.lenderId === 'shark')
        ? {}
        : null,
    build: (state, rng) => {
      const amount = priced(state, Math.round(rng.float(8_000, 20_000)));
      return {
        defId: 'loan_offer',
        title: oneOf(rng, [
          'Money is available',
          'Somebody would like to help',
          'There is money if you want it',
        ]),
        body: oneOf(rng, [
          `Someone has heard you are thin. They are not unpleasant about it, which is worse.\n\n` +
            `${money(amount)}, today, no paperwork. They do not say what the terms are and ` +
            `you do not ask, because both of you already know.`,
          `They know what you are short and they know it to the dollar, which means ` +
            `somebody who works for you talks in bars.\n\n` +
            `${money(amount)}, tonight. They are genuinely warm about it. Men in their line ` +
            `are always warm at the beginning.`,
          `No paperwork, no questions, and no rate said out loud — they give you the ` +
            `figure in the tone of a man remarking on the weather.\n\n` +
            `${money(amount)}. They would rather you took it than not, and that is the part ` +
            `worth thinking about.`,
        ]),
        severity: 'opportunity',
        npcId: null,
        data: { amount },
        choices: [
          { id: 'take', label: `Take the ${money(amount)}`, hint: 'Solves today. Creates a creditor' },
          { id: 'refuse', label: 'Decline', hint: 'Stay clear of them' },
        ],
      };
    },
  },

  /*
     PARKED: the partner offer is built and not wired.

     `sim/partner.ts`, `config/partner.ts` and fourteen tests are green, and
     the mechanism does what it says. The event definition that put it in front
     of a player has been taken back out, because it could not be shipped
     without pushing a pre-committed axis under its bar.

     Measured on `scorecard.probe`, 48 careers, against a 3.4 baseline and a
     bar of 3:

         weight 22, share 18%, permanent .......... Pacing 2.5, quiet 535 days
         share 12%, total take capped at 3x ....... Pacing 2.6, quiet 536 days
         no cut at all on jobs under $800 ......... Pacing 2.7, quiet 500 days
         weight dropped 22 -> 4 ................... Pacing 2.8, quiet 480 days

     Four changes, four readings inside 0.3 of each other, none of them over
     the bar. That drift is the shape of stream noise rather than of an effect
     being tuned, and the honest reading is that the cause was never isolated.
     Two things are known and neither is the whole story: `dailyMemo` fills one
     slot a day and a new definition costs an authored one, and the probe's own
     bot signs every deal it is offered and never buys out — so it measures the
     worst possible use of the feature and none of the good ones (F7).

     What it would take to wire this up: a bot that can decline, and can buy
     out when it can afford to. Until then the reading is not about the design.
  */

  // -- territory ----------------------------------------------------------
  {
    id: 'shakedown_demand',
    weight: 16,
    cooldownDays: 16,
    applies: (state) => {
      // Somewhere you have a foot in the door but do not own the room.
      const spots = territoryList(state).filter((t) => {
        const level = controlLevel(t);
        return level === 'presence' || level === 'foothold';
      });
      return spots.length ? { territory: spots[0] } : null;
    },
    build: (state, rng, { territory }) => {
      const def = territoryDef(territory!.id);
      const demand = Math.round(rng.float(2_000, 6_000) * (1 + state.org.respect / 150));
      return {
        defId: 'shakedown_demand',
        title: `Somebody wants a cut in ${def.name}`,
        body: oneOf(rng, [
          `A local operator has worked out how much you have been earning here and has ` +
            `arrived at a number.\n\n` +
            `${money(demand)}, and they describe it as a courtesy.\n\n` +
            `They are not important. What matters is who is watching to see what you do about them.`,
          `There is a man in ${def.name} who has decided they are owed something for the ` +
            `privilege of working streets they were standing on first.\n\n` +
            `${money(demand)}. They send it through a boy, which tells you what they think ` +
            `of your reach.\n\n` +
            `They are nobody. The block is watching anyway.`,
          `An envelope, unsealed, with a figure written on the outside of it. ` +
            `${money(demand)}.\n\n` +
            `No threat attached, because a threat would be an admission that they think ` +
            `they need one.\n\n` +
            `Half of ${def.name} knows it arrived before you did.`,
          `They wait until you are somewhere public to ask, which is the whole of their ` +
            `strategy.\n\n` +
            `${money(demand)}, framed as a contribution, delivered at a volume chosen so ` +
            `that the room can hear the answer.`,
        ]),
        severity: 'warning',
        npcId: null,
        data: { territoryId: territory!.id, demand },
        choices: [
          {
            id: 'pay',
            label: `Pay them — ${money(demand)}`,
            hint: 'Cheapest today. They will be back',
            disabledReason:
              shortOf(state, demand),
            cost: demand,
          },
          { id: 'refuse', label: 'Refuse', hint: 'Costs you standing in the district' },
          { id: 'remove', label: 'Remove them', hint: 'Ends it. Attention, and the street remembers' },
        ],
      };
    },
  },

  {
    id: 'expansion_opening',
    weight: 15,
    cooldownDays: 18,
    applies: (state, rng) => {
      // An adjacent district where you are weak — a way in, if you want it.
      const options = operableTerritories(state).filter((o) => o.unfamiliar);
      return options.length ? { territory: rng.pick(options).territory } : null;
    },
    build: (state, rng, { territory }) => {
      const def = territoryDef(territory!.id);
      /*
         Priced to what you could bear, because it is a favour rather than a
         price list.

         This was a flat $3,000-$9,000 roll and the event fires whenever there
         is an adjacent district you are weak in — which is true on the first
         morning. Played from a cold start, day 11 offered an introduction at
         $3,561 against $2,791 on hand, with the headline choice greyed out and
         "You cannot cover it" underneath. `askable` is the same helper
         `rival_overture` already uses: the man walking you in knows roughly
         what you are worth and asks for a slice of it.
      */
      const cost = askable(state, Math.round(rng.float(3_000, 9_000)), 900);
      return {
        defId: 'expansion_opening',
        title: oneOf(rng, [
          `There is a way into ${def.name}`,
          `Somebody can get you into ${def.name}`,
          `A door into ${def.name}`,
        ]),
        body: oneOf(rng, [
          `${def.blurb}\n\n` +
            `Somebody who owes somebody who owes you can make an introduction. It would ` +
            `save you months of showing up and being nobody.\n\n` +
            `${money(cost)}, and it buys a name rather than a territory.`,
          `${def.blurb}\n\n` +
            `A man who owes a man is prepared to walk you in and stand next to you while ` +
            `they do it. Standing next to you is the part you are paying for.\n\n` +
            `${money(cost)}. You would still be nobody there, but you would be nobody ` +
            `who was introduced.`,
          `${def.blurb}\n\n` +
            `There is a way to skip the year of being a stranger. It does not buy you the ` +
            `district — it buys you the first six months of it.\n\n` +
            `${money(cost)}, and the man who takes it will remember that they did.`,
        ]),
        severity: 'opportunity',
        npcId: null,
        data: { territoryId: territory!.id, cost },
        choices: [
          {
            id: 'take',
            label: `Make the introduction — ${money(cost)}`,
            hint: 'Immediate standing in the district',
            disabledReason: shortOf(state, cost),
            cost,
          },
          { id: 'pass', label: 'Do it the slow way', hint: 'Costs nothing but time' },
        ],
      };
    },
  },

  {
    id: 'community_friction',
    weight: 12,
    cooldownDays: 14,
    applies: (state) => {
      const angry = territoryList(state).filter(
        (t) => t.sentiment < 35 && playerInfluence(t) > 10,
      );
      return angry.length ? { territory: angry[0] } : null;
    },
    build: (state, rng, { territory }) => {
      const def = territoryDef(territory!.id);
      return {
        defId: 'community_friction',
        title: oneOf(rng, [
          `${def.name} has turned against you`,
          `${def.name} is closing to you`,
          `Nobody in ${def.name} wants to be seen with you`,
        ]),
        body: oneOf(rng, [
          `Doors that used to open do not. A shopkeeper who has known you fifteen years ` +
            `looked through you this morning.\n\n` +
            `People here have decided you are the problem rather than the arrangement, and ` +
            `that costs you every time you try to work the district.`,
          `The barber's is full and there is no chair. The grocer has run out of the ` +
            `thing you came in for, and had it last week.\n\n` +
            `Nobody says anything, because nobody has to. A district that has decided ` +
            `about you does it by making ordinary business slightly impossible.`,
          `Somebody's boy put a window through on your account and the street took the ` +
            `boy's side.\n\n` +
            `That is the part to pay attention to. They are not frightened of you here ` +
            `any more. They are annoyed by you, and annoyance organises.`,
        ]),
        severity: 'warning',
        npcId: null,
        data: { territoryId: territory!.id },
        choices: [
          { id: 'money', label: 'Put money into the neighbourhood', ...payable(state, 12_000, 'buys back a great deal') },
          { id: 'presence', label: 'Be seen, personally, for a while', hint: 'Slower, free, and it depends on you' },
          { id: 'ignore', label: 'They will get over it', hint: 'They will not, quickly' },
        ],
      };
    },
  },

  // -- law enforcement ----------------------------------------------------
  {
    id: 'plea_offer',
    weight: 20,
    cooldownDays: 20,
    applies: (state) => {
      // Somebody they have arrested and are working on. Driven by an actual
      // case naming an actual person, not a random draw.
      for (const investigation of activeCases(state)) {
        const held = investigation.suspectIds
          .map((id) => state.npcs[id])
          .find((n) => n && n.status === 'arrested' && n.stats.loyalty < 60);
        if (held) return { npc: held };
      }
      return null;
    },
    build: (state, rng, { npc }) => {
      const cost = 30_000;
      return {
        defId: 'plea_offer',
        title: oneOf(rng, [
          `They have offered ${npc!.name} a deal`,
          `${npc!.name} has been offered a way out`,
          `They are making ${npc!.name} an offer`,
        ]),
        body: oneOf(rng, [
          `Word comes back through their cousin. They have put terms in front of them: ` +
            `everything they know, in exchange for walking out of it.\n\n` +
            `They have not taken it. They have not refused it either.\n\n` +
            `Whatever they decide, they decide in the next few days.`,
          `It came back through a cousin, and then through a second cousin, which means ` +
            `it was meant to reach you.\n\n` +
            `Everything they have, against the rest of their life outside.\n\n` +
            `They have not said yes. They have not said no. They have said nothing for four days.`,
          `They have written it down for them, which they did not have to do, and left ` +
            `them alone with it, which they also did not have to do.\n\n` +
            `A man alone with a piece of paper over a weekend is not the same man on the ` +
            `Monday.\n\n` +
            `They have not signed it. That is the whole of what anybody can tell you.`,
        ]),
        severity: 'danger',
        npcId: npc!.id,
        data: { cost },
        choices: [
          {
            id: 'lawyer',
            label: `Put real counsel on them — ${money(cost)}`,
            hint: 'The offer stops looking attractive',
            disabledReason: shortOf(state, cost),
            cost,
          },
          {
            id: 'reassure',
            label: 'Get word to them yourself',
            /*
               The hint now reads the same number the outcome does.

               A playtester took this option three times, watched it fail three
               times, and concluded it was cosmetic. It is not — it is strictly
               better than doing nothing even when it fails, and it works
               outright when the man thinks enough of you. But the threshold is
               `respectForBoss + leadership × 3 > 60`, and an early boss has
               leadership around four, so a frightened man at forty regard sits
               in the low fifties and it cannot land. The option was honest
               about what it depended on and silent about whether that condition
               was anywhere close to met.

               This is the same repair as the odds column on the job table: not
               a probability, and not the threshold, but an honest read of
               whether the thing you are about to try is currently plausible.
            */
            hint:
              npc!.stats.respectForBoss + state.player.attributes.leadership * 3 > 60
                ? 'Costs nothing. They think enough of you that it may hold'
                : 'Costs nothing. They do not think enough of you for it to hold',
          },
          { id: 'nothing', label: 'Let them make their own choice', hint: 'They will' },
        ],
      };
    },
  },

  {
    id: 'corrupt_approach',
    weight: 12,
    cooldownDays: 40,
    applies: (state) => {
      // Somebody from an agency actually working a case reaches out.
      const cases = activeCases(state).filter((c) => !hasContact(state, c.agencyId));
      return cases.length ? { investigation: cases[0] } : null;
    },
    build: (state, rng, { investigation }) => {
      const agency = AGENCY_BY_ID[investigation!.agencyId];
      const price = Math.round(agency.contactCost * rng.float(0.5, 0.75));
      return {
        defId: 'corrupt_approach',
        title: oneOf(rng, [
          `Somebody from ${agency.shortName} wants to talk`,
          `A man from ${agency.shortName} would like a word`,
          `Somebody inside ${agency.shortName} is for sale`,
        ]),
        body: oneOf(rng, [
          `They picked the meeting place, which tells you they have thought about it.\n\n` +
            `They are not offering to make the case go away. They are offering to tell you ` +
            `what is in it, and to be slow about the parts they can be slow about.\n\n` +
            `${money(price)} to begin with, and a great deal more forever after.`,
          `A diner off the highway, a booth at the back, and a man who arrived early ` +
            `enough to choose which way they were facing.\n\n` +
            `They cannot stop the case. They can tell you what is in it before it reaches ` +
            `anybody who matters, and be unhurried about the parts nobody is watching.\n\n` +
            `${money(price)} now. The rest of it is forever.`,
          `They do not introduce themselves and do not need to. They know your name and ` +
            `two others you have not said out loud this year.\n\n` +
            `What they are selling is not protection. It is warning — a few weeks of knowing ` +
            `what is coming, which is worth more than it sounds.\n\n` +
            `${money(price)} to begin. There is no version of this that stops.`,
        ]),
        severity: 'opportunity',
        npcId: null,
        data: { agencyId: agency.id, price },
        choices: [
          {
            id: 'accept',
            label: `Take the meeting — ${money(price)}`,
            hint: 'You will see the file. They will know you are paying them',
            disabledReason: shortOf(state, price),
            cost: price,
          },
          { id: 'refuse', label: 'Do not go', hint: 'It could be a test. Some of them are' },
        ],
      };
    },
  },

  // -- rivals -------------------------------------------------------------
  {
    id: 'rival_incursion',
    weight: 22,
    cooldownDays: 12,
    applies: (state) => {
      // A family that has actually moved on the player recently, somewhere the
      // player still stands. Driven by what the AI did, not a random draw.
      for (const faction of rivals(state)) {
        const recent = faction.history.find(
          (h) =>
            h.kind === 'pressure' &&
            h.targetFactionId === 'player' &&
            state.day - h.day <= 14 &&
            h.territoryId,
        );
        if (!recent) continue;
        const territory = state.territories[recent.territoryId!];
        if (territory && playerInfluence(territory) > 5) return { faction, territory };
      }
      return null;
    },
    build: (state, rng, { faction, territory }) => {
      const def = houseDef(state, faction!.id);
      const where = territoryDef(territory!.id).name;
      const cost = 15_000;
      return {
        defId: 'rival_incursion',
        title: oneOf(rng, [
          `${def.shortName} are pushing you out of ${where}`,
          `${def.shortName} are taking liberties in ${where}`,
          `Somebody else is working ${where}`,
        ]),
        body: oneOf(rng, [
          `Two of your earners in ${where} were visited this week. Nobody was hurt, ` +
            `which was the message.\n\n` +
            `They have people on those streets now and they are not being subtle about ` +
            `whose streets they think they are.\n\n` +
            `You are at ${Math.round(playerInfluence(territory!))} in ${where}. They are at ` +
            `${Math.round(factionInfluence(territory!, faction!.id))}.`,
          `A shop in ${where} that has paid you for a year paid somebody else this ` +
            `month, and did not think it worth telling you.\n\n` +
            `That is the part that matters. Not the money. The not telling you.\n\n` +
          `You hold ${Math.round(playerInfluence(territory!))} there against their ` +
          `${Math.round(factionInfluence(territory!, faction!.id))}.`,
          `Two of their men stood on your corner in ${where} for most of an ` +
            `afternoon, doing nothing, being seen doing nothing.\n\n` +
            `It is a question rather than a move, and it has been asked in public.\n\n` +
          `${Math.round(playerInfluence(territory!))} to you in that district, ` +
          `${Math.round(factionInfluence(territory!, faction!.id))} to them.`,
        ]),
        severity: 'danger',
        npcId: null,
        data: { factionId: faction!.id, territoryId: territory!.id, cost },
        choices: [
          {
            id: 'push_back',
            label: `Answer it — ${money(cost)}`,
            hint: 'Takes ground back. Attention, and they will remember',
            disabledReason: shortOf(state, cost),
            cost,
          },
          { id: 'concede', label: 'Let them have the block', hint: 'Costs you standing there. Cools things' },
          { id: 'ignore', label: 'Do nothing', hint: 'They will read that as an answer' },
        ],
      };
    },
  },

  /*
   * The player's half of an alliance.
   *
   * Rival allies turn out for each other automatically, because they are AI
   * actors making their own decisions. The player is not, and conscripting
   * their people into a war they did not choose would take away the one thing
   * this game is about. So the player gets asked — and asked at the worst
   * possible moment, which is what an alliance actually is: an obligation that
   * arrives when it is expensive.
   *
   * Both answers cost. Sending men puts them out of reach for weeks and some
   * of them come back hurt. Refusing is remembered by the only organization on
   * the board that was on your side.
   */
  {
    id: 'ally_calls_it_in',
    weight: 20,
    cooldownDays: 30,
    applies: (state) => {
      const spare = crewList(state).filter((n) => n.status === 'active');
      if (spare.length < 2) return null;
      for (const id of alliesOf(state, 'player')) {
        if (id === 'player') continue;
        const faction = state.factions[id];
        if (!faction) continue;
        // Only when they are actually in trouble. An ally winning comfortably
        // does not need you, and being asked anyway would read as a tax.
        const fighting = rivals(state).find(
          (other) => other.id !== id && atWar(state, id, other.id),
        );
        if (!fighting) continue;
        if (faction.warWeariness < 20 && faction.strength >= fighting.strength) continue;
        return { faction, other: undefined, business: undefined };
      }
      return null;
    },
    build: (state, rng, { faction }) => {
      const def = houseDef(state, faction!.id);
      const enemy = rivals(state).find(
        (other) => other.id !== faction!.id && atWar(state, faction!.id, other.id),
      );
      const enemyName = enemy ? houseShort(state, enemy.id) : 'somebody';
      const send = Math.min(2, crewList(state).filter((n) => n.status === 'active').length - 1);
      return {
        defId: 'ally_calls_it_in',
        title: oneOf(rng, [
          `The ${def.shortName} are asking`,
          `The ${def.shortName} are calling it in`,
          `The ${def.shortName} need bodies`,
        ]),
        body: oneOf(rng, [
          `A man came to see you on behalf of the ${def.shortName}. They were polite about ` +
            `it, which is how you know how bad it is.\n\n` +
            `The ${enemyName} have been getting the better of them for weeks. They are not ` +
            `asking for money. They are asking for people, for a few weeks, and they have ` +
            `not forgotten that the arrangement runs both ways.\n\n` +
            `It would be ${send} of yours, and not all of them come back the way they left.`,
          `The ${def.shortName} sent somebody senior, which they did not have to do, and ` +
            `they asked after your family first, which they also did not have to do.\n\n` +
            `The ${enemyName} have had the better of them since the spring and it is ` +
            `showing in places it should not show. They are not asking for money.\n\n` +
            `${send} of yours, for a few weeks. Not all of that kind of loan comes back.`,
          `Your arrangement with the ${def.shortName} has never been written down and has ` +
            `never needed to be. They remind you of it anyway, gently, and the reminder is ` +
          `the point.\n\n` +
            `The ${enemyName} are winning, and they are running out of men to lose.\n\n` +
            `${send} of yours. They do not pretend they would be safe.`,
        ]),
        severity: 'warning',
        npcId: null,
        data: { factionId: faction!.id, send },
        choices: [
          {
            id: 'send',
            label: `Send ${send}`,
            hint: 'Out of reach for weeks, and some come back hurt. They will owe you',
          },
          {
            id: 'money',
            label: 'Send money instead — $40,000',
            hint: 'Keeps your people home. Buys less goodwill than blood would',
            disabledReason: shortOf(state, 40_000),
            cost: 40_000,
          },
          {
            id: 'refuse',
            label: 'Tell them no',
            hint: 'The only organization on your side finds out what you are worth',
          },
        ],
      };
    },
  },

  {
    id: 'rival_overture',
    weight: 12,
    cooldownDays: 30,
    applies: (state) => {
      // Somebody you share ground with who has not soured on you.
      const candidates = rivals(state).filter(
        // Their view of the player: whether *they* would still sit down with
        // you is not a question about your opinion of them.
        (f) => relationship(state, f.id, 'player') > -30 && contestedWith(state, f.id).length > 0,
      );
      return candidates.length ? { faction: candidates[0] } : null;
    },
    build: (state, rng, { faction }) => {
      const def = houseDef(state, faction!.id);
      const tribute = askable(state, Math.round(rng.float(8_000, 22_000)), 1_200);
      return {
        defId: 'rival_overture',
        title: oneOf(rng, [
          `${def.shortName} want an understanding`,
          `${def.shortName} would like to stop`,
          `An approach from the ${def.shortName}`,
        ]),
        body: oneOf(rng, [
          `A man you half-recognise buys you a drink and takes a long time getting to it.\n\n` +
            `They are not proposing anything as formal as an alliance. They are proposing ` +
            `that you both stop wasting money on each other, and they would like a gesture ` +
            `to mark it.\n\n` +
            `${money(tribute)}, framed as a courtesy between organizations.`,
          `A quiet room, a drink you did not order, and twenty minutes of a man being ` +
            `pleasant before they arrive at any of it.\n\n` +
            `What they eventually say is that the two of you are spending money hurting ` +
            `each other and could be spending it elsewhere. They are not wrong.\n\n` +
            `${money(tribute)}, described as a courtesy.`,
          `Not an alliance. They are careful about the word. An understanding — which is a ` +
            `word that later means whatever the stronger party decides it means.\n\n` +
            `They want it marked with something, because a thing that costs nothing is a ` +
            `thing either side can forget.\n\n` +
            `${money(tribute)}.`,
        ]),
        severity: 'opportunity',
        npcId: null,
        data: { factionId: faction!.id, tribute },
        choices: [
          {
            id: 'accept',
            label: `Pay the courtesy — ${money(tribute)}`,
            hint: 'Buys goodwill that is worth something later',
            disabledReason: shortOf(state, tribute),
            cost: tribute,
          },
          { id: 'decline', label: 'Decline politely', hint: 'Nothing changes, for now' },
          { id: 'insult', label: 'Send them back with nothing', hint: 'Costs you badly with them. Standing on the street' },
        ],
      };
    },
  },

  // -- businesses ---------------------------------------------------------
  {
    id: 'business_trouble',
    weight: 16,
    cooldownDays: 12,
    applies: (state) => {
      const exposed = ownedBusinesses(state)
        .filter((b) => b.exposure > 45)
        .sort((a, b) => b.exposure - a.exposure);
      return exposed.length ? { business: exposed[0] } : null;
    },
    build: (state, rng, { business }) => {
      const def = businessDef(business!);
      const where = territoryDef(business!.territoryId).name;
      return {
        defId: 'business_trouble',
        title: oneOf(rng, [
          `Questions about the ${def.name.toLowerCase()} in ${where}`,
          `The ${def.name.toLowerCase()} in ${where} is drawing attention`,
          `Somebody is reading the books in ${where}`,
        ]),
        body: oneOf(rng, [
          `Somebody has requested three years of filings. Not a raid, not an accusation — ` +
            `a request, on letterhead, with a deadline.\n\n` +
            `The books will survive a glance. They will not survive somebody sitting down ` +
            `with them for a week, and you do not get to choose which this is.`,
          `A clerk with a form has been to the ${def.name.toLowerCase()} in ${where} ` +
            `twice, politely, and asked the same question a different way each time.\n\n` +
            `Nothing has been alleged. Something is being established.`,
          `The accountant telephoned rather than wrote, which they have never done, to ` +
            `say the filings have been asked for.\n\n` +
            `They wanted to know whether they should be worried. They did not want an ` +
            `answer.`,
        ]),
        severity: 'danger',
        npcId: null,
        data: { businessId: business!.id },
        choices: [
          { id: 'accountant', label: 'Put an accountant on it', ...payable(state, 15_000, 'cleans the books, cuts exposure hard') },
          { id: 'slow', label: 'Slow everything down for a while', hint: 'Free. Stops laundering there and cools it off' },
          { id: 'shutter', label: 'Close it', hint: 'Ends the problem and most of your money' },
        ],
      };
    },
  },

  {
    id: 'business_offer',
    weight: 13,
    cooldownDays: 20,
    applies: (state) => {
      const holdings = territoryList(state).filter((t) => {
        const level = controlLevel(t);
        return level === 'foothold' || level === 'control' || level === 'dominance';
      });
      /*
         A shop costs what it costs, so this one is gated rather than scaled.

         The distinction against `expansion_opening` next door: an introduction
         is a favour and a favour is priced to the person asking, but a going
         concern has an owner with a number in mind. So the offer waits until
         the number is conceivable instead of bending to fit. The floor is the
         bottom of the range — it can still be too expensive, which is a
         decision; it can no longer be impossible, which is not.
      */
      if (totalFunds(state) < 9_000) return null;
      /*
         And it has to be a district that can actually take another front.

         This used to hand back `holdings[0]` — the first district at foothold
         or better — without asking whether there was a slot free in it. Round
         11 was offered a place in Little Sicily on day 157 and again on day
         291, both times with the buy button disabled and its own subtitle
         reading "No room for another front in Little Sicily", the second time
         while holding $146,000. Measured after the fact: sixteen of them
         across six careers.

         An interruption whose only live option is Pass is the game stopping
         the clock to tell you no.
      */
      const withRoom = holdings.filter((t) => usedSlots(state, t) < businessSlots(t));
      return withRoom.length ? { territory: withRoom[0] } : null;
    },
    build: (state, rng, { territory }) => {
      const def = territoryDef(territory!.id);
      /*
         A discount on the real price, rather than a number out of a hat.

         This used to be `rng.float(9_000, 16_000)` while the choice called it
         "Below market" — so round 10's tester was offered a laundromat at
         $12,853, passed, walked to the Businesses panel and found the same
         front listed at $10,573. The memo was 21% *above* market and said the
         opposite, which is worse than a bad deal: it teaches a player that the
         panel and the memo do not agree about the same object.

         Priced off `acquisitionCost` now, which is what the panel quotes, so
         "below market" is true by construction and stays true when the market,
         the district's wealth or a contested premium move it.
      */
      /*
         A discount on the real price, rather than a number out of a hat.

         This used to be `rng.float(9_000, 16_000)` while the choice called it
         "Below market" — so round 10's tester was offered a laundromat at
         $12,853, passed, walked to the Businesses panel and found the same
         front listed at $10,573. The memo was 21% *above* market and said the
         opposite, which is worse than a bad deal: it teaches a player that the
         panel and the memo do not agree about the same object.

         Priced off `acquisitionCost` now — what the panel quotes — so "below
         market" is true by construction and stays true when the market, the
         district's wealth or a contested premium move it.

         The size of the cut is deliberately small. The first version took 12 to
         28% off and `broke.probe` failed on it: cheap fronts narrowed the gap
         between the prudent bot and the greedy one from 1.5x to 1.4x, because a
         genuine bargain tempts a careful player into spending too. That is a
         real consequence and the probe was right to catch it. A few per cent
         under the asking price is what "below market" means anyway.
      */
      const price = Math.round(
        acquisitionCost(state, BUSINESS_BY_ID.laundromat, territory!) *
          rng.float(0.88, 0.97),
      );
      return {
        defId: 'business_offer',
        title: oneOf(rng, [
          `A place in ${def.name} is for sale`,
          `Somebody in ${def.name} is selling up`,
          `A front in ${def.name}, cheap`,
        ]),
        body: oneOf(rng, [
          `The owner is tired, or frightened, or both, and is not asking what it is worth.\n\n` +
            `A laundromat. Unremarkable in every way, which is the entire point of it. ` +
            `${money(price)} and it is yours before the week is out.`,
          `They want to be out by the end of the month and have no interest in haggling, ` +
            `which usually means one of two things and either of them suits you.\n\n` +
            `A laundromat. Nothing about it invites a second look, which is the only ` +
            `quality it needs.\n\n` +
            `${money(price)}.`,
          `The place has been in one family since before the war and the last of them ` +
            `does not want it. They want a number and a train ticket.\n\n` +
            `A laundromat: dull, legitimate, and open at hours nobody asks about.\n\n` +
            `${money(price)}, which is less than it is worth to you and more than it is ` +
            `worth to them.`,
        ]),
        severity: 'opportunity',
        npcId: null,
        data: { territoryId: territory!.id, price },
        choices: [
          {
            id: 'buy',
            label: `Buy it — ${money(price)}`,
            hint: 'Below market. Somewhere to put money',
            /*
               Both reasons it can fail, said at the choice point.

               This used to check affordability only. Everything else — no room
               left for another front in the district, control slipped, the
               street will not sell to you — was found out *after* the money
               moved, and the player was told "the sale fell through" and given
               it back with no reason attached. A playtester read that as a
               hidden dice roll and marked it as the game's worst moment, which
               was fair: the game knew exactly why and would not say.

               Nothing here is random. `canAcquire` already produces the
               sentence; it simply was not being asked until it was too late.
            */
            disabledReason:
              shortOf(state, price) ??
              (canAcquire(state, 'laundromat', territory!.id).reason ?? undefined),
            cost: price,
          },
          { id: 'pass', label: 'Pass', hint: 'Nothing changes' },
        ],
      };
    },
  },

  {
    id: 'loyalty_gesture',
    weight: 10,
    cooldownDays: 20,
    applies: (state, rng) =>
      wrap(pickWhere(state, rng, (n) => n.stats.loyalty > 78 && n.daysInCrew > 40)),
    build: (state, rng, { npc }) => ({
      defId: 'loyalty_gesture',
      title: oneOf(rng, [
        `${npc!.name} handled something`,
        `${npc!.name} did something and said nothing`,
        `You owe ${npc!.name} and did not know it`,
      ]),
      body: oneOf(rng, [
        `You find out afterwards, from somebody else. A problem was coming toward you ` +
          `and they stepped in front of it, quietly, and never mentioned it.\n\n` +
          `They did not do it to be seen doing it. That is the part worth knowing.`,
          `It reaches you third-hand and weeks late, from a man who assumed you already ` +
            `knew. Something was coming toward you and it did not arrive, because they made ` +
            `sure it did not.\n\n` +
            `They have not mentioned it once.`,
          `You hear it as a detail inside a story about something else entirely. They put ` +
            `themselves in front of a problem, dealt with it, and went home.\n\n` +
            `The men who tell you what they have done for you are rarely the ones who ` +
            `have done it.`,
      ]),
      severity: 'info',
      npcId: npc!.id,
      data: {},
      choices: [
        { id: 'acknowledge', label: 'Acknowledge it', hint: 'They will remember that you noticed' },
        { id: 'reward', label: 'Put money on it', ...payable(state, 5_000, 'and they still remember') },
      ],
    }),
  },
];

function wrap(npc: Npc | null): EventContext | null {
  return npc ? { npc } : null;
}

/*
   Exported for the tests that need to raise one event on purpose.

   Most event tests drive real play and wait, which is the right way to check
   that something *can* happen. It is the wrong way to check that the third
   occurrence differs from the first — that needs the same event three times in
   a row, and waiting for the dice to do it would be a slow test that sometimes
   measures nothing.
*/
/**
 * The authored table on its own, for the first of the two draws in
 * `tickEvents`. Everything below this line treats the two halves as one
 * catalogue, which is what `EVENT_DEF_BY_ID` is for — it is how
 * `refusals.test.ts` and `variation.test.ts` reach the generated memos.
 */
const AUTHORED_DEFS: EventDef[] = [...EVENT_DEFS];
EVENT_DEFS.push(...GEN_DEFS);

export const EVENT_DEF_BY_ID: Record<string, EventDef> = Object.fromEntries(
  EVENT_DEFS.map((d) => [d.id, d]),
);

// ------------------------------------------------------------- rolling ----

/**
 * Which definitions could fire today, out of the half of the table asked for.
 *
 * Cooldown, one-at-a-time, and the definition's own view of whether the world
 * can produce it. Shared by both draws below so the two halves cannot drift
 * apart on what "eligible" means.
 */
function eligible(
  state: GameState,
  rng: Rng,
  pool: EventDef[],
): { def: EventDef; ctx: EventContext; weight: number }[] {
  const out: { def: EventDef; ctx: EventContext; weight: number }[] = [];
  for (const def of pool) {
    const lastFired = state.flags[`evt_${def.id}`] ?? -9999;
    if (state.day - lastFired < def.cooldownDays) continue;
    if (state.pendingEvents.some((e) => e.defId === def.id)) continue;

    const ctx = def.applies(state, rng);
    if (ctx) out.push({ def, ctx, weight: def.weight });
  }
  return out;
}

function raise(
  state: GameState,
  rng: Rng,
  candidates: { def: EventDef; ctx: EventContext; weight: number }[],
): boolean {
  if (candidates.length === 0) return false;
  const chosen = weightedPick(candidates, rng.next());
  state.flags[`evt_${chosen.def.id}`] = state.day;
  pushEvent(state, chosen.def.build(state, rng, chosen.ctx));
  return true;
}

/**
 * The day's memo, if there is one.
 *
 * **Two draws, not one, and the second only runs when the first produced
 * nothing.** The generated half was originally appended to the authored table
 * and drawn from the same roll, which is tidy and was wrong: there is one memo
 * slot a day, so every generated memo cost an authored one. `scorecard.probe`
 * put a number on it — Pacing fell from 3.8 to 2.4 and the longest stretch
 * without a first grew by 246 days — because the authored events are what
 * carry the firsts.
 *
 * Lowering the generated weights protected pacing and gutted the supply the
 * generator exists for: it ended up supplying 15% of the new situations in the
 * back half of a career, which is a rounding error on somebody else's work.
 *
 * So they no longer compete. The authored pool draws first and keeps every
 * slot it can fill. The generated half gets the days the pool has nothing for,
 * which is precisely the hole round 14 fell into — by day 180 the authored
 * events are all on cooldown or already answered, and the game goes quiet.
 */
export function tickEvents(state: GameState, rng: Rng): void {
  if (state.pendingEvents.length >= MAX_PENDING) return;

  const diff = DIFFICULTY_BY_ID[state.difficulty];
  if (rng.chance(EVENT_CHANCE_PER_DAY * diff.eventPressure)) {
    if (raise(state, rng, eligible(state, rng, AUTHORED_DEFS))) return;
  }

  if (!rng.chance(GEN_CHANCE_PER_DAY * diff.eventPressure)) return;
  raise(state, rng, eligible(state, rng, GEN_DEFS));
}

// ----------------------------------------------------------- resolution ----

/**
 * Applies the player's answer. Every branch changes state — there are no
 * choices here that only print text.
 */
export function resolveEvent(
  state: GameState,
  rng: Rng,
  eventId: string,
  choiceId: string,
): void {
  const index = state.pendingEvents.findIndex((e) => e.id === eventId);
  if (index === -1) return;
  const event = state.pendingEvents[index];
  state.pendingEvents.splice(index, 1);

  const npc = event.npcId ? state.npcs[event.npcId] : null;

  // The generated half resolves itself. Everything it does moves a number an
  // existing system already owns, so it needs no case in the table below.
  if (isGenerated(event.defId)) {
    resolveGenerated(state, rng, event, choiceId);
    return;
  }

  switch (event.defId) {
    /*
       The city's weather, and the one thing that can be done about it.

       Every world condition used to carry a single button saying there was
       nothing to decide, and for most of them that is true. Five can be
       reached by a boss with money — see `WorldConditionDef.endEarly` — and
       the spending, the clearing and the log line all belong to `world.ts`,
       which is the only other place `conditionId` is written.
    */
    case 'world_condition': {
      if (choiceId === 'end_early') endConditionEarly(state);
      return;
    }

    // ----------------------------------------------------- crew pressure --
    case 'promotion_demand': {
      if (!npc) return;
      if (choiceId === 'promote') {
        const result = promote(state, npc.id);
        if (!result.ok) {
          // Promised nothing you could deliver — worse than refusing outright.
          npc.stats.grievance = clamp(npc.stats.grievance + 20, 0, 100);
          npc.stats.loyalty = clamp(npc.stats.loyalty - 8, 0, 100);
          addLog(state, `You could not move ${npc.name} up. They noticed.`, 'crew');
        }
        trainAttribute(state, 'leadership', 1.5);
      } else if (choiceId === 'raise') {
        const bump = Math.round(npc.wage * 0.5);
        npc.wage += bump;
        npc.stats.loyalty = clamp(npc.stats.loyalty + 4, 0, 100);
        npc.stats.ambition = clamp(npc.stats.ambition - 4, 0, 100);
        addNote(npc, state.day, 'Asked for a promotion, got money.', 'neutral');
        addLog(state, `${npc.name} took the money. They wanted the title.`, 'crew');
      } else {
        npc.stats.grievance = clamp(npc.stats.grievance + 18, 0, 100);
        npc.stats.loyalty = clamp(npc.stats.loyalty - 6, 0, 100);
        addNote(npc, state.day, 'Was told to wait.', 'bad');
      }
      return;
    }

    case 'grievance_raised': {
      if (!npc) return;
      /*
         Dealt with, on the same flag `gen_wants_a_word` writes.

         Set before the branches for the reason that file records: a branch
         added later cannot forget it, and forgetting it is how this became a
         subscription. Shared rather than parallel so that hearing a man out
         here also stops the other memo asking the same thing next week —
         these are one situation, and it should take one answer.

         Written even on the branch where the money was not there, because the
         complaint was still made and still answered; being told no is being
         dealt with, and the effects below charge for it.
      */
      state.flags[`asked_${npc.id}`] = state.day;

      /*
         Everybody who heard it, which is what makes this memo its own thing.

         The prose has always said this happened in public and the effects
         never did — the same fault `skim_discovered` avoids by moving the
         onlookers when somebody is made to give money back. Small numbers on
         purpose: the man himself is the event, and the room is the difference
         between saying a thing out loud and saying it in a doorway.
      */
      const watched = crewList(state).filter((n) => n.id !== npc.id && n.status === 'active');

      if (choiceId === 'listen') {
        // Leadership decides whether talking actually works.
        const effect = 10 + state.player.attributes.leadership * 2;
        npc.stats.grievance = clamp(npc.stats.grievance - effect, 0, 100);
        npc.stats.respectForBoss = clamp(npc.stats.respectForBoss + 4, 0, 100);
        trainAttribute(state, 'leadership', 1.2);
        remember(npc, state.day, 'was_believed');
        addNote(npc, state.day, 'Was listened to.', 'good');
        // They watched a complaint get an answer. That is worth something to
        // people who are carrying one of their own.
        for (const other of watched) {
          other.stats.respectForBoss = clamp(other.stats.respectForBoss + 3, 0, 100);
        }
      } else if (choiceId === 'pay') {
        if (spend(state, 3_000, 'world')) {
          npc.stats.grievance = clamp(npc.stats.grievance - 25, 0, 100);
          npc.stats.greed = clamp(npc.stats.greed + 3, 0, 100);
          addNote(npc, state.day, 'Was paid to let something go.', 'neutral');
          addLog(state, `${money(3_000)} to ${npc.name}, and the matter is closed. They will remember that it worked.`, 'money');
          // And so will everybody who saw what closed it.
          for (const other of watched) {
            other.stats.greed = clamp(other.stats.greed + 2, 0, 100);
          }
        } else {
          addLog(state, 'You did not have it to give.', 'failure');
          npc.stats.grievance = clamp(npc.stats.grievance + 8, 0, 100);
        }
      } else {
        npc.stats.grievance = clamp(npc.stats.grievance + 12, 0, 100);
        npc.stats.loyalty = clamp(npc.stats.loyalty - 5, 0, 100);
        // Letting it sit in private is a decision. Letting it sit after it has
        // been said in front of the room is a statement about all of them.
        for (const other of watched) {
          other.stats.respectForBoss = clamp(other.stats.respectForBoss - 2, 0, 100);
        }
      }
      return;
    }

    case 'skim_discovered': {
      if (!npc) return;
      if (choiceId === 'confront') {
        const recovered = Math.round(npc.skimTotal * 0.7);
        earnDirty(state, recovered);
        npc.skimTotal = 0;
        npc.isSkimming = false;
        npc.stats.fear = clamp(npc.stats.fear + 20, 0, 100);
        npc.stats.grievance = clamp(npc.stats.grievance + 15, 0, 100);
        npc.stats.loyalty = clamp(npc.stats.loyalty - 5, 0, 100);
        addNote(npc, state.day, 'Was caught taking money and made to return it.', 'bad');
        // The crew watching learn what happens.
        for (const other of crewList(state)) {
          if (other.id !== npc.id) other.stats.fear = clamp(other.stats.fear + 5, 0, 100);
        }
        gainRespect(state, 4);
        trainAttribute(state, 'intimidation', 1.5);
        addLog(state, `${npc.name} gave back ${money(recovered)}. Everyone heard.`, 'crew');
      } else if (choiceId === 'remove') {
        dismiss(state, npc.id);
        addLog(state, `${npc.name} is out. The money is not coming back.`, 'crew');
      } else {
        // Watching costs you nothing today, which is the trap.
        state.flags['tolerated_skimming'] = (state.flags['tolerated_skimming'] ?? 0) + 1;
        npc.stats.greed = clamp(npc.stats.greed + 8, 0, 100);
        addLog(state, 'You let it run. For now.', 'neutral');
      }
      return;
    }

    case 'informant_scare': {
      if (!npc) return;
      if (choiceId === 'reassure') {
        // Only works if he already thinks something of you.
        const works = npc.stats.respectForBoss + state.player.attributes.leadership * 3 > 55;
        if (works) {
          npc.stats.fear = clamp(npc.stats.fear - 20, 0, 100);
          npc.stats.loyalty = clamp(npc.stats.loyalty + 10, 0, 100);
          addNote(npc, state.day, 'Was steadied when it mattered.', 'good');
          addLog(state, `${npc.name} settled. They believed you.`, 'crew');
        } else {
          npc.stats.fear = clamp(npc.stats.fear + 8, 0, 100);
          addEvidence(state, {
            day: state.day,
            source: 'informant',
            strength: 14,
            npcIds: [npc.id],
            detail: `${npc.name} is frightened and has been approached.`,
          });
          addLog(state, `${npc.name} said the right things. They did not mean them.`, 'crew');
        }
        trainAttribute(state, 'leadership', 1);
      } else if (choiceId === 'pay') {
        if (spend(state, 8_000, 'world')) {
          npc.stats.fear = clamp(npc.stats.fear - 12, 0, 100);
          npc.stats.loyalty = clamp(npc.stats.loyalty + 6, 0, 100);
          npc.stats.greed = clamp(npc.stats.greed + 6, 0, 100);
          addNote(npc, state.day, 'Was paid to stay calm.', 'neutral');
          addLog(state, `${money(8_000)} to ${npc.name}. They are steadier, and they have learned what being frightened is worth.`, 'money');
        } else {
          addLog(state, 'You could not put anything in their hand.', 'failure');
        }
      } else {
        dismiss(state, npc.id);
        addEvidence(state, {
          day: state.day,
          source: 'informant',
          strength: 18,
          npcIds: [npc.id],
          detail: `${npc.name} was cut loose while frightened and already approached.`,
        });
      }
      return;
    }

    case 'crew_dispute': {
      const other = state.npcs[event.data.otherId as string];
      if (!npc || !other) return;
      /*
       * However it is settled, the two of them have now fallen out on the
       * record. This is the difference between an event that prints text and
       * one that changes what the organization is — in a year one of them will
       * still be carrying it, and it will show up in a succession.
       */
      recordTie(state.day, npc, other, 'dispute');
      recordTie(state.day, other, npc, 'dispute');
      if (choiceId === 'side_a' || choiceId === 'side_b') {
        const winner = choiceId === 'side_a' ? npc : other;
        const loser = choiceId === 'side_a' ? other : npc;
        winner.stats.loyalty = clamp(winner.stats.loyalty + 8, 0, 100);
        winner.stats.respectForBoss = clamp(winner.stats.respectForBoss + 6, 0, 100);
        loser.stats.grievance = clamp(loser.stats.grievance + 22, 0, 100);
        loser.stats.loyalty = clamp(loser.stats.loyalty - 10, 0, 100);
        addNote(winner, state.day, 'You backed them in a dispute.', 'good');
        addNote(loser, state.day, 'You backed the other man.', 'bad');
        addLog(state, `You came down on ${winner.name}'s side.`, 'crew');
      } else {
        for (const p of [npc, other]) {
          p.stats.fear = clamp(p.stats.fear + 10, 0, 100);
          p.stats.grievance = clamp(p.stats.grievance + 6, 0, 100);
          addNote(p, state.day, 'Was shut down over a dispute.', 'neutral');
        }
        gainRespect(state, 2);
        trainAttribute(state, 'intimidation', 1);
        addLog(state, 'You put an end to it. Neither of them enjoyed that.', 'crew');
      }
      return;
    }

    // ------------------------------------------------------ law pressure --
    case 'police_sweep': {
      if (choiceId === 'lay_low') {
        startLayLow(state);
      } else if (choiceId === 'lawyer') {
        if (spend(state, 25_000, 'world')) {
          reduceHeat(state, 14, 'street');
          trainAttribute(state, 'influence', 1.5);
          addLog(state, 'The lawyer earned it. Attention moved elsewhere.', 'heat');
        } else {
          addLog(state, 'You could not afford anyone worth having.', 'failure');
          addHeat(state, 5, 'money', 'no representation');
        }
      } else {
        addHeat(state, 8, 'street', 'carried on through a sweep');
        addEvidence(state, {
          day: state.day,
          source: 'operation',
          strength: 12,
          npcIds: [],
          detail: 'The organization kept working through an active sweep.',
        });
      }
      return;
    }

    case 'arrest_pressure': {
      if (!npc) return;
      // He can only go once. `applies` already skips him, but a man who has
      // already signed must not be able to sign again through a queued page.
      if (state.flags[`broke_${npc.id}`]) return;
      const pressed = `pressed_${npc.id}`;
      const times = state.flags[pressed] ?? 0;

      if (choiceId === 'lawyer') {
        if (spend(state, 20_000, 'world')) {
          npc.stats.loyalty = clamp(npc.stats.loyalty + 14, 0, 100);
          npc.stats.fear = clamp(npc.stats.fear - 15, 0, 100);
          addNote(npc, state.day, 'You put a real lawyer on their case.', 'good');
          // Counsel is what the hint promises: it ends the matter rather than
          // deferring it, which is what makes it worth three times the price.
          state.flags[`broke_${npc.id}`] = 0;
          state.flags[pressed] = 0;
          addLog(state, `${npc.name} has stopped answering questions. They will not get another run at them.`, 'success');
        } else {
          addLog(state, 'You could not cover it.', 'failure');
        }
      } else if (choiceId === 'family') {
        if (spend(state, 6_000, 'world')) {
          npc.stats.loyalty = clamp(npc.stats.loyalty + 8, 0, 100);
          addNote(npc, state.day, 'Their family was looked after while they were inside.', 'good');
          state.flags[pressed] = Math.max(0, times - 1);
          addLog(state, `Word reached ${npc.name} that their people are being looked after.`, 'crew');
        } else {
          addLog(state, 'You could not cover it.', 'failure');
        }
      } else if (times >= 2) {
        // Third time asked, third time left. He goes.
        npc.stats.loyalty = 0;
        npc.stats.grievance = 100;
        state.flags[`broke_${npc.id}`] = 1;
        addNote(npc, state.day, 'Asked three times whether anybody was coming. Nobody was.', 'bad');
        addEvidence(state, {
          day: state.day,
          source: 'informant',
          strength: 45,
          npcIds: [npc.id],
          detail: `${npc.name} has started talking, and they were there for most of it.`,
        });
        addLog(state, `${npc.name} signed. Whatever they know, they have.`, 'failure');
      } else {
        state.flags[pressed] = times + 1;
        npc.stats.loyalty = clamp(npc.stats.loyalty - 18, 0, 100);
        npc.stats.grievance = clamp(npc.stats.grievance + 25, 0, 100);
        addNote(npc, state.day, 'Was left alone with it.', 'bad');
        addEvidence(state, {
          day: state.day,
          source: 'informant',
          strength: 20 + times * 8,
          npcIds: [npc.id],
          detail: `${npc.name} was left unsupported under questioning.`,
        });
        // Said out loud, because the cost of ignoring this was always real and
        // never visible — which is what made it read as a choice that did not
        // matter.
        addLog(
          state,
          times === 0
            ? `${npc.name} was left to it. They will remember that, and so will they.`
            : `${npc.name} was left to it a second time. They are nearly gone.`,
          'failure',
        );
      }
      return;
    }

    // ------------------------------------------------------- opportunity --
    case 'opportunity_score': {
      const cost = event.data.cost as number;
      const reward = event.data.reward as number;
      const heat = event.data.heat as number;

      if (choiceId === 'send') {
        const free = freeCrew(state);
        if (free.length < SHORT_NOTICE.crewNeeded) {
          addLog(state, 'There was nobody free to send, so it went to somebody else.', 'failure');
          return;
        }
        const sent = free.slice(0, SHORT_NOTICE.crewNeeded);
        const names = sent.map((n) => n.name).join(' and ');
        const odds =
          0.5 + state.player.attributes.streetSmarts * 0.012 - SHORT_NOTICE.oddsPenalty;

        if (rng.chance(odds)) {
          const paid = Math.round(reward * SHORT_NOTICE.rewardShare);
          earnDirty(state, paid);
          addHeat(state, heat * 0.6, 'street', 'short-notice job');
          gainRespect(state, 3);
          for (const npc of sent) {
            creditOperation(npc, state.day, true, 'a short-notice job');
            addNote(npc, state.day, 'Went out on nothing but your word, and it worked.', 'good');
          }
          addLog(state, `${names} went instead of the money. It paid ${money(paid)}.`, 'success');
          return;
        }

        addHeat(state, heat, 'street', 'short-notice job went wrong');
        addEvidence(state, {
          day: state.day,
          source: 'operation',
          strength: 15,
          npcIds: sent.map((n) => n.id),
          detail: 'An unplanned job went wrong and left a great deal behind.',
        });
        // The price, paid by the man who was standing closest to it.
        const hurt = sent[0];
        hurt.status = 'injured';
        hurt.unavailableUntilDay = state.day + SHORT_NOTICE.hurtDays;
        for (const npc of sent) {
          creditOperation(npc, state.day, false, 'a short-notice job');
          addNote(
            npc,
            state.day,
            npc === hurt
              ? 'Was hurt on something nobody had planned properly.'
              : 'Was sent out on something nobody had planned properly.',
            'bad',
          );
        }
        addLog(
          state,
          `It fell apart with ${names} standing in it. ${hurt.name} took the worst of it.`,
          'failure',
        );
        return;
      }

      if (choiceId !== 'take') return;
      if (!spend(state, cost, 'world')) {
        addLog(state, 'The money was not there when it came to it.', 'failure');
        return;
      }
      // Deliberately close to a coin flip — street smarts tilt it slightly.
      const staked = 0.5 + state.player.attributes.streetSmarts * 0.012;
      if (rng.chance(staked)) {
        earnDirty(state, reward);
        addHeat(state, heat * 0.6, 'street', 'short-notice job');
        gainRespect(state, 5);
        trainAttribute(state, 'streetSmarts', 1.5);
        addLog(state, `The short-notice job paid ${money(reward)}.`, 'success');
      } else {
        addHeat(state, heat, 'street', 'short-notice job went wrong');
        addEvidence(state, {
          day: state.day,
          source: 'operation',
          strength: 15,
          npcIds: [],
          detail: 'An unplanned job went wrong and left a great deal behind.',
        });
        addLog(state, `It fell apart. ${money(cost)} gone and plenty of noise.`, 'failure');
      }
      return;
    }

    case 'recruit_offer': {
      if (choiceId !== 'take') return;
      const fee = event.data.fee as number;
      if (!spend(state, fee, 'world')) {
        addLog(state, 'You could not cover the fee.', 'failure');
        return;
      }
      const hire = generateNpc(state, rng, 'soldier');
      // Experienced: better than a street pickup, with a past attached.
      hire.stats.skill = clamp(hire.stats.skill + 20, 0, 100);
      hire.stats.discipline = clamp(hire.stats.discipline + 10, 0, 100);
      hire.stats.loyalty = clamp(hire.stats.loyalty - 12, 0, 100);
      hire.joinedDay = state.day;
      state.npcs[hire.id] = hire;
      addNote(hire, state.day, 'Came in through an introduction. Has history elsewhere.', 'neutral');
      addLog(state, `${hire.name} is with you. They came from somewhere.`, 'crew');
      return;
    }

    case 'respect_challenge': {
      /*
         The counter that makes this a thread rather than a repeat.

         Answering it — either way — settles the matter and resets. Letting it
         go advances it, and the next one arrives further along with a heavier
         page and a blunter hint. Three is the ceiling: by then the men who
         work for you are the ones standing in the room saying nothing, which
         is as far as this needs to go.
      */
      const ignored = state.flags['let_it_go'] ?? 0;

      if (choiceId === 'violence') {
        // Answering a challenge in public is the cleanest fear there is, and
        // it is also the reason the neighbourhood stops talking to you.
        gainFear(state, FEAR.fromViolence);
        gainRespect(state, 12);
        addHeat(state, 9, 'street', 'a public answer');
        for (const c of crewList(state)) c.stats.fear = clamp(c.stats.fear + 4, 0, 100);
        trainAttribute(state, 'intimidation', 2);
        addEvidence(state, {
          day: state.day,
          source: 'violence',
          strength: 12,
          npcIds: [],
          detail: 'A public act of violence tied to the organization.',
        });
        state.flags['let_it_go'] = 0;
        addLog(state, 'It was answered. Publicly.', 'heat');
      } else if (choiceId === 'talk') {
        const works = state.player.attributes.negotiation >= 5;
        if (works) {
          gainRespect(state, 7);
          trainAttribute(state, 'negotiation', 2);
          state.flags['let_it_go'] = 0;
          addLog(state, 'It was handled without anyone raising their voice.', 'success');
        } else {
          gainRespect(state, -4);
          trainAttribute(state, 'negotiation', 1);
          addLog(state, 'You spoke to them. It did not land the way you wanted.', 'neutral');
        }
      } else {
        /*
           Escalating, and it costs more each time.

           A flat penalty is what made three of these read as one event printed
           three times. The standing lost doubles by the third, and the crew
           start taking it personally — because by then they have watched it
           happen twice and drawn the obvious conclusion about what standing
           next to you is worth.
        */
        state.flags['let_it_go'] = ignored + 1;
        gainRespect(state, -8 - ignored * 6);
        if (ignored >= 1) {
          for (const c of crewList(state)) {
            c.stats.respectForBoss = clamp(c.stats.respectForBoss - 3 * ignored, 0, 100);
          }
        }
        addLog(
          state,
          ignored === 0
            ? 'You let it go. People noticed that too.'
            : ignored === 1
              ? 'You let it go again. This time your own people were counting.'
              : 'You let it go a third time. Nobody is going to raise it with you again.',
          'neutral',
        );
      }
      return;
    }

    /*
       Kept while the definition above is parked, so re-wiring is one edit
       rather than two. Unreachable until a `partner_offer` def exists again.
    */
    case 'partner_offer': {
      /*
         Re-read rather than carried on the event, because the offer is a
         function of the day it is answered. A player who sits on this for a
         week and earns their way out of the hole in the meantime should not
         be able to sign a deal they no longer qualify for.
      */
      const offer = partnerOffer(state);
      if (choiceId !== 'sign' || !offer) {
        refusePartner(state);
        return;
      }
      takePartner(state, offer);
      return;
    }

    case 'loan_offer': {
      if (choiceId !== 'take') return;
      // He is the Delacroix lender from config/market.ts, met the informal
      // way. The event is a doorway into the credit system, not a second copy
      // of it — the terms, the collection and what he does about a missed week
      // are all the same code the Finances panel uses.
      borrow(state, 'shark', event.data.amount as number);
      return;
    }

    // Indictment is informational — the trial runs on its own clock and the
    // only thing left is whatever you already put in place.
    case 'indictment':
      return;

    /*
     * A family asking you to stop.
     *
     * This memo is raised by the rival decision loop in faction.ts rather than
     * by the catalogue above, and for a long time it was the one event in the
     * game with no case here at all — so both buttons on it did nothing, the
     * war continued, and the same family asked again the following week for as
     * long as the game lasted. Measured at six years and 313 identical offers.
     */
    case 'peace_offer': {
      const factionId = event.data.factionId as FactionId;
      const faction = state.factions[factionId];
      if (!faction) return;

      if (choiceId === 'accept') {
        makePeace(state, 'player', factionId);
        // Ending a war you did not win is not free. The street reads it.
        gainRespect(state, -4);
        return;
      }

      // Refusing is an answer. They stop asking for a while and dig in, which
      // is worse for them and worse for you.
      faction.warWeariness = Math.max(0, faction.warWeariness - DIPLOMACY.refusedPeaceWeariness);
      gainRespect(state, DIPLOMACY.refusedPeaceRespect);
      addLog(
        state,
        `You sent the ${houseShort(state, factionId)} man back without an answer they could use.`,
        'heat',
      );
      return;
    }

    // ----------------------------------------------------- law enforcement --
    case 'plea_offer': {
      if (!npc) return;
      if (choiceId === 'lawyer') {
        if (spend(state, event.data.cost as number)) {
          // Whatever else he thinks of you, he will remember who sent counsel.
          remember(npc, state.day, 'looked_after');
          npc.stats.loyalty = clamp(npc.stats.loyalty + 18, 0, 100);
          npc.stats.fear = clamp(npc.stats.fear - 15, 0, 100);
          addNote(npc, state.day, 'You put real counsel on them when it counted.', 'good');
          addLog(state, `${npc.name} has stopped taking their calls.`, 'success');
        } else {
          addLog(state, 'You could not cover it.', 'failure');
        }
      } else if (choiceId === 'reassure') {
        // Whether this works depends entirely on what he already thinks of you.
        const works = npc.stats.respectForBoss + state.player.attributes.leadership * 3 > 60;
        if (works) {
          npc.stats.loyalty = clamp(npc.stats.loyalty + 10, 0, 100);
          addNote(npc, state.day, 'Heard from you while they were inside.', 'good');
        } else {
          npc.stats.loyalty = clamp(npc.stats.loyalty - 8, 0, 100);
          addEvidence(state, {
            day: state.day,
            source: 'informant',
            strength: 22,
            npcIds: [npc.id],
            detail: `${npc.name} has begun cooperating.`,
          });
          addLog(state, `${npc.name} took the deal.`, 'failure');
        }
        trainAttribute(state, 'leadership', 1);
      } else {
        // Left alone with it, a frightened man does the obvious thing.
        if (npc.stats.loyalty < 40 || npc.stats.fear > 60) {
          addEvidence(state, {
            day: state.day,
            source: 'informant',
            strength: 28,
            npcIds: [npc.id],
            detail: `${npc.name} gave them everything they had.`,
          });
          npc.stats.loyalty = 0;
          addNote(npc, state.day, 'Took their deal.', 'bad');
          addLog(state, `${npc.name} talked. All of it.`, 'failure');
        } else {
          addNote(npc, state.day, 'Refused their deal without being asked to.', 'good');
          addLog(state, `${npc.name} told them nothing. They did not have to.`, 'success');
        }
      }
      return;
    }

    case 'corrupt_approach': {
      if (choiceId !== 'accept') return;
      const agencyId = event.data.agencyId as string;
      const price = event.data.price as number;
      if (!spend(state, price, 'world')) {
        addLog(state, 'You could not cover it.', 'failure');
        return;
      }
      // Below the usual price, and it bypasses the influence requirement —
      // he came to you.
      state.law.contacts[agencyId] = {
        agencyId,
        since: state.day,
        upkeep: Math.round(AGENCY_BY_ID[agencyId].contactCost * CONTACT.upkeepShare),
        burned: false,
      };
      trainAttribute(state, 'influence', 2);
      addLog(
        state,
        `You have somebody inside ${AGENCY_BY_ID[agencyId].shortName} now. They found you.`,
        'crew',
      );
      return;
    }

    // ------------------------------------------------------------- rivals --
    case 'ally_calls_it_in': {
      const faction = state.factions[event.data.factionId as string];
      if (!faction) return;
      const name = houseShort(state, faction.id);

      if (choiceId === 'send') {
        const going = rng.sample(
          crewList(state).filter((n) => n.status === 'active'),
          event.data.send as number,
        );
        for (const npc of going) {
          // Busy, not injured — they are away, and what happens to them there
          // happens when they get back or does not happen at all.
          npc.status = 'busy';
          npc.unavailableUntilDay = state.day + rng.int(14, 28);
          if (rng.chance(0.35)) {
            npc.status = 'injured';
            npc.stats.fear = clamp(npc.stats.fear + 10, 0, 100);
            addNote(npc, state.day, `Hurt fighting somebody else's war for the ${name}.`, 'bad');
          } else {
            addNote(npc, state.day, `Went out for the ${name} and came back.`, 'neutral');
          }
        }
        adjustRelationship(state, 'player', faction.id, 18);
        gainRespect(state, 8);
        addLog(
          state,
          `You sent ${going.length} to the ${name}. They will remember that.`,
          'crew',
        );
      } else if (choiceId === 'money') {
        if (!spend(state, 40_000, 'world')) {
          addLog(state, 'You could not put anything behind it.', 'failure');
          return;
        }
        // Money is a real answer, and everybody involved knows it is the
        // cheaper one.
        faction.wealth += 40_000;
        adjustRelationship(state, 'player', faction.id, 8);
        addLog(state, `You sent the ${name} money rather than men.`, 'money');
      } else {
        /*
         * Refusing an ally who asked is not an insult. It is a demonstration
         * that the arrangement is worth nothing, which is a different thing
         * and a worse one — it costs trust rather than goodwill, so the
         * alliance may simply stop being one while they still quite like you.
         */
        adjustBond(state, 'player', faction.id, { trust: BOND.letDownTrust, grudge: 8 });
        gainRespect(state, -5);
        addLog(state, `You told the ${name} no. That is now on the books.`, 'neutral');
      }
      return;
    }

    case 'rival_incursion': {
      const faction = state.factions[event.data.factionId as string];
      const territoryId = event.data.territoryId as string;
      const where = territoryDef(territoryId).name;
      if (!faction) return;

      if (choiceId === 'push_back') {
        if (!spend(state, event.data.cost as number)) {
          addLog(state, 'You could not put anything behind it.', 'failure');
          return;
        }
        // Taking ground back off somebody is exactly as loud as it sounds.
        addInfluence(state, territoryId, 6);
        const t = state.territories[territoryId];
        t.influence[faction.id] = clamp((t.influence[faction.id] ?? 0) - 5, 0, 100);
        adjustRelationship(state, faction.id, 'player', -12);
        addHeat(state, 8, 'street', `a dispute in ${where}`);
        gainRespect(state, 6);
        trainAttribute(state, 'intimidation', 1.5);
        addEvidence(state, {
          day: state.day,
          source: 'violence',
          strength: 13,
          npcIds: [],
          detail: `A territorial dispute in ${where} between two organizations.`,
        });
        addLog(state, `You took ${where} back. They will not forget it.`, 'heat');
      } else if (choiceId === 'concede') {
        addInfluence(state, territoryId, -5);
        // Backing off genuinely does cool things down.
        adjustRelationship(state, faction.id, 'player', 10);
        gainRespect(state, -4);
        addLog(state, `You gave ${where} up rather than fight for it.`, 'neutral');
      } else {
        // Doing nothing is the worst of both: they keep coming and you look weak.
        adjustRelationship(state, faction.id, 'player', -4);
        gainRespect(state, -6);
        addLog(state, `You let it stand. Everybody in ${where} noticed.`, 'neutral');
      }
      return;
    }

    case 'rival_overture': {
      const faction = state.factions[event.data.factionId as string];
      if (!faction) return;

      if (choiceId === 'accept') {
        if (spend(state, event.data.tribute as number)) {
          adjustRelationship(state, faction.id, 'player', 25);
          trainAttribute(state, 'negotiation', 2);
          addLog(
            state,
            `${houseShort(state, faction.id)} consider you somebody they can deal with.`,
            'crew',
          );
        } else {
          addLog(state, 'You could not cover the courtesy.', 'failure');
        }
      } else if (choiceId === 'insult') {
        adjustRelationship(state, faction.id, 'player', -30);
        gainRespect(state, 5);
        addLog(
          state,
          `You sent them back empty-handed. That will come around.`,
          'neutral',
        );
      }
      return;
    }

    // ---------------------------------------------------------- territory --
    case 'shakedown_demand': {
      const territoryId = event.data.territoryId as string;
      const demand = event.data.demand as number;
      const where = territoryDef(territoryId).name;

      if (choiceId === 'pay') {
        if (spend(state, demand, 'world')) {
          // Paying is quiet, and quietly costs you the district's respect.
          addInfluence(state, territoryId, -2);
          addLog(state, `You paid to keep working ${where}. People heard that too.`, 'money');
        } else {
          addLog(state, 'You did not have it.', 'failure');
        }
      } else if (choiceId === 'refuse') {
        addInfluence(state, territoryId, -4);
        gainRespect(state, -3);
        addLog(state, `You told them no and did nothing about them. ${where} noticed.`, 'neutral');
      } else {
        addInfluence(state, territoryId, 5);
        gainRespect(state, 8);
        addHeat(state, 7, 'street', `violence in ${where}`);
        adjustSentiment(state, territoryId, -8);
        trainAttribute(state, 'intimidation', 2);
        addEvidence(state, {
          day: state.day,
          source: 'violence',
          strength: 14,
          npcIds: [],
          detail: `A violent incident in ${where} connected to the organization.`,
        });
        addLog(state, `They are not a problem in ${where} any more.`, 'heat');
      }
      return;
    }

    case 'expansion_opening': {
      if (choiceId !== 'take') return;
      const territoryId = event.data.territoryId as string;
      const cost = event.data.cost as number;
      if (!spend(state, cost, 'world')) {
        addLog(state, 'You could not cover it.', 'failure');
        return;
      }
      // Enough to count as presence, which is the hard part of starting.
      addInfluence(state, territoryId, 12);
      trainAttribute(state, 'negotiation', 1.5);
      addLog(
        state,
        `You have a name in ${territoryDef(territoryId).name} now. A small one.`,
        'crew',
      );
      return;
    }

    case 'community_friction': {
      const territoryId = event.data.territoryId as string;
      if (choiceId === 'money') {
        if (spend(state, 12_000, 'world')) {
          adjustSentiment(state, territoryId, 30);
          addInfluence(state, territoryId, 2);
          addLog(state, `${territoryDef(territoryId).name} has warmed to you again.`, 'money');
        } else {
          addLog(state, 'You could not put anything behind it.', 'failure');
        }
      } else if (choiceId === 'presence') {
        /*
           Being there yourself works, if you can be seen without being watched.

           Scaled by leadership, and now by how much attention you are under.
           `balance > lets careful play build a bigger organization` inverted
           the moment the money option was correctly guarded: a broke boss used
           to pick it, fail silently and leave the district hostile, and with
           the guard he falls through to this one instead — which is free and
           actually works. So fixing a bug handed the reckless player a working
           repair for the districts only reckless play wrecks.

           A boss with a task force on him cannot walk a neighbourhood shaking
           hands, and that is the honest reason as well as the balancing one.
           Quiet is a thing careful play has and grinding does not.
        */
        const watched = clamp(state.org.heat / 100, 0, 1);
        const effect = (8 + state.player.attributes.leadership * 1.5) * (1 - watched * 0.8);
        adjustSentiment(state, territoryId, effect);
        trainAttribute(state, 'leadership', 1.5);
        addLog(state, `You spent time in ${territoryDef(territoryId).name}. It helped.`, 'crew');
      } else {
        adjustSentiment(state, territoryId, -5);
      }
      return;
    }

    // --------------------------------------------------------- businesses --
    case 'business_trouble': {
      const business = state.businesses[event.data.businessId as string];
      if (!business) return;

      if (choiceId === 'accountant') {
        if (spend(state, 15_000, 'world')) {
          business.exposure = clamp(business.exposure - 45, 0, 100);
          trainAttribute(state, 'business', 2);
          addLog(state, 'The books are somebody else’s problem now, and they are clean.', 'money');
        } else {
          addLog(state, 'You could not afford anyone good enough.', 'failure');
          addHeat(state, 4, 'money', 'unanswered financial questions');
        }
      } else if (choiceId === 'slow') {
        business.exposure = clamp(business.exposure - 20, 0, 100);
        // Marked so the player understands why throughput dropped.
        addLog(
          state,
          `${businessDef(business).name} is running quiet for a while. Less goes through it.`,
          'neutral',
        );
      } else {
        shutterBusiness(state, business.id);
      }
      return;
    }

    case 'business_offer': {
      if (choiceId !== 'buy') return;
      const territoryId = event.data.territoryId as string;
      const price = event.data.price as number;
      const paid = spendSplit(state, price, 'world');
      if (!paid) {
        addLog(state, 'You could not cover it.', 'failure');
        return;
      }
      // Priced below market, so it bypasses the usual acquisition cost.
      const bought = acquireBusiness(state, 'laundromat', territoryId);
      if (!bought) {
        /*
           The last line of defence, and it should now be unreachable.

           The offer is built with `canAcquire` checked, so the only way here is
           the world changing between the memo landing on the desk and the
           player answering it — a district lost, a front bought elsewhere in
           the meantime. Rare, real, and no longer the normal case.

           Refunded in the money it was paid in: returning clean cash as dirty
           is a silent penalty on the one balance rank progression is gated on.
           And it now says *why*, because "it fell through" with no reason is
           what made this read as a bug rather than a misfortune.
        */
        refund(state, paid);
        const why = canAcquire(state, 'laundromat', territoryId).reason;
        addLog(
          state,
          `The sale fell through before it closed. ${why ?? 'Somebody else got there first.'} Your ${money(price)} came back.`,
          'neutral',
        );
      }
      return;
    }

    case 'loyalty_gesture': {
      if (!npc) return;
      if (choiceId === 'reward') {
        // Choosing to pay and not being able to used to fall silently through
        // to the free outcome, so the player was told nothing and got the
        // lesser thing while believing they had bought the greater one.
        if (spend(state, 5_000, 'world')) {
          npc.stats.loyalty = clamp(npc.stats.loyalty + 6, 0, 100);
          npc.stats.greed = clamp(npc.stats.greed + 2, 0, 100);
          addLog(state, `${money(5_000)} to ${npc.name} for what they did. It was noticed.`, 'money');
        } else {
          addLog(state, `You had nothing to put behind it. ${npc.name} got the words.`, 'failure');
        }
      }
      npc.stats.loyalty = clamp(npc.stats.loyalty + 4, 0, 100);
      npc.stats.respectForBoss = clamp(npc.stats.respectForBoss + 6, 0, 100);
      addNote(npc, state.day, 'You acknowledged what they did.', 'good');
      trainAttribute(state, 'leadership', 1);
      return;
    }

    default:
      return;
  }
}

export const EVENT_DEF_IDS = Object.keys(EVENT_DEF_BY_ID);
