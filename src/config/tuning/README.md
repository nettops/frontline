# Tuning

The numbers, in files you can edit without installing anything.

Everything in this directory is plain JSON that the game reads at build time.
Change a value, run `npm run dev`, and the game plays differently. You do not
need to know TypeScript to edit these — but you do need the repository and
Node, because the JSON is compiled into the build. Editing the game from
inside the game is a separate, later change.

| File | What it controls |
| --- | --- |
| `difficulty.json` | The four modes and every multiplier each applies |
| `heat.json` | The seven attention bands, how fast heat decays, what an organization absorbs, laying low |
| `economy.json` | Starting money, wages, fear, holdings, crew ceilings, attribute costs |

## The rules the files have to obey

Three things are checked, and a file that breaks one fails loudly rather than
producing a game that is quietly wrong:

- **Every key must be present, and numbers must be numbers.** Deleting a key or
  quoting a number as `"500"` fails `npm run build` with the key named. This is
  the TypeScript compiler reading the JSON, so it costs nothing at runtime.
- **Ids must be the ids the game knows.** `"noraml"` instead of `"normal"`, or a
  role the game has never heard of, throws on the first import with both the
  unknown name and the missing one. The compiler cannot catch this — a JSON
  string is just a string — so `tuning/check.ts` does.
- **Heat bands must start at 0 and abut.** Band *n* ending at 25 and band *n+1*
  starting at 30 leaves five points belonging to nothing. That exact shape was
  a real bug for the life of the project, so it is now an error.

## What is not here

Anything that is not a number a tuner would change:

- **Labels, names and descriptions** stay with their data where they are part
  of the table — the heat bands carry theirs, because renaming a band you have
  just moved is the same edit. Where they are purely presentational, they stay
  in the `.ts` file.
- **Id lists and orderings** stay in TypeScript, because the types are built
  from them. `ROLE_ORDER` is not a preference; a role's index in it *is* its
  authority level.
- **Curves that are code** — `attributeProgressNeeded` is a formula, so the two
  constants it uses are here and the shape of it is not.
- **The reasons.** JSON cannot hold a comment, and in this project the comment
  is usually longer than the number and always more valuable. Every figure here
  is documented at the point it is read, in `config/*.ts`. Read that before
  changing this.

## Adding a file

Move the literals out, leave every comment behind, and have the `.ts` file
import the JSON and assign it to the type it already declares. Assigning to a
declared type is what makes the compiler check the new file. If the data has
ids in it, add a `checkIds` call; if it has bands, add `checkBands`.
