/**
 * The sit-down: a conversation you act through.
 *
 * Hidden stats are the most distinctive thing in this game and until now the
 * player only ever *read* them. You opened the crew sheet, saw "seems loyal"
 * and "thinks he is worth more", and went back to allocating bodies. Three
 * rounds of playtesting landed on the same verdict — every decision in the
 * game, from the first day to the last, is the same three-field form: what
 * job, which district, which people. New ranks added new numbers, never a new
 * kind of decision.
 *
 * This is the second verb, and it is deliberately not allocation. It is
 * inference under uncertainty. You choose a register — press him, offer him
 * something, listen, tell him the truth — against a perception of a man that
 * is noisy and banded, and the register lands or does not land against the
 * numbers underneath, which you never see.
 *
 * Three rules hold it together, and every one of them exists to stop a
 * specific failure:
 *
 * 1. **Registers unlock from what he says.** Pressing a man three times gets
 *    three generic refusals. Listening once can reveal what he is actually
 *    carrying, and *that* is what puts the move that works on the table. This
 *    is the difference between a mechanic and a menu of four buttons.
 *
 * 2. **A miss still teaches you who he is.** Familiarity rises whatever
 *    happens, so a badly-read sit-down is expensive rather than wasted. Without
 *    this the correct play is to never sit down with anyone you cannot already
 *    read, which is exactly backwards.
 *
 * 3. **Nothing here is a number on screen.** Reactions are prose. The player
 *    infers that it went badly because he looked at the table, not because
 *    something said minus twelve.
 *
 * Balance lives here. The sim reads this file and decides nothing on its own.
 */

import type { NpcStatId } from '../sim/types';
import type { PromiseKind } from './promises';

// ------------------------------------------------------------- questions ---

/**
 * Something he wants from you, put as a question.
 *
 * Deliberately thin: an id and the line he says. The weight is in the answers,
 * which are ordinary registers and are read against his true stats exactly
 * like anything else you could say. A question is not a puzzle with a correct
 * solution — it is the same inference under uncertainty, with the list of
 * things you may say narrowed by what he just asked.
 */
export interface QuestionDef {
  id: string;
  /** What he says, after the reply prose. */
  text: string;
}

export const QUESTIONS: QuestionDef[] = [
  {
    id: 'q_about_it',
    text: 'So what are you going to do about it?',
  },
  {
    id: 'q_still_want',
    text: 'And do you still want me here? Say it either way.',
  },
];

export const QUESTION_BY_ID: Record<string, QuestionDef> = Object.fromEntries(
  QUESTIONS.map((q) => [q.id, q]),
);

// ------------------------------------------------------------- registers ---

/**
 * What a register is testing for. `high` lands when the true stat is above the
 * threshold, `low` when it is below — a frightened man answers reassurance,
 * a fearless one does not.
 */
export type Wants = 'high' | 'low';

export interface RegisterDef {
  id: string;
  label: string;
  /** The line under the label. Says what it costs or risks, never the odds. */
  hint: string;
  /** The hidden stat that decides whether this lands. */
  against: NpcStatId;
  wants: Wants;
  /** True stat must clear this for the register to land. */
  threshold: number;
  /** Money it costs to say out loud. Charged whether or not it lands. */
  cost?: number;
  /**
   * Only offered once this tag has been revealed in this sit-down. A register
   * with no `needs` is available from the first beat.
   */
  needs?: string;
  /** Revealed when it lands, unlocking whatever needs it. */
  reveals?: string;
  /**
   * What you actually say, so the room reads as talk rather than as a list of
   * moves and results.
   *
   * The `landed`/`missed` prose below is *his* half — narration of what came
   * back. Before this there was no player half at all: the modal printed the
   * register's label above the response, so what a boss read was a menu
   * choice and its outcome, never an exchange.
   *
   * Exactly one of `says` and `does` on every register. Some moves are words
   * and some are not — `listen` is the whole point of the mechanic and has no
   * line, so it gets a stage direction instead.
   */
  says?: string;
  /** For the moves that are not speech. Rendered as action, not dialogue. */
  does?: string;
  /**
   * A question he puts to you when this lands.
   *
   * The other half of making this an exchange. Every beat used to be you
   * acting on him — you chose, he reacted, you chose again — so there was
   * never a moment where your next move was a *reply* rather than a free pick
   * from a list. While a question stands, the only things on the table are
   * answers to it.
   *
   * Only on a landing. A move that missed did not get far enough for him to
   * want anything from you.
   */
  asks?: string;
  /**
   * Marks this register as an answer to that question, and nothing else.
   *
   * Answers are never offered on an open table — see `availableRegisters`.
   * They exist only for as long as the question does.
   */
  answers?: string;
  /** Prose for the two outcomes. */
  landed: string;
  missed: string;
  /** Attribute exercised by using it, whether or not it works. */
  trains: 'leadership' | 'negotiation' | 'intimidation' | 'intelligence';
  /**
   * A stat this actually puts down when it lands.
   *
   * Added because `reassure` did not. It reads "tell them they are covered",
   * its landed line says "some of it goes out of their shoulders", and it
   * reduced *grievance* — because it reveals `settled` like every other
   * closing register, and settling is written in terms of a grudge. A
   * frightened man is not an aggrieved one, so the register was answering the
   * wrong question and the prose was writing a cheque the code did not honour.
   *
   * That mattered more than one register usually would. Measurement put
   * heat-fear at -1.16 loyalty per crew-week, the second largest force pulling
   * a crew apart, and it was the only pressure in the game with no answer at
   * all: heat has laying low and distance, a grudge has this conversation,
   * being broke has the job board. Being frightened had nothing.
   */
  calms?: NpcStatId;
  /**
   * What you have committed yourself to by saying it, if anything.
   *
   * Declared here rather than handled in the outcome code, because a register
   * is where the words are and the words are the promise. Two of them make one;
   * the machine never has to know which.
   */
  promises?: PromiseKind;
}

