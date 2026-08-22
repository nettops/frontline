/**
 * An agency must not promise a trial it cannot hold.
 *
 * The indictment memo said "it goes in front of a jury in 25 days" for every
 * agency. Only the Federal Bureau has `maxStage: 'trial'`; the Task Force and
 * Financial Crimes stop at `indictment` and can never reach a jury at all.
 *
 * Round 11 was indicted by the Task Force on day 147, upgraded to the most
 * expensive counsel in the game on the strength of that sentence, and reached
 * day 303 — 156 days later — with the case still sitting at Indictment. The
 * countdown was never going to run, and the Overview had been saying so all
 * along: "TASK FORCE CAN TAKE IT AS FAR AS INDICTMENT".
 *
 * The 25 days are also measured from the day the case *reaches* trial, not from
 * the indictment, so even the Bureau's version was quoting a clock that had not
 * started.
 */
import { describe, expect, it } from 'vitest';

import { AGENCIES } from '../../config/lawEnforcement';
import { indictmentBody } from '../investigation';

describe('the indictment memo', () => {
  it('only promises a jury when the agency can actually reach one', () => {
    for (const agency of AGENCIES) {
      const body = indictmentBody(agency);
      if (agency.maxStage === 'trial') {
        expect(body).toMatch(/jury/i);
      } else {
        expect(body).not.toMatch(/jury in \d+ days|goes in front of a jury/i);
      }
    }
  });

  it('says where the case actually stops for an agency that cannot try you', () => {
    const capped = AGENCIES.filter((a) => a.maxStage !== 'trial');
    expect(capped.length).toBeGreaterThan(0);
    for (const agency of capped) {
      expect(indictmentBody(agency)).toMatch(/as far as|no further|cannot take/i);
    }
  });
});
