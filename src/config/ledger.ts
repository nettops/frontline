/**
 * The categories a family's money moves under.
 *
 * Small on purpose. A ledger with thirty rows is a spreadsheet, and the
 * question a player is actually asking has four or five answers: is the trade
 * paying for itself, are the fronts worth what they cost, is the payroll
 * eating everything, and how much is the wash taking.
 *
 * The last row is the important one. Categories are attached at call sites, and
 * money moves through more sites than any one pass will label — so anything
 * unlabelled is reconciled against the real balance at the weekly close and
 * shown as `unaccounted` rather than dropped. A book that quietly omits what it
 * did not recognise is the standing failure mode of this project wearing an
 * accountant's suit.
 */

export const LEDGER = {
  /** Rows recorded positive. */
  income: ['trade', 'fronts', 'jobs', 'other_in'] as const,
  /** Rows recorded negative, so a column adds up without special cases. */
  outgoings: [
    'stock',
    'stakes',
    'wages',
    'crew',
    'wash',
    'premises',
    'law',
    'world',
    'debt',
    'other_out',
  ] as const,
  /**
   * Weeks of history kept.
   *
   * Every row is saved to disk with the rest of the state, so this is a rolling
   * window rather than an archive. Two years is longer than the 300 days a
   * blind round plays and long enough to see a trend on a chart.
   */
  weeksKept: 104,
} as const;

export type LedgerIncome = (typeof LEDGER.income)[number];
export type LedgerOutgoing = (typeof LEDGER.outgoings)[number];
export type LedgerKey = LedgerIncome | LedgerOutgoing;

export const LEDGER_KEYS: LedgerKey[] = [...LEDGER.income, ...LEDGER.outgoings];

/** What each row is called on the screen, and the one-line explanation under it. */
export const LEDGER_LABEL: Record<LedgerKey, { name: string; blurb: string }> = {
  trade: {
    name: 'The trade',
    blurb: 'Everything the two trades sold, before what the stock cost.',
  },
  fronts: {
    name: 'The fronts',
    blurb: 'What the legitimate side took over the counter.',
  },
  jobs: { name: 'Work', blurb: 'What the jobs paid when they came off.' },
  other_in: { name: 'Everything else in', blurb: 'Cards, favours, loans, and the post.' },
  stock: { name: 'Stock', blurb: 'What you paid for what you sold.' },
  stakes: {
    name: 'Putting jobs up',
    blurb: 'What the work cost to send people out on, win or lose.',
  },
  crew: { name: 'Taking people on', blurb: 'What it cost to bring somebody in or move them up.' },
  debt: { name: 'Debt', blurb: 'What the lenders took back, and what they charged for waiting.' },
  wages: { name: 'Payroll', blurb: 'Everybody on the books, whatever kind of week it was.' },
  wash: { name: 'The wash', blurb: "The share taken to change money's colour. It buys nothing." },
  premises: {
    name: 'Premises and retainers',
    blurb: 'Fronts, plants, workshops, and anybody on a standing arrangement.',
  },
  law: {
    name: 'Lawyers and contacts',
    blurb: 'Counsel on a retainer, somebody inside, bail, and what a warrant carried out.',
  },
  world: {
    name: 'What the week asked for',
    blurb: 'Memos answered, other families paid, and nights at the card table.',
  },
  other_out: {
    name: 'Everything else out',
    blurb: 'Whatever is left once the rows above have had their share. Should be small.',
  },
};
