/**
 * A read that moves, and the sentence that says why.
 *
 * Round 30: "Elena is 'very good' on one job and 'learning' on another. Sandro
 * is 'competent' then 'learning'." Nothing was wrong. `perceive()` keeps its
 * estimate stable for a given man and familiarity tier and re-draws it when
 * familiarity crosses one, and every job worked beside somebody raises it — so
 * a read taken at "first impressions only" and one taken at "getting a read"
 * can sit two bands apart, and the second is the sharper. That is the design
 * (`perceive`'s own comment: "which reads as your understanding of someone
 * sharpening over time"), and to a player it reads as a bug, because the page
 * gave them the label and none of the reasoning.
 *
 * The reasoning is the confidence the read already carries. It is on the
 * title of the read, where it costs a row nothing, and it is the tier's own
 * label — the same words the person's page prints — so it hands over nothing
 * the fog was keeping.
 */
import { describe, expect, it } from 'vitest';
import { readTitle } from '../components';
import components from '../components.tsx?raw';
import { PERCEPTION_TIERS } from '../../config/npcs';

const code = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');
const flat = (src: string): string => code(src).replace(/\s+/g, ' ');

describe('what a read says about itself', () => {
  it('names the band and how well you know them', () => {
    const title = readTitle({ band: 'very good', confidence: 'First impressions only' });
    expect(title).toContain('very good');
    expect(title).toContain('First impressions only');
  });

  it('says a read sharpens, so a changed label is not read as a fault', () => {
    expect(readTitle({ band: 'learning', confidence: 'Getting a read' })).toMatch(/sharpen/i);
  });

  it('only ever says a tier label the game already prints for the person', () => {
    // The reading is the fog's own output; nothing behind it is quoted.
    for (const tier of PERCEPTION_TIERS) {
      const title = readTitle({ band: 'competent', confidence: tier.label });
      expect(title).toContain(tier.label);
      expect(title).not.toMatch(/\d/);
    }
  });
});

describe('the read carries it', () => {
  it('puts the sentence on the read itself', () => {
    expect(flat(components)).toMatch(/<span className="read" title=\{readTitle\(read\)\}>/);
  });
});
