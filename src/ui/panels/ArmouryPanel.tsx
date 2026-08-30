/**
 * The shelf.
 *
 * A policy screen rather than a shop. The two standing decisions at the top
 * are the whole interface — what my people carry, and whether they get rid of
 * it — because that is the stance `standingOrders` and `delegation` already
 * take: you decide once and read the record afterwards. There is no prompt at
 * any act of violence and there is never going to be one.
 *
 * The rack below it says what the family owns and, for each piece, what a
 * player is allowed to know about it. `pieceReading` returns a sentence and
 * never a count, which is `perceive()`'s rule: you are told there is something
 * to know, and the number stays where it is. A house gun that quietly filed a
 * joining trace nobody was warned about would be a trap, and this is the line
 * that stops it being one.
 */
import { useEffect, useRef, useState } from 'react';
import { mutate, useGame } from '../../store';
import { Empty, Panel } from '../components';
import {
  armouryOf,
  breakOutCrate,
  buyCold,
  pieceReading,
  setCarry,
  setCharge,
  setDump,
  shelf,
} from '../../sim/pieces';
import {
  CARRIED_BY_CLASS,
  CLASS,
  COLD,
  CRATE_BREAK,
  PIECES,
  PIECE_CLASSES,
  PROVENANCE,
  type PieceClass,
} from '../../config/pieces';
import { TRADES } from '../../config/contraband';
import { formatMoney } from '../../sim/util';
import { drawPiece, type Finish } from '../art/arms';
import type { Piece } from '../../sim/types';

const SCALE = 2;

function Sprite({ defId, finish }: { defId: string; finish: Finish }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvas.current) drawPiece(canvas.current, defId, finish, SCALE);
  }, [defId, finish]);
  return <canvas className="piece-art" ref={canvas} aria-hidden="true" />;
}

function Row({ piece }: { piece: Piece }) {
  const def = PIECES[piece.defId];
  const prov = PROVENANCE[piece.provenance];
  return (
    <div className="piece-row">
      <Sprite defId={piece.defId} finish={prov.finish} />
      <div className="piece-name">
        <b>{def.name}</b>
        <span className="tiny">{CLASS[piece.cls].name.toLowerCase()}</span>
      </div>
      {/*
         The tag alone. The blurb was on every row and it is the same sentence
         four times over on a day-one shelf — repetition that pushed the one
         column worth reading off the side of the panel. It is the title now,
         which is where a definition belongs once the reader has met it.
      */}
      <span className={piece.provenance === 'cold' ? 'tag good' : 'tag'} title={prov.blurb}>
        {prov.name}
      </span>
      <div className={piece.bodies > 0 ? 'piece-read warn' : 'piece-read'}>
        {pieceReading(piece)}
      </div>
    </div>
  );
}

