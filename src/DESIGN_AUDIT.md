# Rock Legends: Spirit Wars — Design Audit

Audited against four lenses: **Simple · Thematic · Intuitive · Coherent** (does it create an arc of drama, solve a problem, lead to the goal?).

---

## 1. The verdict in one paragraph

You have one genuinely original, world-class idea — *the melody you build is your combat* — wrapped inside **four or five other complete games** that are all competing for the player's attention: a euro-style fan-economy sim, an RPG skill tree, a rock-history card deck, and three separate real-time twitch mini-games. None of those are bad. But together they bury the thing only *this* game can be. The reason it "isn't passing the test" is not that any one part is broken — it's that the **signal-to-noise ratio is too low**. The note track is a 10. Most of the rest is a 6 that's stealing the 10's oxygen. The fix is subtraction, not addition.

---

## 2. The spine worth protecting

These systems are the soul. They are simple, deeply thematic, intuitive, and coherent. Everything else should be cut or subordinated *to* them:

- **The Note Track** — build a melody from your stock each turn. This is the engine.
- **The Pivot** — declare a key (root + major/minor) before you play. One choice that re-frames everything. Elegant.
- **Interval effects** — the tritone is the devil's interval and doubles your damage. That is the single most thematic mechanic in the game. The 4th/5th resolve, the m7 drains, the major 3rd cleanses. Music theory *is* the rules.
- **Cadences** — multi-turn melodic objectives. The Deceptive Cadence ("promise resolution… then swerve to the relative minor — the audience gasps") is the best-designed thing in the whole project. It creates a 3-turn arc of tension and payoff that no other system matches. **This is the model the entire game should imitate.**
- **The Riffbook** — discover legendary riffs by spelling their intervals. Pure thematic delight, and the first-discovery race is real drama.
- **Knockback & edges** — get knocked off the stage. Clean, positional, thematic.

If you deleted everything in section 4's "Cut" list tomorrow, *this* would still be a complete, special game.

---

## 3. System-by-system audit

✓ = passes · ~ = weak/at-risk · ✗ = fails

| System | Simple | Thematic | Intuitive | Coherent | Verdict |
|---|:--:|:--:|:--:|:--:|---|
| Turn loop (pivot→build→commit→move→attack) | ✓ | ✓ | ✓ | ✓ | **Keep** — the spine |
| Note Track / Note Stock | ✓ | ✓ | ✓ | ✓ | **Keep** |
| The Pivot (key + major/minor) | ✓ | ✓ | ✓ | ✓ | **Keep** |
| Interval effects (tritone, m7, etc.) | ~ | ✓ | ~ | ✓ | **Keep, but ungate** (see §5) |
| Cadence objectives | ✓ | ✓ | ✓ | ✓ | **Keep & elevate** — the model |
| Riff library (34 riffs) | ✓ | ✓ | ✓ | ✓ | **Keep** (maybe trim count) |
| Harmonic Charge (upgrade currency) | ~ | ~ | ~ | ~ | **Keep but simplify** |
| Drive/Feedback pattern boosts + non-stacking | ✗ | ~ | ✗ | ~ | **Simplify hard** |
| Dischord → status effects | ~ | ✓ | ~ | ✓ | **Keep, consolidate statuses** |
| Sonic vs Swing combat | ✓ | ✓ | ✓ | ✓ | **Keep** |
| Amps / Roadies (rig logistics) | ✗ | ✓ | ~ | ✓ | **Keep but lighten** |
| Riff-off (real-time note duel) | ~ | ✓ | ~ | ~ | **Keep — it's combat** |
| Fan economy (Diehard/Casual/zones/demolition/Unsure) | ✗ | ✓ | ✗ | ~ | **Collapse to one track** |
| Fame Points | ✓ | ✓ | ✓ | ✓ | **Keep — the one goal** |
| Fame Sparks (4 = 1 FP) + Thousand Beats mash | ✗ | ~ | ✗ | ✗ | **Cut** |
| Win condition: Hold the Limelight | ✗ | ✓ | ✗ | ✗ | **Cut or fold into Fame** |
| Win condition: Last Spirit Standing | ✓ | ✓ | ✓ | ✓ | **Keep** (natural fallback) |
| Spotlight roaming heal | ✓ | ~ | ✓ | ~ | **Keep or merge** |
| Event spaces (11 cards) | ~ | ✓ | ~ | ~ | **Trim & de-RNG** |
| Back to the Past (piano mini-game) | ✗ | ~ | ✗ | ✗ | **Cut** |
| Mod cards (3) | ~ | ~ | ~ | ✗ | **Cut to 1 or zero** |
| Skill tree (8 routes, ~35 skills) | ✗ | ~ | ✗ | ✗ | **Cut to 3–4 routes** |
| Stage Effects route (% procs) | ✓ | ~ | ~ | ✗ | **Cut** |
| Spirit-exclusive routes | ~ | ✓ | ~ | ~ | **Shrink to 1–2 signatures each** |
| Mic / Mixer (bonus & parallel notes) | ✗ | ~ | ✗ | ~ | **Cut** |
| Spirits / stats | ✓ | ✓ | ~ | ~ | **Keep, fix naming** |

