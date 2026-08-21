# 🎪 TRIVIA CONTENT BRIEF — write questions somewhere cheap

> This file exists so that writing trivia never happens inside a coding session
> again. Question-writing needs a chat window and this brief; it does not need
> the repo, the engine, the test suite or a sandbox. Paste this whole file into a
> plain conversation, ask for a batch, paste the result back into
> `data/trivia.js` before the closing `];` of `TRIVIA_QUESTIONS`, and run
> `npm run test:engine` — it will tell you instantly if a batch skews a bucket.

## The shape

```js
  {
    "id": "rig_21",
    "difficulty": "easy",
    "era": "Amps, Effects & Studio Gear",
    "topic": "effects",
    "question": "Which pedal effect gives a guitar that vocal, crying sweep?",
    "options": ["Wah-wah", "Chorus", "Delay", "Compressor"],
    "answer": 0,
    "sauce": "It is a filter you steer with your ankle: rock the treadle and a peak in the tone sweeps up and down, which the ear hears as a voice saying a vowel."
  },
```

- `id` — unique, lowercase, `prefix_NN`. Nothing enforces the prefix; it is for
  humans reading a diff.
- `answer` — the INDEX into `options`, 0-based. Four options, always.
- `sauce` — one or two sentences, and **it is the point of the card**: it is shown
  whether the player was right or wrong, so it must reward being there rather than
  congratulating a win. Aim for the detail somebody repeats to a friend.

## How a question picks its own lane

There is no `lane` field, deliberately — 200 hand-typed lane tags is 200 chances
to file a question into the wrong economy. `triviaLane()` in `data/trivia.js`
derives it:

**RIG lane** (pays rig tiers — pool size and die size) if EITHER
- `era` is one of: `Theory, Gear & Studio Lore` · `Iconic Guitars & Their Players`
  · `Amps, Effects & Studio Gear`
- or `topic` is one of: `gear` `tuning` `studio` `technique` `effects` `theory`
  `instruments` `guitars` `bass` `amps` `synths` `drum machines` `samplers` `keys`
  `production` `tech` `sampling` `innovators`

**CROWD lane** (pays fans) — everything else. The decade eras (`The 1970s`,
`The 1990s`, …), `Blues & Early Jazz (1920s–40s)`, `Rock 'n' Roll (1950s)`, the
two `Famous Guest Appearances` eras, and topics like `scandal` `legend` `records`
`live` `myth` `rivalry` `lawsuit` `viral`.

🎯 **So the way to aim a batch at a bucket is to pick the era and topic**, not to
tag it. A 1970s question about a fuzz pedal lands in RIG; a 1970s question about a
hotel-room television lands in CROWD.

## The buckets, and the bar

Every combination of lane × difficulty is a real deck a player can ask for
repeatedly, so each one has to hold enough cards not to repeat inside a couple of
games. `selftest` asserts **≥ 15 per bucket** and fails loudly below that.

| | easy | medium | hard |
|---|---|---|---|
| 🎛️ RIG | 22 | 34 | 22 |
| 🎤 CROWD | 29 | 56 | 37 |

*(counts as of 2026-08-20 evening; 200 questions total)*

⚠️ **The thin end is RIG, and it matters more than CROWD.** Fans are one of
several routes to Fame; the RIG lane is the ONLY source of pool size and die size
in the entire game since the rig came off the skill tree. A player who wants a
louder amp has exactly one deck to draw from.

## House rules

- **Difficulty means "how many people know this", not "how obscure can I be".**
  Easy = anyone who likes music. Medium = anyone who plays. Hard = the person in
  the band who reads the liner notes.
- **Four plausible options.** Three obviously-wrong decoys turn a hard question
  into an easy one.
- **No trick questions and no "all of the above".** The bet a player makes at the
  card is on their own knowledge; it should not be on the question's honesty.
- **Facts that were true when written and stay true.** Avoid "the current
  record-holder for…".
- **Keep real people's dignity.** Rock history has plenty of documented mess in it
  without inventing any, and a `sauce` line should not read as a cheap shot.
- **A wrong answer costs nothing in this game.** Write to that: the reveal is a
  gift, so it can be generous and funny rather than consoling.

## What to ask for

> "Write 40 questions in this exact JSON shape for the RIG lane, split 25 easy /
> 15 medium, using the eras and topics listed above. No repeats of the subjects
> already covered: [paste the `question` lines you already have]."

Then paste the block in, run `npm run test:engine`, and check the bucket table it
prints back at you.