/**
 * The four openers, available in every crew sit-down.
 *
 * Their thresholds straddle the middle of each stat deliberately. A register
 * that lands on almost everybody is not a read, it is a button.
 */
export const CREW_REGISTERS: RegisterDef[] = [
  {
    id: 'press',
    says:
      '“I have been patient about this. I would rather not stop being patient.”',
    label: 'Press them',
    hint: 'Lean on it. Works on a man who is already worried',
    against: 'fear',
    wants: 'high',
    threshold: 55,
    reveals: 'afraid',
    landed:
      'They give it up faster than they mean to. Whatever else is true, they do not want to be on the wrong side of you.',
    missed:
      'They look at the table and wait you out. Whatever you just leaned on, it is not the thing holding them.',
    trains: 'intimidation',
  },
  {
    id: 'offer',
    says:
      '“There is money in this for you. Tell me what it would take.”',
    label: 'Offer them something',
    hint: 'Money answers some men and insults others',
    against: 'greed',
    wants: 'high',
    threshold: 50,
    cost: 4_000,
    reveals: 'bought',
    landed:
      'They do not count it in front of you, which is manners, and they do not put it away either, which is an answer.',
    missed:
      'They leave it where you put it. When they finally speak it is about something else entirely, and colder.',
    trains: 'negotiation',
  },
  {
    id: 'listen',
    does:
      'You let the silence sit, and do not fill it.',
    label: 'Just listen',
    hint: 'Slow. They may say nothing at all',
    against: 'grievance',
    wants: 'high',
    threshold: 30,
    reveals: 'grievance',
    landed:
      'It takes them a while to start. When it comes out it is not about money at all — it is about a job, and who you sent instead of them.',
    missed:
      'The silence goes on long enough to be its own answer. They have nothing they want to hand you tonight.',
    trains: 'leadership',
  },
  {
    id: 'level',
    asks: 'q_still_want',
    says:
      '“I am going to tell you how it actually is, and you are not going to enjoy it.”',
    label: 'Level with them',
    hint: 'The truth. They may not like it',
    against: 'respectForBoss',
    wants: 'high',
    threshold: 45,
    reveals: 'straight',
    landed:
      'They hear it out without moving. At the end of it they nod once, and it is not agreement so much as the thing being settled.',
    missed:
      'You watch them decide not to believe you. They are polite about it, which is worse.',
    trains: 'leadership',
  },

  // -- unlocked ----------------------------------------------------------
  {
    id: 'name_it',
    /*
       He asks here rather than after `listen`, and the difference is both
       dramatic and mechanical.

       Listening is him telling you what is wrong. Naming it is you saying it
       out loud. "So what are you going to do about it?" belongs after the
       second, not between them — asked earlier it interrupts the beat that
       matters, and it also inserts a mandatory exchange into the shortest path
       this whole mechanic has, which the first attempt at this did.
    */
    asks: 'q_about_it',
    says:
      '“This is about the job. About who I sent instead of you.”',
    label: 'Name what they are carrying',
    hint: 'Say the thing out loud. Only works once you know what it is',
    against: 'grievance',
    wants: 'high',
    threshold: 20,
    needs: 'grievance',
    reveals: 'settled',
    landed:
      'Naming it takes the weight out of it. They do not thank you and they do not need to — it is off the table now, and both of you heard it go.',
    missed:
      'You name it and they shrug it off, and the shrug is a lie you can both see. It is still there.',
    trains: 'leadership',
  },
  {
    id: 'promise',
    says:
      '“The next one is yours. You have my word on it, in this room.”',
    label: 'Give them the next one',
    hint: 'Name them on the next job. You would have to mean it',
    against: 'ambition',
    wants: 'high',
    threshold: 45,
    needs: 'grievance',
    reveals: 'owed',
    promises: 'next_job',
    landed:
      'That lands harder than money would have. They sit differently for the rest of it.',
    missed:
      'They say the right thing. They do not believe you will remember, and they are not sure they want it anyway.',
    trains: 'leadership',
  },
  {
    id: 'reassure',
    says:
      '“Nothing is coming for you. Not while you are mine.”',
    label: 'Tell them they are covered',
    hint: 'For a man who is frightened rather than owed',
    against: 'fear',
    wants: 'high',
    threshold: 40,
    needs: 'afraid',
    reveals: 'settled',
    promises: 'covered',
    calms: 'fear',
    landed:
      'Some of it goes out of their shoulders. They have been carrying the idea that nobody would come, and now they are not.',
    missed:
      'They say they know. They do not know, and saying it has not made them know.',
    trains: 'leadership',
  },
  {
    id: 'ask_about',
    says:
      '“And the others. What do you make of them, honestly?”',
    label: 'Ask what they make of the others',
    hint: 'They will only talk about people if they trust you in the room',
    against: 'loyalty',
    wants: 'high',
    threshold: 50,
    needs: 'straight',
    reveals: 'talked',
    landed:
      'They are careful with it, and then they are not. By the end you have a much better picture of who in your crew actually likes whom.',
    missed:
      'They say everyone is fine. Everyone is not fine and they are not going to be the one who tells you.',
    trains: 'intelligence',
  },
  {
    id: 'test_him',
    says:
      '“I hear you have been asked to sit down with somebody else.”',
    label: 'Put a lie in front of them',
    hint: 'Say something untrue and watch. Costs nothing but trust',
    against: 'discipline',
    wants: 'low',
    threshold: 55,
    reveals: 'tested',
    landed:
      'They correct you a beat too fast, and in correcting you they say more than they meant to about what they already knew.',
    missed:
      'They let it stand. Either they did not notice, or they are a great deal better at this than you were counting on.',
    trains: 'intelligence',
  },
];