---

## 4. If this were my game

### CUT

- **The two extra win conditions as instant wins.** Four ways to win means no clear goal, and one of them (**Hold the Limelight**) is gated behind a *purchasable CQC skill* — a win condition you might never be able to access. That's incoherent. Keep **Fame** (the headline) and **Last Spirit Standing** (the natural fallback). Fold "holding center stage" into a big *Fame faucet*, not a separate victory.
- **Fame Sparks + Thousand Beats.** A collectible that converts 4:1 into the *other* Fame currency, harvested via a 5-second spacebar mash, is two layers of indirection and a tonal whiplash. Cut the sparks; if center-stage play should pay, pay Fame directly.
- **Back to the Past** (the two-stage piano challenge) and the **Thousand Beats** mash. Both are real-time dexterity mini-games stapled onto a contemplative, turn-based puzzle. They fight the game's pulse and cost enormous build/maintenance for a one-off novelty. (The riff-off survives because it *is* the combat resolution — it earns its real-time-ness.)
- **Stage Effects route.** Four skills that are all "33% chance: a dice modifier." Random procs with no player decision and no evolution — the opposite of the cadence's earned drama. Pure noise.
- **Mod Cards** (or cut from 3 to 1). Chromatic Shift / Transpose / Overdrive all do the same job — *rescue a dischord track* — which is *also* what the Theory route and the Discord route already do. Triple redundancy.
- **Mic (voice-roll bonus note) and Mixer (parallel notes).** Extra rules bolted onto the one mechanic that should stay clean.
- **~Half the skill tree.** Eight routes with sub-chains, two `__all_pa__`-style meta-prereqs, and costs of 8–20 HC when you earn a few per turn and a game ends at 25 Fame: most players will never see one route to its capstone. You are building and balancing content the player can't reach. Target **3–4 routes** total.

### CHANGE

- **Collapse six resources into three.** Right now a player juggles Vibe, Harmonic Charge, Fame Points, Fame Sparks, temp Drive boost, temp Feedback boost, *and* a crowd multiplier. That's the complexity tax. Target: **Vibe** (health) · **Harmonic Charge** (spend on upgrades) · **Fame** (win). Everything else either feeds one of those visibly or dies.
- **Fix the stat naming, then lock it.** The code still carries the scars of renaming: the data file's `sustain` field is the *defense* stat the tutorial calls **Feedback**, while a comment says "Sustain = max Vibe." "Feedback" for *defense* is also counter-intuitive — in audio, feedback is the offensive squeal, not a shield. Pick one trio and never rename again. Suggestion: **Drive** (attack) / **Sustain** (defense — you *sustain* the hit) / **Vibe** (health).
- **Kill the non-stacking boost conversion.** "Higher boost wins, the one it replaces converts to HC" is a rule players will never model in their heads while also tracking everything else. Either make Drive/Feedback runs give a *flat, immediate* effect, or fold them into HC scoring. Don't make the player do conversion arithmetic mid-melody.
- **Collapse the fan economy to a single visible Crowd track (1→3).** Diehards vs Casuals vs an "Unsure" pool, four zones, hardening, demolition lockout — it's a euro-game inside your rock game. Replace with one **Crowd meter** that multiplies Fame, rises with clean center-stage play, and drops when you're beaten in the spotlight. **Also: fix the contradiction** — the code caps the multiplier at **1.8** (`FAN_MULT_CAP`) but the tutorial promises **×3**. Rules-as-coded and rules-as-taught disagree.
- **Ungate the interval effects, or teach that they're locked.** The tutorial's "Interval Effects" page presents tritone-doubles-damage, m7-drains, maj3-cleanses as *base* mechanics. In code they're unlocks on the Discord skill route (Devil's Interval, Blues Lick, Borrowed Chord). A new player will try the tritone, watch nothing happen, and feel the game lied. Pick one: make them base, or make the tutorial say "you'll unlock these."
- **Consolidate status effects from ~8 to ~4.** Stagger, Mojo Drain, Burn, Shield are distinct and thematic. Trip / Drop Instrument / Dazed / Confused are four overlapping random-proc swing riders. Merge them into one or two.
- **De-RNG the events.** Cards like Payola ("even = +2 HC, odd = −2 HC") are pure coin-flips with no decision. Keep the gorgeous rock-history flavor (Disco Inferno, 27 Club Séance, Divine Mission), but give each a *choice* or a *positional* element so it's a play, not a die roll. Trim 11 → ~6 great ones.

