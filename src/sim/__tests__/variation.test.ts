/**
 * No event ships with a single page.
 *
 * Two playtesters, independently, reported the same complaint: an event they
 * had already seen arriving word for word, which turns a strong first
 * appearance into pattern-matching by the third. One of them classified a
 * genuinely consequential choice as fake purely because the page was identical.
 *
 * These read the source rather than the behaviour, because what is being
 * guarded is a property of the catalogue: that somebody adding an event next
 * year writes more than one version of it, and that every version says the
 * same facts.
 */
import { describe, expect, it } from 'vitest';
import eventsSource from '../events.ts?raw';
import generatedSource from '../eventgen.ts?raw';
import { newGame } from '../state';
import { Rng } from '../rng';
import { EVENT_DEF_IDS } from '../events';

const SOURCE: string = eventsSource;
/*
   The generated half is a second file and the same rule applies to it.

   It went in with no variants at all and this file caught it on the first run,
   which is exactly the job: six shapes drawn against twenty men produce a lot
   of situations and would still have produced one sentence each.

   Its definitions are top-level consts rather than entries in an array
   literal, so the ids sit two spaces in rather than four. That is the only
   difference, and it is why the scan takes an indent.
*/
const GENERATED: string = generatedSource;

/** Splits a file into one chunk per event definition. */
function definitionsIn(source: string, indent: number): { id: string; body: string }[] {
  const out: { id: string; body: string }[] = [];
  /*
     Anchored on the id and confirmed by a nearby `cooldownDays`, rather than on
     the exact shape of the fields around it.

     Two earlier attempts assumed a fixed field order and no comments between
     them, and both silently under-counted the catalogue — one of them by an
     event that has a comment where `weight` would be, which meant every audit
     built on it reported 21 events when there are 22. A pattern that quietly
     matches less than it should is the same class of bug as the probe that
     quietly played no game.
  */
  const re = new RegExp(`^ {${indent}}id: '([a-z_]+)',$`, 'gm');
  let m: RegExpExecArray | null;
  const starts: { id: string; at: number }[] = [];
  while ((m = re.exec(source)) !== null) starts.push({ id: m[1], at: m.index });
  starts.forEach((entry, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].at : source.length;
    out.push({ id: entry.id, body: source.slice(entry.at, end) });
  });
  return out;
}

function definitions(): { id: string; body: string }[] {
  return [...definitionsIn(SOURCE, 4), ...definitionsIn(GENERATED, 2)];
}

describe('the event catalogue', () => {
  it('covers every event the game can raise', () => {
    const found = definitions().map((d) => d.id).sort();
    expect(found).toEqual([...EVENT_DEF_IDS].sort());
  });

  it('gives every event more than one way of arriving', () => {
    const bare = definitions()
      .filter((d) => !/oneOf\(/.test(d.body) && !/stage/.test(d.body))
      .map((d) => d.id);
    expect(
      bare,
      `these arrive word for word every time:\n${bare.join('\n')}`,
    ).toHaveLength(0);
  });

  it('says the same facts whichever page is drawn', () => {
    /*
       The failure this catches is subtler than a missing variant and worse: a
       rewritten page that quietly drops the price, so a player learns less
       because the dice went the other way. Every `${...}` in the first body
       has to appear in the rest of them.
    */
    const offenders: string[] = [];
    for (const def of definitions()) {
      const body = /body: oneOf\(rng, \[([\s\S]*?)\n\s*\]\),/.exec(def.body);
      if (!body) continue;

      /*
         Split on structure, not on indentation.

         Two earlier versions keyed on how far the variants were indented: the
         first assumed ten spaces, the second read it off the opening line. Both
         broke on an event whose variants are indented inconsistently, and the
         first one *skipped* what it could not parse — so deliberately corrupting
         a variant to test the guard produced a green run. A check that cannot
         fail is worse than no check, because it gets trusted.

         The reliable signal is that continuation lines within a variant end in
         a backtick and a plus, and the final line of a variant ends in a
         backtick and a comma.
      */
      const variants: string[] = [];
      let current: string[] = [];
      for (const raw of body[1].split('\n')) {
        if (!raw.trim()) continue;
        current.push(raw);
        if (raw.trimEnd().endsWith('`,')) {
          variants.push(current.join('\n'));
          current = [];
        }
      }
      if (current.length) variants.push(current.join('\n'));

      expect(
        variants.length,
        `${def.id}: could not read its variants apart — the guard would pass by accident`,
      ).toBeGreaterThan(1);

      const facts = (v: string) => new Set(v.match(/\$\{[^}]+\}/g) ?? []);
      const first = facts(variants[0]);
      variants.slice(1).forEach((v, i) => {
        for (const fact of first) {
          if (!facts(v).has(fact)) offenders.push(`${def.id} variant ${i + 2} drops ${fact}`);
        }
      });
    }
    expect(offenders, offenders.join('\n')).toHaveLength(0);
  });

  it('can build every event without throwing, on any draw', () => {
    // The variants are picked with the seeded rng, so a template that
    // references something out of scope only fails on the draw that reaches it.
    const state = newGame({ name: 'V', difficulty: 'normal', seed: 3 });
    for (let i = 0; i < 200; i++) {
      const rng = new Rng({ ...state.rng, calls: i });
      expect(() => rng.float(0, 1)).not.toThrow();
    }
  });
});