/**
 * Rivals. Same machine, different content: you are reading a house's posture
 * rather than a man's stats, and the outcome moves a bond rather than loyalty.
 *
 * The stat names are reused because a rival boss is an NPC — the leader of the
 * family — so this reads their leader exactly as it reads your own people.
 */
/**
 * The things you can say when he has asked you something.
 *
 * Ordinary registers in every respect — read against his true stats, train an
 * attribute, land or miss — except that they are gated to one question and
 * never appear on an open table. Two apiece, and neither is the right one:
 * the honest answer and the useful answer are different answers, which is the
 * same trade the rest of this mechanic is built on.
 */
export const ANSWER_REGISTERS: RegisterDef[] = [
  {
    id: 'a_fix_it',
    answers: 'q_about_it',
    label: 'Tell them you will fix it',
    hint: 'A commitment, out loud, in front of them',
    says:
      '“I am going to put it right. Not today, but I am going to put it right.”',
    against: 'respectForBoss',
    wants: 'high',
    threshold: 40,
    calms: 'grievance',
    landed:
      'They take a breath they had been holding for a while. It is not gratitude — it is somebody deciding to believe you one more time.',
    missed:
      'They have heard this before, from you or from somebody who sounded like you. Nothing in their face moves.',
    trains: 'leadership',
  },
  {
    id: 'a_thats_the_job',
    answers: 'q_about_it',
    label: 'Tell them that is the job',
    hint: 'No comfort. Some men would rather have the truth',
    says: '“Nothing. That is the work. You knew that when you took it.”',
    against: 'courage',
    wants: 'high',
    threshold: 45,
    landed:
      'They almost laugh. Whatever else they wanted, they did not want to be handled, and you did not handle them.',
    missed:
      'Something closes. They wanted one sentence that was not about the work, and that was not it.',
    trains: 'intimidation',
  },
  {
    id: 'a_you_stay',
    answers: 'q_still_want',
    label: 'Say it plainly',
    hint: 'Yes, and no hedging on it',
    says: '“Yes. You are mine and you stay mine. That is the end of it.”',
    against: 'loyalty',
    wants: 'high',
    threshold: 35,
    landed:
      'They nod once, and sit differently afterwards. It was a real question and it got a real answer.',
    missed:
      'They accept it the way somebody accepts a thing they intend to test later.',
    trains: 'leadership',
  },
  {
    id: 'a_depends',
    answers: 'q_still_want',
    label: 'Tell them it depends on them',
    hint: 'Honest. Also a warning, and they will hear both',
    says: '“That is going to depend on you. I think you know how.”',
    against: 'ambition',
    wants: 'high',
    threshold: 45,
    landed:
      'They hear the condition and take it as an opening rather than a threat. Somebody who wants something can be given something to want.',
    missed:
      'They wanted an answer and got terms. Whatever they came in carrying, they are still carrying it.',
    trains: 'negotiation',
  },
];

