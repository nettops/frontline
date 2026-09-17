/**
 * The capo's-word panel names two people and nothing hidden about either.
 *
 * `d9f8080`'s fault (`PlayerPanel.tsx` reaching past `perceive()` for the
 * shaping-into read) is exactly the mistake a new panel could repeat here in
 * a different shape: printing a raw stat or tie number instead of routing
 * through the game's usual fog. This panel shows no number at all — only
 * `vouchLine`'s prose and the two names — so the audit is that the block
 * never reaches into `.stats` or `.ties` for anything it prints.
 */
import { describe, expect, it } from 'vitest';
import crewPanel from '../panels/CrewPanel.tsx?raw';

function vouchBlock(source: string): string {
  const at = source.indexOf("A capo's word");
  expect(at, 'the panel is gone or renamed').toBeGreaterThan(-1);
  const end = source.indexOf('Panel title="Your people"', at);
  expect(end, 'could not find the end of the block').toBeGreaterThan(at);
  return source.slice(at, end);
}

describe('a capo\'s recommendation names people, not numbers', () => {
  it('renders through vouchLine rather than composing its own sentence', () => {
    const block = vouchBlock(crewPanel);
    expect(block).toContain('vouchLine(capo, associate)');
  });

  it('never reaches into a hidden stat or tie for what it prints', () => {
    const block = vouchBlock(crewPanel);
    expect(block).not.toMatch(/\.stats\.\w+/);
    expect(block).not.toMatch(/\.ties\b/);
    expect(block).not.toMatch(/\.trust\b/);
    expect(block).not.toMatch(/\.familiarity\b/);
  });

  it('wires all three real actions', () => {
    const block = vouchBlock(crewPanel);
    expect(block).toMatch(/makeVouch\(s,\s*associate\.id\)/);
    expect(block).toMatch(/waitOnVouch\(s,\s*associate\.id\)/);
    expect(block).toMatch(/denyVouch\(s,\s*associate\.id\)/);
  });
});
