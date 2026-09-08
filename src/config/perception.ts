/**
 * The city as an audience: media, public opinion and political pressure.
 *
 * These are three sections of the design brief and one system, which is the
 * only reason they are worth building. Separately they would be three meters:
 * a newspaper that prints what already happened, an opinion number that
 * follows the newspaper, and a politician who follows the opinion number. As a
 * loop they are the missing feedback edge in the whole simulation — the point
 * where being loud stops being a private arrangement between you and the
 * agencies and becomes something the city has a view about.
 *
 * The loop:
 *
 *     violence, arrests, trials, wars  →  coverage
 *     coverage                         →  outrage, and notoriety if you are named
 *     outrage                          →  political pressure, with a lag
 *     pressure                         →  agency pace, heat floors, front revenue
 *
 * Nothing here is shown to the player as a number. Same rule as everything
 * else: you read the city the way you read a person.
 */

export type CoverageKind =
  | 'street_violence'
  | 'war'
  | 'arrest'
  | 'raid'
  | 'trial'
  | 'conviction'
  | 'acquittal'
  | 'corruption'
  | 'charity'
  | 'display';

export interface CoverageDef {
  kind: CoverageKind;
  /** How loud, 0..100, before district and condition scaling. */
  prominence: number;
  /** Outrage moved per point of prominence. */
  outrage: number;
  /** Notoriety moved when the organization is named. */
  notoriety: number;
  tone: 'crime' | 'law' | 'politics';
  /** Headline templates. `{where}` and `{who}` are filled where available. */
  headlines: string[];
}

export const COVERAGE: Record<CoverageKind, CoverageDef> = {
  street_violence: {
    kind: 'street_violence',
    prominence: 30,
    outrage: 0.055,
    notoriety: 0.03,
    tone: 'crime',
    headlines: [
      'Man shot in {where}; police appeal for witnesses',
      'Second assault this month in {where}',
      'Businesses in {where} say they are paying somebody',
      'Two men beaten outside a bar in {where}; no arrests',
      'Publican in {where} declines to press charges',
      'Assault outside a betting shop; witnesses will not be named',
      'Man found beaten in a yard; police say he will not talk',
    ],
  },
  war: {
    kind: 'war',
    prominence: 62,
    outrage: 0.075,
    notoriety: 0.05,
    tone: 'crime',
    /*
       Eleven rather than five, and eight of them work without a district.

       `cover` filters `{where}` headlines out when the story has no district,
       so a clash on ground neither side holds could only ever print the three
       lines below that had no placeholder — and `scorecard.probe` duly
       measured all three at 0.8% of everything a player reads, side by side,
       the three loudest lines left in the game.

       The rule the whole table now follows: a pool needs enough placeholder-free
       lines to carry the case where there is nothing to name, or those few
       become the paper.
    */
    headlines: [
      'Open violence in {where} as gangs clash',
      '"It is a war," says councilman, of {where}',
      'Second funeral this week in {where}',
      'Shopkeepers in {where} shutting at four o\'clock',
      'Third shooting in a fortnight; commissioner under pressure',
      'Two dead as feud spills into the open',
      'Police deny losing control of the streets',
      'Hospital reports four gunshot admissions in nine days',
      'Councillors demand answers on "street war"',
      'Man shot dead outside his own restaurant',
      'Bystander hit; family says nobody has been to see them',
    ],
  },
  arrest: {
    kind: 'arrest',
    prominence: 34,
    outrage: 0.03,
    notoriety: 0.06,
    tone: 'law',
    headlines: [
      '{who} held in connection with {where} inquiry',
      '{who} charged; bail opposed',
      'Arrests follow months of surveillance',
      'Three men taken in before dawn; one released without charge',
      'Detectives confirm arrest, decline to name the man',
    ],
  },
  raid: {
    kind: 'raid',
    prominence: 55,
    outrage: 0.02,
    notoriety: 0.09,
    tone: 'law',
    headlines: [
      'Dawn raids across {where}',
      'Warrants executed at four addresses',
      'Officers remove boxes from a club on {where}',
      'Ledgers seized; no arrests announced',
      'Two premises sealed pending inquiry',
    ],
  },
  trial: {
    kind: 'trial',
    prominence: 70,
    outrage: 0.03,
    notoriety: 0.12,
    tone: 'law',
    headlines: [
      'Racketeering trial opens; gallery full',
      'Prosecutors promise "the whole structure" at trial',
      'First witness fails to appear; judge issues warning',
      'Defence calls the case "a filing cabinet and a grudge"',
      'Juror discharged on day three; no reason given',
    ],
  },
  conviction: {
    kind: 'conviction',
    prominence: 85,
    outrage: -0.06,
    notoriety: 0.14,
    tone: 'law',
    headlines: [
      'Guilty on all counts',
      'Jury returns after two days: guilty',
      'Guilty on three of seven; sentencing next month',
      'Convicted man says nothing as the verdict is read',
    ],
  },
  acquittal: {
    kind: 'acquittal',
    prominence: 78,
    outrage: 0.09,
    notoriety: 0.1,
    tone: 'law',
    headlines: [
      'Acquitted; prosecutors decline to comment',
      '"A humiliation," says former investigator',
      'Case collapses after witness withdraws',
      'Not guilty; the public gallery applauded',
    ],
  },
  corruption: {
    kind: 'corruption',
    prominence: 80,
    outrage: 0.11,
    notoriety: 0.07,
    tone: 'politics',
    headlines: [
      'Official suspended over payments',
      'Inquiry into department "ties" announced',
      'Councillor resigns citing "family reasons"',
      'Bank records show four payments nobody will explain',
    ],
  },
  /*
     A boss buying something everybody can see.

     Low outrage and high notoriety, which is the opposite shape to everything
     else in this table and the reason possessions are a decision rather than a
     purchase. Nobody is angry that a man bought a car. Everybody now knows his
     name, and `legitimacy` and every civic figure's discretion both read
     notoriety.

     Scaled by the thing's `visibility` at the call site, so the watch prints
     nothing anybody reads and the Merriweather place prints at full volume.
  */
  display: {
    kind: 'display',
    prominence: 34,
    outrage: 0.015,
    notoriety: 0.1,
    tone: 'politics',
    headlines: [
      'Who is buying up {where}?',
      'A new name on an old address in {where}',
      'Society: the quiet arrival of a {where} fortune',
    ],
  },
  charity: {
    kind: 'charity',
    prominence: 22,
    // The only thing in this table that buys outrage down, and it is weak on
    // purpose. Bad news is louder than good news, in 1978 and since.
    outrage: -0.05,
    notoriety: 0.01,
    tone: 'crime',
    headlines: [
      'New equipment for {where} community hall',
      'Anonymous donor funds {where} clinic',
    ],
  },
};

