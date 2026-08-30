/**
 * The board — everything running right now, as rows.
 *
 * Lives in ui/ for the same reason the briefing does: it is a pure reading of
 * state, it decides nothing, and it is never saved — adding a row to it
 * cannot change the outcome of a game.
 *
 * One row per running thing, six kinds: a war, somebody you have sent people
 * after, a job out on the street, a teaching pairing, and each of the two
 * trades once it has a source or stock.
 * An open sit-down deliberately has no row — it is a modal, and a row that
 * can only ever be read through the thing it reports on is furniture.
 *
 * The fog rules hold here as everywhere: a war row says when it started and
 * nothing about how the other side is bearing it, because weariness is
 * exactly the kind of number `factionIntel` exists to blur.
 */
import type { GameState } from '../sim/types';
import type { PanelId } from './Rail';
import { OPERATION_BY_ID } from '../config/operations';
import { ALL_FACTIONS, type FactionId } from '../config/factions';
import { liveTraining } from '../sim/training';
import { territoryDef } from '../sim/territory';
import { throughput } from '../sim/contraband';
import { houseShort } from '../sim/houses';
import { formatShortDay } from '../sim/util';
import { openContracts } from '../sim/contract';

export interface BoardItem {
  kind: 'war' | 'contract' | 'job' | 'teaching' | 'product' | 'arms';
  key: string;
  title: string;
  sub: string;
  /** The one figure the row leads with. */
  figure: string;
  /** 0..1 for things with a deadline; null for things that run until stopped. */
  progress: number | null;
  /** Where a click takes you. */
  panel: PanelId;
}

function warSince(state: GameState, a: FactionId, b: FactionId): number | null {
  return (
    state.factions[a]?.bonds?.[b]?.warSince ??
    state.factions[b]?.bonds?.[a]?.warSince ??
    null
  );
}

export function boardItems(state: GameState): BoardItem[] {
  const rows: BoardItem[] = [];
  const day = state.day;

  /*
     Wars first. They are the rarest and the loudest thing that can be
     running, and a board that files a war under the shakedowns has the
     urgency upside down. Yours before theirs, for the same reason.
  */
  const wars: [FactionId, FactionId, number][] = [];
  for (let i = 0; i < ALL_FACTIONS.length; i++) {
    for (let j = i + 1; j < ALL_FACTIONS.length; j++) {
      const since = warSince(state, ALL_FACTIONS[i], ALL_FACTIONS[j]);
      if (since !== null) wars.push([ALL_FACTIONS[i], ALL_FACTIONS[j], since]);
    }
  }
  wars.sort((a, b) => Number(b.includes('player')) - Number(a.includes('player')));
  for (const [a, b, since] of wars) {
    const weeks = Math.max(0, Math.floor((day - since) / 7));
    const mine = a === 'player' || b === 'player';
    const enemy = a === 'player' ? b : a;
    rows.push({
      kind: 'war',
      key: `war:${a}:${b}`,
      title: mine
        ? `War with the ${houseShort(state, enemy)}`
        : `${houseShort(state, a)} v ${houseShort(state, b)}`,
      sub: mine
        ? `since ${formatShortDay(since)} · fought weekly over shared ground`
        : `their war · since ${formatShortDay(since)}`,
      figure: `${weeks}w`,
      progress: null,
      panel: 'diplomacy',
    });
  }

  /*
     Then anybody you have sent people after.

     Second only to a war, and above the jobs, because two of your people are
     off the board and something is going to happen at the end of it that you
     cannot call back. A contract had no row at all when it shipped: you sent
     two men out for five days and the only trace was one line in the log,
     which is `marks` before it got a panel.

     The target is named because you named him. Nothing here says what the
     other family is making of it — that is `beliefs.ts`'s rule, and you find
     out by watching what they do.
  */
  for (const contract of openContracts(state).sort((a, b) => a.endDay - b.endDay)) {
    const total = Math.max(1, contract.endDay - contract.openedDay);
    rows.push({
      kind: 'contract',
      key: `contract:${contract.id}`,
      title: `Somebody has gone for ${contract.targetName}`,
      sub: `${contract.crewIds.length} of yours, off the board until ${formatShortDay(contract.endDay)}`,
      figure: `${Math.max(0, contract.endDay - day)}d`,
      progress: Math.max(0, Math.min(1, (day - contract.openedDay) / total)),
      panel: contract.kind === 'witness' ? 'law' : 'rivals',
    });
  }

  const ops = Object.values(state.activeOperations).sort((a, b) => a.endDay - b.endDay);
  for (const op of ops) {
    const def = OPERATION_BY_ID[op.defId];
    const total = Math.max(1, op.endDay - op.startDay);
    rows.push({
      kind: 'job',
      key: `job:${op.id}`,
      title: def?.name ?? op.defId,
      sub: `${territoryDef(op.territoryId)?.name ?? op.territoryId} · ${op.crewIds.length} crew · ${Math.round(
        op.successChance * 100,
      )}% shown`,
      figure: `${Math.max(0, op.endDay - day)}d`,
      progress: Math.max(0, Math.min(1, (day - op.startDay) / total)),
      panel: 'operations',
    });
  }

  for (const t of liveTraining(state)) {
    const teacher = state.npcs[t.teacherId];
    const student = state.npcs[t.studentId];
    if (!teacher || !student) continue;
    const total = Math.max(1, t.endDay - t.startDay);
    rows.push({
      kind: 'teaching',
      key: `teach:${t.id}`,
      title: `${teacher.name} is showing ${student.name} the work`,
      sub: `both off the board until ${formatShortDay(t.endDay)}`,
      figure: `${Math.max(0, t.endDay - day)}d`,
      progress: Math.max(0, Math.min(1, (day - t.startDay) / total)),
      panel: 'crew',
    });
  }

  /*
     A trade is running once it has a source or something on hand — routes
     with nothing to move and no way to get it are a map, not a trade. The
     figure is stock because stock is the one asset in this game a warrant
     can physically take; the sub carries the weekly ceiling and which of the
     two limits is the one actually biting.
  */
  const c = state.contraband;
  if (c) {
    const productRunning =
      c.supplierId !== null ||
      (c.plants?.length ?? 0) > 0 ||
      c.stock.product > 0 ||
      c.routes.product.length > 0;
    if (productRunning) {
      const cap = throughput(state, 'product');
      const bound = cap.routes <= cap.crew ? 'streets are the ceiling' : 'people are the ceiling';
      rows.push({
        kind: 'product',
        key: 'trade:product',
        title: 'The product trade',
        sub: `${c.routes.product.length} route${c.routes.product.length === 1 ? '' : 's'} · up to ${cap.total}u a week · ${bound}`,
        figure: `${Math.round(c.stock.product)}u`,
        progress: null,
        panel: 'contraband',
      });
    }
    const armsRunning =
      c.workshops.length > 0 ||
      (c.armsSupplierId ?? null) !== null ||
      c.stock.arms > 0 ||
      c.routes.arms.length > 0;
    if (armsRunning) {
      const cap = throughput(state, 'arms');
      rows.push({
        kind: 'arms',
        key: 'trade:arms',
        title: 'The arms trade',
        sub: `${c.workshops.length} workshop${c.workshops.length === 1 ? '' : 's'} · ${c.routes.arms.length} route${c.routes.arms.length === 1 ? '' : 's'} · up to ${cap.total}u a week`,
        figure: `${Math.round(c.stock.arms)}u`,
        progress: null,
        panel: 'contraband',
      });
    }
  }

  return rows;
}