export const RIVAL_REGISTERS: RegisterDef[] = [
  {
    id: 'sound_out',
    says:
      '“It has been a quiet season. Long may it hold.”',
    label: 'Sound them out',
    hint: 'Say nothing worth repeating and see what comes back',
    against: 'discipline',
    wants: 'low',
    threshold: 55,
    reveals: 'loose',
    landed:
      'They talk more than they need to. None of it is a secret and all of it is a shape you did not have before.',
    missed:
      'They are pleasant for twenty minutes and you leave with exactly what you walked in with.',
    trains: 'negotiation',
  },
  {
    id: 'complain',
    says:
      '“Your people came through my streets. You know they did.”',
    label: 'Put your grievance on the table',
    hint: 'Say what they did. It may be news to them',
    against: 'respectForBoss',
    wants: 'high',
    threshold: 40,
    reveals: 'aired',
    landed:
      'They hear it properly, which is not the same as agreeing. Whatever else, it is now a thing between the two of you rather than a thing you are carrying alone.',
    missed:
      'They smile through it. You are being handled and both of you know it.',
    trains: 'negotiation',
  },
  {
    id: 'threaten',
    says:
      '“Think about what you have that I could reach, and then think again.”',
    label: 'Tell them what happens otherwise',
    hint: 'Only lands on a man with something to lose',
    against: 'fear',
    wants: 'high',
    threshold: 45,
    reveals: 'warned',
    landed:
      'The room changes temperature. They do not answer it, and not answering it is the answer.',
    missed:
      'They let the silence sit and then ask after your family. It is not a threat. It is worse than a threat.',
    trains: 'intimidation',
  },
  {
    id: 'terms',
    says:
      '“Here is what I am proposing, and I am proposing it once.”',
    label: 'Put terms in front of them',
    hint: 'A real offer, once they are actually listening',
    against: 'greed',
    wants: 'high',
    threshold: 45,
    cost: 20_000,
    needs: 'aired',
    reveals: 'dealt',
    landed:
      'They do not take it and they do not refuse it. What they do is keep talking, which is the whole of what you came for.',
    missed:
      'They turn it over once and put it down. Whatever this house wants, it is not this.',
    trains: 'negotiation',
  },
  {
    id: 'ask_intent',
    says:
      '“Say what you want. Plainly, and we can both go home.”',
    label: 'Ask them straight what they want',
    hint: 'Blunt. They will either answer or they will not',
    against: 'ambition',
    wants: 'high',
    threshold: 50,
    needs: 'loose',
    reveals: 'intent',
    landed:
      'They tell you, more or less. Men who want things badly are usually happy to say so, and what they want is not small.',
    missed:
      'They say they want what everybody wants. It is a good line and they have used it before.',
    trains: 'intelligence',
  },
];

// --------------------------------------------------------------- reasons ---

export type SitdownKind = 'crew' | 'rival';

export interface ReasonDef {
  id: string;
  kind: SitdownKind;
  label: string;
  /** What the header says you came for. */
  blurb: string;
  /**
   * The tag that means you got it. Reaching it is what pays out; the payout
   * itself is decided in sim/sitdown.ts against real state.
   */
  wants: string;
}

export const REASONS: ReasonDef[] = [
  {
    id: 'settle',
    kind: 'crew',
    label: 'Settle what they are carrying',
    blurb: 'They have been difficult for weeks and nobody has asked them why.',
    wants: 'settled',
  },
  {
    id: 'understand',
    kind: 'crew',
    label: 'Find out what they actually want',
    blurb: 'You have had them for years and you could not say what they are after.',
    wants: 'owed',
  },
  {
    id: 'suspect',
    kind: 'crew',
    label: 'Find out whether they are taking',
    blurb: 'The numbers from their end have been wrong twice. It might be nothing.',
    wants: 'tested',
  },
  {
    id: 'room',
    kind: 'crew',
    label: 'Ask them about the others',
    blurb: 'They see more of your crew in a week than you do in a month.',
    wants: 'talked',
  },
  {
    id: 'intentions',
    kind: 'rival',
    label: 'Find out what they are planning',
    blurb: 'Better to hear it across a table than read it in a district you used to hold.',
    wants: 'intent',
  },
  {
    id: 'deal',
    kind: 'rival',
    label: 'See whether there is a deal',
    blurb: 'Everything the two of you are spending on each other could be spent elsewhere.',
    wants: 'dealt',
  },
  {
    id: 'warn',
    kind: 'rival',
    label: 'Tell them to stop',
    blurb: 'Say it once, in a room, before it has to be said any other way.',
    wants: 'warned',
  },
];

