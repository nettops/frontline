import { useEffect, useRef, useState } from 'react';
import { useGame, mutate } from '../store';
import { play } from './audio';
import { Rng } from '../sim/rng';
import { resolveEvent } from '../sim/events';
import { totalFunds } from '../sim/economy';
import { formatMoney, formatShortDay } from '../sim/util';
import { crewList } from '../sim/npc';
import { nightsWorked } from '../sim/standing';
import { StatRead, payRead } from './components';
import { ROLE_LABEL } from '../config/economy';
import type { LogEntry } from '../sim/types';

/**
 * The signature moment: an event does not pop up as a dialog, it arrives as a
 * typed page on the desk. This is the only light surface in the game, which is
 * what makes it register as something handed to you rather than rendered.
 */
export default function MemoModal() {
  const state = useGame();
  const event = state.pendingEvents[0] ?? null;
  const choices = useRef<HTMLDivElement>(null);
  /*
     Everybody the memo is asking you to decide about.

     `crew_dispute` is why this is a list. It names two of your people, offers
     "Back X" against "Back Y", and stores the second in `data.otherId` — so a
     single-subject version showed one man's loyalty and skill on the one memo
     where the entire decision is a comparison between two.
  */
  const subjects = [event?.npcId, event?.data?.otherId as string | undefined]
    .filter((id): id is string => !!id)
    .map((id) => crewList(state).find((n) => n.id === id))
    .filter((n): n is NonNullable<typeof n> => !!n);

  /*
     What the last answer actually did.

     Answering used to be silent on the theory that the consequence would make
     its own noise on the next report. That holds for a consequence that takes
     a week to arrive and fails badly for one that resolves under the click:
     buying a business that turns out to be gone, or an option you could not
     actually cover. The money moved, the page closed, and the only account of
     it was a log line the player had no reason to go and read.

     So anything the resolution wrote to the log is handed straight back. It is
     not another thing to dismiss — the next memo can open on top of it, and it
     clears itself.
  */
  const [receipt, setReceipt] = useState<LogEntry[]>([]);

  const answer = (eventId: string, choiceId: string) => {
    mutate((s) => {
      // The log is newest-first and capped, so counting the length is wrong
      // once a long game hits the cap. Find where the old head ended up.
      const previousHead = s.log[0];
      resolveEvent(s, new Rng(s.rng), eventId, choiceId);
      const at = previousHead ? s.log.indexOf(previousHead) : s.log.length;
      setReceipt(s.log.slice(0, at === -1 ? s.log.length : at));
    }, true);
  };

  useEffect(() => {
    if (receipt.length === 0) return;
    const timer = window.setTimeout(() => setReceipt([]), 6000);
    return () => window.clearTimeout(timer);
  }, [receipt]);

  // The page landing is the one sound the memo makes.
  useEffect(() => {
    if (!event) return;
    play('memo');
    // The first *available* choice, not the first one. Options are routinely
    // disabled because you cannot afford them, and focusing one of those puts
    // a keyboard player nowhere.
    choices.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [event]);

  /*
     Why the guard is re-checked here rather than trusted.

     `disabledReason` is decided when the memo is built, and memos queue. A bad
     week's payroll runs underneath one that has been sitting there, so a choice
     the player could afford on Tuesday is still enabled on Friday when they
     cannot. Measured at six cases across eight careers, several inside a
     hundred dollars, and round 10's tester hit the same symptom from the other
     direction — clicked a $6,000 option holding $3,842, and got a dismissed
     modal, no money moved and no line written.

     The stored reason still wins when it is set, because it covers everything
     that is not about money.
  */
  const funds = totalFunds(state);
  const blocked = (choice: { disabledReason?: string; cost?: number }): string | undefined => {
    if (choice.disabledReason) return choice.disabledReason;
    if (choice.cost !== undefined && funds < choice.cost) return `You have ${formatMoney(funds)}`;
    return undefined;
  };

  // Answer by number. Events queue up after a bad week, and clicking through
  // five of them with a mouse is the slowest part of playing this.
  useEffect(() => {
    if (!event) return;
    const onKey = (e: KeyboardEvent) => {
      const choice = event.choices[Number(e.key) - 1];
      if (!choice || blocked(choice)) return;
      e.preventDefault();
      answer(event.id, choice.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [event]);

  const stamp =
    receipt.length > 0 ? (
      <aside className="receipt" role="status" aria-label="What that did">
        {receipt.map((line, i) => (
          <p key={i} className={`receipt-line ${line.kind}`}>
            {line.text}
          </p>
        ))}
      </aside>
    ) : null;

  if (!event) return stamp;

  return (
    <div className="memo-backdrop" role="dialog" aria-modal="true" aria-label={event.title}>
      {stamp}
      <article className="memo">
        <header className="memo-head">
          <div className="memo-kicker">
            <span>{formatShortDay(event.day)}</span>
            <span className={`memo-severity ${event.severity}`}>{event.severity}</span>
          </div>
          <h2 className="memo-title">{event.title}</h2>
        </header>

        <div className="memo-body">{event.body}</div>

        {/*
           Who it is about, if it is about somebody.

           Every one of these memos asks you to decide about a person — move
           them up, pay them, believe them, cut them loose — and named them
           without showing you anything about them. Round 14: "I was clicking
           the top two rows of a crew table because they were the top two rows,
           not because I knew who they were."

           Eight memo shapes carry an `npcId`, so this goes in the shared
           renderer rather than into the two that prompted it.

           Through `StatRead` and `payRead`, so it shows the same fogged bands
           the crew sheet shows. A memo that quoted the true numbers would hand
           the player the one thing the rest of the game spends its effort
           withholding.
        */}
        {subjects.length > 0 && (
          <div className="memo-subject">
            {subjects.map((subject) => (
              <div key={subject.id} className="memo-subject-row">
                <div className="memo-subject-who">
                  <strong>{subject.name}</strong>
                  <span className="faint">
                    {ROLE_LABEL[subject.role]} · {subject.age} ·{' '}
                    {nightsWorked(state, subject.id)} nights
                  </span>
                </div>
                <div className="memo-subject-reads">
                  <span>
                    Loyalty <StatRead npc={subject} stat="loyalty" />
                  </span>
                  <span>
                    Skill <StatRead npc={subject} stat="skill" />
                  </span>
                  <span>
                    Ambition <StatRead npc={subject} stat="ambition" warnHigh />
                  </span>
                  <span>
                    {formatMoney(subject.wage)}/wk{' '}
                    <span className={payRead(subject).tone}>{payRead(subject).text}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="memo-choices" ref={choices}>
          {event.choices.map((choice, i) => (
            <button
              key={choice.id}
              className="memo-choice"
              disabled={!!blocked(choice)}
              title={blocked(choice)}
              onClick={() => answer(event.id, choice.id)}
            >
              <span className="memo-choice-key" aria-hidden="true">
                {i + 1}
              </span>
              <div className="memo-choice-label">{choice.label}</div>
              {/*
                 A refusal has to look like one.

                 Blocked and available options rendered the same sentence in the
                 same grey, and the only difference was the button at 45%
                 opacity. Round 13 clicked a disabled "Buy it — $10,021", got
                 nothing, and said the reason "reads as description of the choice
                 rather than as a refusal" — which it did, because it was styled
                 as one. The words were right and the typography contradicted
                 them.
              */}
              {/*
                 The refusal sits *above* the hint rather than instead of it.

                 This rendered `blocked(choice) ?? choice.hint`, so a priced
                 option threw its price away at exactly the moment the price
                 decided something. Round 14 hit it five times and put it best:
                 being poor is the state where you most need to know whether
                 you are $50 short or $20,000 short, because that decides
                 whether you sell an asset or give up.
              */}
              {blocked(choice) && (
                <div className="memo-choice-hint memo-choice-blocked">{blocked(choice)}</div>
              )}
              {choice.hint && <div className="memo-choice-hint">{choice.hint}</div>}
            </button>
          ))}
        </div>
      </article>
    </div>
  );
}