### ADD

- **One legible goal readout.** "First to 25 Fame." Every system should visibly pour into that one meter, with floating "+Fame" feedback, so the player always knows *why* they're doing a thing. Right now Fame arrives from four sources through two conversions; make the throughline impossible to miss.
- **Make the consonance → dissonance arc the explicit progression** (see §6). It's the dramatic spine you already half-built — surface it.
- **A stripped "First Gig" mode.** Given the surface area, a reduced-rule onboarding (note track + intervals + cadences + basic combat, nothing else) lets a new player feel the magic before the systems pile on.

---

## 5. Specific contradictions / debt found in the code

1. **Crowd multiplier:** `FAN_MULT_CAP = 1.8` vs tutorial "×3 ceiling." Contradiction.
2. **Win condition gated behind a purchase:** Limelight victory requires buying the `hero_pose` CQC skill. A core win path you may never unlock.
3. **Stat naming churn:** `data/spirits.js` uses `sustain` for the stat the UI labels **Feedback**; an inline comment claims "Sustain = max Vibe." Three names, two meanings, one field.
4. **Interval effects taught as base, coded as unlocks** (Discord route). Tutorial/engine mismatch.
5. **Two parallel "fix your dischord" systems** (Mod Cards *and* the Theory/Discord routes) that don't reference each other.
6. **Theory is the game's namesake but locked at start:** everyone begins on a 5-note pentatonic; the full scale, minor, and the interval colors are all purchases. Defensible as a ramp — but it means the "powered by music theory" fantasy is mostly behind a paywall of HC for the first several turns. Make sure the *first* turn already feels musical.

---

## 6. Answering your drama question directly

You asked whether each system creates "a pattern for evolution that creates drama and excitement." Here is the arc the game is *trying* to be, and should commit to:

> **Consonance is safe and small. Dissonance is risky and huge. Progression is learning to control the dissonance.**

- **Early game:** you're on the pentatonic. You play it safe — end on the 4th or 5th, bank small steady Fame, grow the crowd. Low risk, low reward. (This is the "I" of a cadence.)
- **Mid game:** you learn theory and *unlock dissonance as power* — the tritone doubles damage, the chromatic run staggers, the Deceptive Cadence swerves to the relative minor for a big payout. Every risky note now *means* something.
- **Late game:** you're bending the whole chromatic scale, chaining cadences, racing rivals to undiscovered riffs. Maximum risk, maximum Fame.

That arc — **safe consonance → controlled dissonance → virtuosic chaos** — is genuinely thrilling and *only your game has it.* The cadence system already nails it in miniature (tension → swerve → payoff). The problem is that the skill tree, fan sim, sparks, mod cards, and mini-games run *orthogonal* to this arc instead of expressing it. Cut the orthogonal stuff and let the consonance-to-dissonance journey *be* the progression. That's your "pattern for evolution," and it solves the goal-and-drama test on its own.

---

## 7. The minimal core (if you stripped it to its best self)

Vibe / Sustain / Drive. A note track you pivot, build, and commit. Intervals with effects. Cadences and riffs for Fame. Amps to plug in, Sonic vs Swing to fight, knockback off the edge. One Crowd meter that multiplies Fame. One Harmonic Charge track feeding **3–4** upgrade routes that deepen the consonance→dissonance arc. First to 25 Fame, or last act standing.

That game is tight, thematic, intuitive, coherent — and unmistakably *yours*. Everything in the Cut list can come back later as expansions, once the core is undeniable.