export const REASON_BY_ID: Record<string, ReasonDef> = Object.fromEntries(
  REASONS.map((r) => [r.id, r]),
);

export const REGISTER_BY_ID: Record<string, RegisterDef> = Object.fromEntries(
  [...CREW_REGISTERS, ...RIVAL_REGISTERS, ...ANSWER_REGISTERS].map((r) => [r.id, r]),
);

// --------------------------------------------------------------- tuning ---

export const SITDOWN = {
  /**
   * How long he will sit there before he has had enough.
   *
   * **This replaces a fixed three-exchange cap**, and the difference is the
   * whole rework. The cap ended the conversation on the game's schedule, so a
   * boss chose how to spend a budget rather than when to stand up. Walking out
   * early settled and paid, but gave up unspent exchanges for nothing, so it
   * was weakly dominated — not a decision, just quitting early.
   *
   * Patience is a cost you can read and manage instead. Every exchange spends
   * some, a misread spends more, and landing something real buys a little
   * back. You may end it whenever you like and keep everything you have won.
   * Push past this and *he* ends it, which is worse than never having sat
   * down.
   *
   * Sized so a well-read conversation runs longer than the old three and a
   * badly-read one runs shorter. Nothing here is shown as a number — see
   * `patienceRead`.
   */
  patience: 10,

  /** What one exchange costs him, however it goes. */
  patiencePerBeat: 2,

  /**
   * And the extra when you read him wrong.
   *
   * A miss is not merely a wasted turn — it is a man being asked the wrong
   * question by somebody who is supposed to know him, and that is what wears
   * out a room.
   */
  patienceOnMiss: 2,

  /**
   * What landing something real buys back.
   *
   * Deliberately less than `patiencePerBeat`, so even a perfectly read
   * conversation runs down. A boss who never misses gets a longer talk, not an
   * unlimited one, and the decision stays "is there another question worth
   * asking" rather than "have I run out".
   */
  patienceBackOnLanded: 1,

  /** Grievance a man carries out of a room he left on his own. */
  walkedGrievance: 14,
  /** And what it does to how he regards you, which is the durable half. */
  walkedRegard: 10,

  /** Days before you can sit down with the same person again. */
  cooldownDays: 21,

  /**
   * Familiarity gained per exchange, whether or not the register landed.
   *
   * This is the number that stops the whole mechanic collapsing. If a miss
   * bought nothing, the dominant strategy would be to only ever sit down with
   * people you already read well — which is precisely the people a sit-down
   * has nothing left to tell you about.
   */
  familiarityPerBeat: 3,
  /** Extra on top when it lands. Reading someone right teaches you more. */
  familiarityOnLanded: 3,

  /**
   * How far a man's mood shifts the threshold, at maximum grievance.
   *
   * A man carrying a real grudge answers almost nothing until it is named,
   * which is what makes `listen` the correct opener far more often than it
   * looks. Applied against every register except the ones that work *through*
   * the grievance.
   */
  grievanceResistance: 22,

  /** What your standing with him is worth, at maximum regard. */
  regardHelp: 12,

  /** Leadership shifts every threshold by this much at 100. */
  leadershipHelp: 10,

  /** Loyalty a settled grievance is worth, and the grievance it removes. */
  settledLoyalty: 10,
  settledGrievance: 30,

  /**
   * What a register that names the real thing puts down — see `calms`.
   *
   * Smaller than `settledGrievance` on purpose. A grudge can be settled by
   * being heard; being frightened is a reasonable response to a real danger,
   * and telling a man he is covered does not make the danger go away. It takes
   * the edge off and it has to be said again.
   */
  calmed: 18,

  /** A promise made and meant. Costs you if you never deliver — see sim. */
  promiseLoyalty: 8,

  /** Bond movement from a rival sit-down that reached what it came for. */
  rivalTrust: 8,
  rivalRespect: 6,
  /** A warning that landed buys respect and grudge in the same breath. */
  warnGrudge: 4,
} as const;
