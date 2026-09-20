/**
 * The ladder is the family's standing, said as the family's.
 *
 * The director's round-30 call: the player is the boss of a family from the
 * first morning, so a screen that says "They call you Street Criminal" is
 * wrong about the one thing it was written to say. The rungs are renamed in
 * `config/economy.ts` (guarded in `sim/__tests__/rank.test.ts`); this pins the
 * two panels that print them, which read the ladder and had their own labels.
 *
 * Against the source with its commentary stripped, the idiom of
 * `roundThirty.test.ts`, because each of these is explained in a comment
 * above the line that makes it and the comments quote the strings.
 */
import { describe, expect, it } from 'vitest';
import dashboard from '../panels/Dashboard.tsx?raw';
import player from '../panels/PlayerPanel.tsx?raw';
import app from '../App.tsx?raw';
import succession from '../panels/SuccessionPanel.tsx?raw';

const code = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');
const flat = (src: string): string => code(src).replace(/\s+/g, ' ');

const DASHBOARD = flat(dashboard);
const PLAYER = flat(player);
const APP = flat(app);
const SUCCESSION = flat(succession);

describe('the standing is the family’s', () => {
  it('the Yourself panel labels it as the family standing, not what they call him', () => {
    expect(PLAYER).toMatch(/label="Family standing"/);
    expect(PLAYER).not.toMatch(/They call you/);
  });

  it('and the way up is worded as a place to reach, not a title to hold', () => {
    expect(PLAYER).toMatch(/label=\{`Toward \$\{/);
    expect(PLAYER).not.toMatch(/label=\{`To be \$\{/);
  });

  it('the Overview strip says whose standing it is', () => {
    expect(DASHBOARD).toMatch(/Family standing/);
    expect(DASHBOARD).not.toMatch(/wants \{whatItNeeds/);
  });
});

/*
   The stored field says nothing about anybody.

   `player.rank` is pinned at the first rung for every career (see `rank.ts`),
   so every predecessor and every successor read the same word, and once the
   rungs were renamed for the family that word became "Nobody knows the name"
   printed beside a man who ran it for two hundred days. The line of succession
   is a record of who ran the family and when, and that is what it says now.
   The rank belongs to the organization, which is derived, and the ladder's
   stored copy is history the succession record keeps for old saves and does
   not show.
*/
describe('the line of succession does not print the stored rank', () => {
  it('the game-over roll says who led the family, not what they were called', () => {
    expect(APP).toMatch(/led the family until day/);
    expect(APP).not.toMatch(/RANK_BY_ID/);
  });

  it('the succession panel shows neither a rank column nor a starting rank', () => {
    expect(SUCCESSION).not.toMatch(/RANK_BY_ID/);
    expect(SUCCESSION).not.toMatch(/inheritRank/);
    expect(SUCCESSION).not.toMatch(/They start as/);
    expect(SUCCESSION).not.toMatch(/<th>Reached<\/th>/);
  });
});