/** Headlines kept for the city panel. Older ones fall off the spike. */
export const STORY_LIMIT = 30;
/** Two stories on the same day is a busy news day. Three is not a newspaper. */
export const STORIES_PER_DAY = 2;

// ------------------------------------------------------------ the numbers ---

export const CITY = {
  /** Where a quiet city sits. Outrage decays toward this, never to zero. */
  outrageBaseline: 12,
  /**
   * How much a feared organization raises the floor the city settles at.
   *
   * Expressed as a floor rather than as weekly additions, which is what the
   * first version did and which could not work: anything small enough not to
   * spiral was smaller than the weekly decay, so at maximum fear the city's
   * mood did not move at all. A reputation for hurting people is a standing
   * condition of the city, not a series of events.
   */
  fearFloorAtMax: 32,
  outrageDecayPerWeek: 1.6,
  /** Notoriety fades faster: the city forgets a name before it forgets a fear. */
  notorietyDecayPerWeek: 2.4,

  /**
   * Political will lags what the city feels.
   *
   * The gap is the mechanic. A fortnight of outrage does nothing because
   * nobody in an office has moved yet; two months of it becomes a task force
   * that stays after the outrage has gone.
   */
  pressureFollowsOutrage: 0.08,
  pressureDecayPerWeek: 1.1,

  /** What pressure does to the agencies, at 100. */
  agencyPaceAtMax: 0.55,
  agencyWorkAtMax: 0.4,
  /**
   * Agencies open cases sooner when the city is shouting. Expressed as points
   * knocked off every agency's heat floor at maximum pressure.
   */
  heatFloorDropAtMax: 18,
  /** Legitimate business is worse in a city that feels unsafe. */
  businessRevenueAtMin: 0.88,
  /** Sentiment across every district drifts down under sustained outrage. */
  sentimentPerWeekAtMax: -0.9,
};

/**
 * Buying somebody in office.
 *
 * The counterplay, and deliberately expensive and temporary. It does not
 * reduce outrage — you cannot buy what the city thinks — it holds the
 * political response off it for a while, which is a different and more
 * interesting thing to be paying for.
 */
export const PATRON = {
  cost: 120_000,
  influenceRequired: 9,
  days: 90,
  /** Pressure held back to this share of where it would otherwise be. */
  pressureShare: 0.45,
  /** Chance per week the arrangement becomes a story of its own. */
  exposureChancePerWeek: 0.02,
};

/** What the player is allowed to see, and when. */
export const CITY_INTEL = {
  /** Reading the mood needs somebody who talks to people. */
  moodNeedsInfluence: 4,
  /** Knowing what city hall intends needs real pull. */
  pressureNeedsInfluence: 9,
};

export const OUTRAGE_BANDS: [number, string][] = [
  [70, 'The city is furious'],
  [50, 'People are talking about crime'],
  [30, 'A certain unease'],
  [0, 'Nobody is thinking about you'],
];

export const PRESSURE_BANDS: [number, string][] = [
  [70, 'City hall has committed to doing something'],
  [45, 'There are meetings about it'],
  [22, 'Somebody has been asked a question'],
  [0, 'Nobody in office cares'],
];

export const NOTORIETY_BANDS: [number, string][] = [
  [70, 'Your name is the one they use'],
  [45, 'People who read the papers know your name'],
  [20, 'Your name has appeared once or twice'],
  [0, 'Nobody has printed your name'],
];
