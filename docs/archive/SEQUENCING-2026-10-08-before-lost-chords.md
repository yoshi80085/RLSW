# SEQUENCING §A archive — `63-hammeron` (moved 2026-10-08, before the Lost Chord crystals)

> Moved out of `src/SEQUENCING.md` §A when `64-lostchords` became the live handoff. Unedited.

## 63-hammeron. The Ronin's hammer-on / pull-off — designed, previewed, dialled, ported — 2026-10-07/08

**Alex:** *"Each Spirit should get a way to 'manipulate' notes in their stock
somehow. So take Ronin - what if he could 'hammer on' notes in his melody line?
He would get 1 hammer on technique per turn - potentially carrying over for a max
of 2 … He commits 2 notes, doesn't have the 3rd, he can push the 'h' keystroke or
'hammer on' button - it adds a 3rd note to the melody line - either a step up or
down. While not a note committed from the pool, it nevertheless adds a note to the
melody and counts as a note played."* Then: *"lets have it be 'smart' - the button
only available if it senses it can be used in a correct way"*; the preview's
dial-in, **0 of 24 levers moved**; and *"this system as it is - is designed only
for Ronin as of now, other Spirits aren't touched"*.

### His rulings
- 1 charge a turn, a bank of 2; **both charges may go on one melody** (over my one-per-melody advice).
- Smart: it adds the note that continues the line's last move (a step finishes the shred, a third the arpeggio skip); it lights whenever it continues the shape and **says what it pays**.
- It does **not** count toward lifting an Iwato curse. Up = **Hammer-on**, down = **Pull-off**.
- It **counts toward movement** (10-08). Taking back the note it was played off **takes it too and refunds the charge** (10-08).
- ⭐ **Ronin only.**

### What shipped
- **The rule:** `music/noteTechniques.js` — `hammerCandidate` asks the payout's OWN readers (`spiritStyle.js` `trailingContour`, a new additive export; `melodyPayout.js` `craftRunFor`), so the button can never promise fans the commit refuses. `hasHammerOn` is the one Ronin gate; `isTechniqueSrc` / `playedNotes` / `hammerRecharge`.
- **Charges:** dealt 1 (`economy.js` `makeInitialNoteState`), +1 at his own **turn END** (`turn.js` `applyTurnEnded`), capped at 2. ⚠️ Turn END, not start, because the client never runs a turn start for seat one's first turn — a turn-start grant would have given a seat-one Ronin nothing on turn 1 and a seat-two Ronin his. Other Spirits' sheets stay byte-identical.
- **The track:** a hammered note's `melodySrcIdx` is `'hammer'` / `'pull'` (never a hand slot), so every existing splice keeps it aligned; `removeMelodyNote` cascades and refunds; `clearNoteTrack` refunds; the commit pays and moves it as any note and `melodyCommit.js` leaves it out of the exorcism.
- **The client:** `hammerOn()` beside `removeMelodyNote`; H in `keyboardNoteCommit` (Ronin only — H is not a note letter); the own-row button above ✓ Commit; the plate pips; the ghost of the next note (click = hammer); the gold slur with h / p; the strike-in; the legato KATANA (`hammerVoice`, through `playNoteSound`). Human only — bots don't hammer yet.
- **One copy of the picture:** `ui/HammerOn.jsx` (`HAMMER_LOOK` = the dial-in). The preview `.scratch/hammer-on-preview.html` now imports it and builds its levers from it.

### Found on the way
- ✏️ My 10-07 spec said the button stays dark climbing from A♭ (no B in Hirajoshi). Building it showed the craft run counts A♭ → C as a step, so it lights on C (+1 fan). Corrected in `MELODY_IDENTITY_DESIGN.md` §13.2.
- In a six-note scale the degree wraps: C → G is a skip *down*, so C G offers a pull-off to E♭ ("no new fans").

### Evidence
- `test:notetechniques` **50** (rule cases, the payout match, a 12-root sweep, the A♭ gap, the engine half; 7 mutants caught). `test:hammeronjourney` **30** (new — the real `Game` by keys and clicks, incl. the next Spirit getting nothing). Both in `test:all`.
- The full sweep in the cloud on a copy of the disk with real node_modules: 91 of 96 green. The five red are not this change: `test:bushido` (the Shadow call), `test:abilitydemo` (the old preview-lever red), `test:bushidoui` (needs a file in `Claude outputs/`, not copied), `test:swing` (expects `fallen` after a knockdown — red at HEAD too since the 10-07 knockdown ruling), `test:arch` (fixed after the sweep: two new rows). `harness` 1747 / `trace` 2448 identical at HEAD.
- `check:bundle` zero warnings. The real Game rendered in Chromium: the dark button, the lit "🔨 HAMMER-ON → B♭ · +1 fan", the slur, the plate, "3 notes → 3 hex".

### 🎤 Same day, later: the fans learn it (brain built, bubble in preview)
Alex: *"I'm wondering about the fan's hints … Would this be substantial work making
sure the system knows when its best to use?"*, then *"lets plug that in … simple is
best - your 3 points covers it"*. The three rules: ask when it pays more fans;
holding both charges, ask anyway (or the next charge is wasted); otherwise nothing.
- **Finder** (`playFinder.js`, opt-in `opts.techniques`): a hammer move in the line search (`hammerCandidate`'s note, a charge not a hand note). Bounds get one bonus copy of every palette note per charge left, which is looser and slower but never too tight. Hammered notes count as spent, so a non-paying hammer never wins. `hammerTopUp` covers rule 2. `test:playfinder` 767; §8 is brute force with the hammer move, plus legality, the commit paying what the finder says, rules 2 and 3, Alex's own example, and another Spirit never getting one.
- **Crowd** (`crowdCoach.js`): `techs` / `idx: null` / `hammerNext` on asks, and `hammer_up` / `hammer_down` / `hammer_full` in both voices. `CROWD_HAMMER` holds first guesses. `CrowdBubbleCard` draws the hammered chip (gold + h / p) and an [H] key. `HammerButton` gained `coach` (pulse / ring). All of it is inert in the live game until `techniques` is switched on. `test:crowdcoach` 1561, `test:crowdbubble` 119.
- **Preview:** `.scratch/hammer-on-hints-preview.html` (`npm run dev:hammerhints` / `build:hammerhints`, artifact *Hammer-On Hints Dial-in*). Six states computed live, today beside the new hints.
- ⚠️ The finder is ~3× slower with charges (median 0.7–0.9 s, worst 2.5 s, worker-side). Rule 2 buys a hex only under speed, so its words were changed not to promise one.
- ✅ **Ported the same day** (Alex: *"everything sounds good, lets wire it in"*, 0 levers moved): `crowdFinderClient` asks with `techniques` on the melody step only (the chord step's searches are unchanged) and slims `hammerCharges` across; `useCrowdCoach` keys on `hammerCharges`; the client lights `HammerButton coach` from `crowdShown.hammerNext`. 🐛 The worker had been dropping `unavailable` (staggered slots) — fixed. `test:crowdbubble` 128 (§5). In headless Chromium on the real Game with fan hints on, after G A♭ B♭ C D♭ (root F) the button pulsed and the ghost F waited; after H it stopped. The bubble wasn't drawn there (no 3D grandstand headless).

### Next
1. Alex plays the hammer-on in a real match (Testing Grounds is quickest), and dials in the hints page.
2. ⁉️ Open: the commit's replay plays a hammered note as a picked one; bots don't hammer; Free play doesn't refill charges.
3. The other Spirits' techniques are undesigned (Alex: Ronin only for now).


---

