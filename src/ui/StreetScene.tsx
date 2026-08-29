/**
 * The street outside, at the top of the Overview.
 *
 * Two layers. The still street redraws whenever the facts it reads change,
 * onto an offscreen canvas. Over it, one requestAnimationFrame loop moves
 * the theatre: traffic in both lanes, and walkers who cross the block or
 * duck into the shops. All of it is driven by the same coarse bands the
 * still scene already draws — a passing car and a walker carry nothing —
 * so under prefers-reduced-motion the component simply bakes the same
 * people standing still and never starts the loop. When the browser stops
 * compositing the page, rAF stops with it and nothing is owed.
 *
 * `aria-hidden` because every fact on it is a second telling of something a
 * panel already prints.
 */
import { useEffect, useRef } from 'react';
import { useGame } from '../store';
import { streetLook } from './streetLook';
import {
  drawLive,
  drawStreet,
  makePassingCar,
  makeWalker,
  STREET_H,
  STREET_W,
  walkerGone,
  type PassingCar,
  type Walker,
} from './art/street';

const SCALE = 3;

export default function StreetScene() {
  const state = useGame();
  const canvas = useRef<HTMLCanvasElement>(null);
  const still = useRef<HTMLCanvasElement | null>(null);
  const cars = useRef<PassingCar[]>([]);
  const walkers = useRef<Walker[]>([]);
  const bands = useRef({ traffic: 0, peds: 0 });
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const look = streetLook(state);
  const key = JSON.stringify(look);
  bands.current = { traffic: look.traffic, peds: look.peds };

  // The still layer, and the composite whenever a fact changes.
  useEffect(() => {
    if (!still.current) still.current = document.createElement('canvas');
    drawStreet(still.current, look, SCALE, reduced);
    if (canvas.current) {
      canvas.current.width = STREET_W * SCALE;
      canvas.current.height = STREET_H * SCALE;
      drawLive(canvas.current, still.current, cars.current, walkers.current, SCALE);
    }
    // The serialised look is the real dependency; the object is fresh per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reduced]);

  // The life. One rAF for the component's whole existence.
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let last = performance.now();
    let nextCar = 1200;
    let nextWalker = 400;
    let seed = Math.floor(Math.random() * 1e9);
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const { traffic, peds } = bands.current;

      nextCar -= dt * 1000;
      if (traffic > 0 && nextCar <= 0 && cars.current.length < traffic + 1) {
        cars.current.push(makePassingCar(seed++, SCALE));
        nextCar = 2200 + (Math.random() * 5000) / traffic;
      }
      for (const car of cars.current) car.x += car.speed * dt;
      cars.current = cars.current.filter((c) => c.x > -70 && c.x < STREET_W + 8);

      /*
         Walkers hold the pavement at the count the band names — one is the
         sitter, baked. New ones arrive from a block edge or out of a shop
         door, and leave the same ways; `walkerGone` decides which.
      */
      nextWalker -= dt * 1000;
      if (peds > 0 && nextWalker <= 0 && walkers.current.length < peds - 1) {
        walkers.current.push(makeWalker(seed++, seed % 2 === 0));
        nextWalker = 900 + Math.random() * 1800;
      }
      for (const w of walkers.current) w.x += w.speed * dt;
      walkers.current = walkers.current.filter((w) => !walkerGone(w));

      if (canvas.current && still.current) {
        drawLive(canvas.current, still.current, cars.current, walkers.current, SCALE);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  return (
    <div className="street-scene" title="The street outside. Everything on it is also on a panel.">
      <canvas ref={canvas} aria-hidden="true" />
    </div>
  );
}