export default function ArmouryPanel() {
  const state = useGame();
  const [message, setMessage] = useState<string | null>(null);

  const armoury = armouryOf(state);
  const rack = shelf(state);
  const crates = state.contraband?.stock.arms ?? 0;

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">The Armoury</h1>
        <span className="tiny">
          {rack.length} on the shelf
        </span>
      </div>
      <p className="page-sub">
        Your people are armed on every job, and none of that is written down —
        nothing comes back from an ordinary shakedown. A piece gets a name and a
        history the night it leaves a body, which is the only reason any of this
        is here.
      </p>
      <p className="page-sub">
        Two facts about a piece and no others. How much of a street knows it went
        past, and where it came from. The second one is what somebody reads off
        it afterwards.
      </p>

      <Panel title="What they carry">
        <div className="carry-row">
          {PIECE_CLASSES.map((cls: PieceClass) => (
            <button
              key={cls}
              className={armoury.carry === cls ? 'btn primary' : 'btn'}
              onClick={() => mutate((s) => setCarry(s, cls))}
            >
              {CLASS[cls].name}
            </button>
          ))}
        </div>
        <p className="tiny">{CLASS[armoury.carry].blurb}</p>
        {/*
           Both halves of the trade, in the order a player meets them. A bigger
           gun is better odds and more attention, and saying only the first half
           would be the panel lying about a number the simulation applies.
        */}
        <p className="tiny">
          {armoury.carry === 'pocket'
            ? 'Nothing added to the odds, and nothing added to the noise.'
            : `Better odds it goes the way you wanted, and ${Math.round(
                (CLASS[armoury.carry].heat - 1) * 100,
              )}% more attention when it does.`}
        </p>
        <p className="tiny">
          A preference and not a rule. If there is nothing of that sort on the
          shelf, somebody still goes out.
        </p>
      </Panel>

      <Panel title="Afterwards">
        <div className="carry-row">
          <button
            className={!armoury.dump ? 'btn primary' : 'btn'}
            onClick={() => mutate((s) => setDump(s, false))}
          >
            Keep it
          </button>
          <button
            className={armoury.dump ? 'btn danger' : 'btn'}
            onClick={() => mutate((s) => setDump(s, true))}
          >
            Get rid of it
          </button>
        </div>
        <p className="tiny">
          {armoury.dump
            ? 'It goes in the river. Usually. Either way it is off the shelf, and the next one costs whatever the next one costs.'
            : 'Free, and the same piece keeps going out. Two bodies on one piece is one case, and somebody will put that together.'}
        </p>
      </Panel>

      {/*
         The third standing decision, and the only one that is not about a
         piece at all. Kept in its own panel below the two that are, because it
         does not read the shelf and nothing comes off it.
      */}
      <Panel title="On a contract">
        <div className="carry-row">
          <button
            className={!armoury.charge ? 'btn primary' : 'btn'}
            onClick={() => mutate((s) => setCharge(s, false))}
          >
            Send somebody
          </button>
          <button
            className={armoury.charge ? 'btn danger' : 'btn'}
            onClick={() => mutate((s) => setCharge(s, true))}
          >
            Use a charge
          </button>
        </div>
        <p className="tiny">
          {armoury.charge
            ? 'It does not miss the way somebody with a gun misses. It also takes the street with it, and no local force handles a thing like that — it goes straight to the two people in this city who can finish you.'
            : 'Somebody goes, carries what the shelf gave them, and comes back or does not.'}
        </p>
        <p className="tiny">
          Never against one of your own. There is no version of this aimed at a
          man sitting in a room.
        </p>
      </Panel>

      <Panel
        title="The shelf"
        action={
          <div className="carry-row">
            <button
              className="btn"
              onClick={() => setMessage(mutate((s) => buyCold(s))?.message ?? null)}
              title={`A piece with nothing on it and nothing behind it. ${formatMoney(COLD.cost)}.`}
            >
              Buy cold · {formatMoney(COLD.cost)}
            </button>
            <button
              className="btn"
              disabled={crates < 1}
              onClick={() => setMessage(mutate((s) => breakOutCrate(s))?.message ?? null)}
              title={
                crates < 1
                  ? `No ${TRADES.arms.unit[1]} to break out.`
                  : `One ${TRADES.arms.unit[0]} into ${CRATE_BREAK.pieces} pieces, every one of them traceable to you.`
              }
            >
              Break out a {TRADES.arms.unit[0]}
            </button>
          </div>
        }
      >
        {message && <p className="tiny">{message}</p>}
        {rack.length === 0 ? (
          <Empty>Nothing on it, and the family will find something anyway.</Empty>
        ) : (
          <div className="piece-rack">
            {rack.map((piece) => (
              <Row key={piece.id} piece={piece} />
            ))}
          </div>
        )}
      </Panel>

      {/*
         The rest of it, drawn and not carried.

         Fire and charges are different acts against different targets and the
         game models neither. They are here because they are part of what a
         family owns and because leaving them off would be a quieter lie than
         saying so. See `config/pieces.ts` on why charges in particular stay
         parked.
      */}
      <Panel title="Not carried">
        <p className="tiny">
          A fire and a charge are not one of the three nights this game keeps a
          record of. They are here because the family owns them.
        </p>
        <div className="piece-rack">
          {Object.values(PIECES)
            .filter((def) => def.kind === 'fire' || def.kind === 'charge')
            .map((def) => (
              <div className="piece-row" key={def.id}>
                <Sprite defId={def.id} finish="blacked" />
                <div className="piece-name">
                  <b>{def.name}</b>
                  <span className="tiny">{CLASS[def.cls].name.toLowerCase()}</span>
                </div>
                <div className="piece-read">leaves {def.leaves}</div>
              </div>
            ))}
        </div>
      </Panel>

      <Panel title="Everything the family could hold">
        <p className="tiny">
          What each sort of piece leaves behind. None of it is priced; a razor
          and a sawn-off differ in what the paperwork says happened, and that is
          worth having without being worth costing.
        </p>
        {PIECE_CLASSES.map((cls) => (
          <div key={cls}>
            <p className="tiny">
              <b>{CLASS[cls].name}</b> — {CLASS[cls].blurb}
            </p>
            <div className="piece-rack">
              {CARRIED_BY_CLASS[cls].map((def) => (
                <div className="piece-row" key={def.id}>
                  <Sprite defId={def.id} finish="blued" />
                  <div className="piece-name">
                    <b>{def.name}</b>
                  </div>
                  <div className="piece-read">leaves {def.leaves}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Panel>
    </>
  );
}
