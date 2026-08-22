/**
 * "a Associate" is not a sentence.
 *
 * Round 11 read "what they have done as **a** Associate" in a promotion memo.
 * Six sites write `a ${ROLE_LABEL[...]}` and three of the seven roles begin
 * with a vowel — Associate, Enforcer, Underboss — so half the ladder produces
 * it. The writing is the highest-scoring thing in this game and it should not
 * be let down by a hard-coded article.
 */
import { describe, expect, it } from 'vitest';

import { article, withArticle } from '../util';
import { ROLE_LABEL } from '../../config/economy';

describe('articles', () => {
  it('picks an for a vowel and a for a consonant', () => {
    expect(article('Associate')).toBe('an');
    expect(article('Enforcer')).toBe('an');
    expect(article('Underboss')).toBe('an');
    expect(article('Soldier')).toBe('a');
    expect(article('Capo')).toBe('a');
    expect(article('Lieutenant')).toBe('a');
    expect(article('Consigliere')).toBe('a');
  });

  it('reads correctly for every role the game can name', () => {
    for (const label of Object.values(ROLE_LABEL)) {
      const phrase = withArticle(label);
      expect(phrase).toMatch(/^an? \S/);
      if (/^[aeiou]/i.test(label)) expect(phrase.startsWith('an ')).toBe(true);
      else expect(phrase.startsWith('a ')).toBe(true);
    }
  });
});
