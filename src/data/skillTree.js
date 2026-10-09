// ─── THE SKILL TREE ─────────────────────────────────────────────────────────
// Four routes of unlockables, and the flat `skillId → def` lookup built off them.
//
// ⚠️ EXTRACTED FROM THE MONOLITH 2026-08-16 — and this was not tidying, it was
// the single thing standing between the §6.6 bot bench and every design question
// the bench exists to answer.
//
// `legalActions` emits the `skillUnlock` family only when the caller hands it a
// `skillById` view, because SKILL_TREE lived in `rlsw-simulator-v3_8_1.jsx` and
// §6a's rule is that a family the generator cannot see is ABSENT rather than
// guessed. That was the honest call. But it meant every headless match was
// played on BASE KITS — so the bench could say nothing at all about any unlock,
// which in Metalness's case is his ENTIRE rework (`METALNESS_REWORK_DESIGN.md`:
// the Tentacle, Goes to 11 and Master of Moshpits are all purchases), and
// nothing about §7's Smash question either.
//
// ⚠️ IT IS DATA, NOT PRESENTATION, DESPITE THE `desc` STRINGS. Every field the
// engine reads — `id`, `gated`, `spiritOnly`, and the route/chain
// position `SKILL_BY_ID` derives — is a RULE. `label`, `icon` and `desc` ride
// along because splitting them would fork one list into two that must agree,
// and a fork is how a tree grows a skill the engine has never heard of.
//
// 📌 The thirteen tuning numbers the descriptions interpolate moved to
// `gameConstants.js` in the same pass, for the same reason: a cooldown or a range is
// a rule, and it cannot live where the engine cannot read it.

import {
  SUNBEAM_BLIND_TURNS, SUNBEAM_LINGER_CHANCE, SUNBEAM_MAX_BLIND_TURNS,
  DISPLACE_MIN_RINGS, DISPLACE_MAX_RINGS,
  GRAVITY_PLACE_RINGS, GRAVITY_PULL_RINGS, GRAVITY_PULL_HEXES, GRAVITY_NOTE_DRAIN,
  DISPLACE_CD, GRAVITY_CD, CODE_INJECT_CD, SUNBEAM_CD,
  PSYCHO_BUSHIDO_CD, SHADOW_ILLUSION_CD, CURSED_SHAMISEN_CD,
  PSYCHO_BUSHIDO_MIN_RANGE, PSYCHO_BUSHIDO_MAX_RANGE, PSYCHO_BUSHIDO_AP_COST, psychoBushidoD8s,
  PSYCHO_BUSHIDO_STACK_COST, SHADOW_ILLUSION_TURNS,
  SHUKUCHI_CD, SHUKUCHI_MAX_HOPS, SHUKUCHI_HOP_RINGS, SHUKUCHI_AP_PER_HOP,
  SHADOW_ILLUSION_SUSTAIN_DRAIN,
} from "./gameConstants.js";

export const SKILL_TREE = {
  // 🎨 No route carries a colour: every route is one Spirit's, and a Spirit's only
  // colour is its PLAYER'S (Alex, 2026-09-25). Readers use the seat's `color`.
  routes: [
    // ── 🛑 THE MUSIC THEORY BRANCH IS GONE (2026-09-02) ─────────────────────
    //
    // There was a `theory` route here: The Full Scale, Minor Tonality,
    // Blues / Dominant 7th, Modal Colour and Chromatic Mastery — 52 Db, and after
    // the rig branch went it was the LAST shared ladder in the game.
    //
    // 🎯 IT WAS DELETED BECAUSE IT WAS TOO GOOD, NOT BECAUSE IT WAS BAD.
    // `GAME_BRIEF.md` §16 problem #1 — "Theory is close to the only ladder, and
    // buying it is close to automatic" — was the most valuable open problem in the
    // project, and it is closed by moving the branch's five jobs somewhere better
    // rather than by re-pricing a purchase nobody was really choosing:
    //
    //   stack seats 4/5/6   → 🅰️ FOUND ON THE BOARD. Walk onto a Lost Chord that
    //                         extends your stack's root and the seat it opens is
    //                         the seat it fills. `music/stackSlots.js`.
    //   the pardon ladder   → 🅱️ UNIVERSAL AND FREE, from turn one. Chord-tone
    //                         pardon, play the changes, extensions, approach
    //                         notes. `music/context.js` — `tiersFor` no longer
    //                         asks what you own.
    //   scale expansion     → 🅱️ THE GATE IS GONE AND THE WIDENING WENT WITH IT.
    //                         Everyone opens on the Major Pentatonic (natural
    //                         minor in minor) and your CHORD legalises the rest.
    //                         ⚠️ Alex's call, 2026-09-02, and it is the opposite
    //                         of the obvious read: handing everyone the full modal
    //                         palette would have DELETED the colour payout, because
    //                         a note that is merely in-scale pays nothing while a
    //                         note your stack pardons pays Drive or Sustain.
    //   52 Db of sink       → 🅳 CLOSED 2026-10-02 BY DELETION: Db itself was cut,
    //                         so there is no surplus left to sink. The planned
    //                         upgrade streams (`PROGRESSION_REWRITE_DESIGN.md` §5)
    //                         are cancelled with it.
    //
    // ⚠️ DELETED RATHER THAN DEPRECATED, exactly as the rig branch was. Anything
    // still asking for `theory_major`, `theory_minor`, `theory_dom7`,
    // `theory_modes` or `theory_chromatic` must now fail loudly instead of quietly
    // buying nothing. 📌 `theory_sus` never existed in this tree at all — it was
    // read by `melodyCommit.js` for months against a skill no route sold.
    // ── 🛑 THE RIG BRANCH IS GONE (2026-08-20) ──────────────────────────────
    //
    // There was an `electric` route here: Amp I–III, Power I–III, Range I–III and
    // Overcharge — 110 Db, the single largest sink in the game, against 52 for
    // the whole Theory route.
    //
    // ⚠️ IT IS DELETED RATHER THAN DEPRECATED, and anything still asking for
    // `amp_*`, `power_*` or `range_*` must now fail loudly instead of quietly
    // buying nothing. The rig is not a purchase any more:
    //
    //   pool size + die size → won at the marquee quiz's RIG lane, spent at the
    //                          card, shed by atrophy (MARQUEE_QUIZ_DESIGN.md §4–§5)
    //   radius               → `RIG_RADIUS_FLOOR + stack length`, breathing with
    //                          Drive on your turn and Sustain on theirs (§5.H⁶)
    //
    // 📌 AND THE Db HOLE IS REAL AND DELIBERATE (design doc §7). Removing the
    // biggest sink in the game leaves Db piling up against a tree that cannot
    // absorb it. Alex's answer is to grow the ABILITY tree so a character's kit
    // develops over a match.
    //
    // 🎯 HALF OF THAT ARRIVED 2026-08-22, FROM AN UNEXPECTED DIRECTION. The rule
    // that every ability costs Db PER USE is a sink that needs no new rungs at
    // all: seven abilities now draw on the same bar the tree does, every turn
    // they are used, so surplus Db has somewhere to go without the tree growing
    // a single row. ⚠️ It does NOT close the hole on its own — six abilities are
    // still free, and a Spirit who buys nothing still banks everything — but a
    // bench's Db numbers are no longer measuring a pool with no outlet.
    // 🪦 AND THE WHOLE QUESTION IS GONE NOW (2026-10-02): Db was cut, so there is
    // no hole to fill. Read the two paragraphs above as history.
    //
    // ⚡ Overcharge went with it, by decision rather than by accident: it was the
    // Charge Zone's choose-your-payoff modal, gated behind Amp II. With the amps
    // gone it had no gate left, and a free 12 Db upgrade reachable on turn two is
    // a different skill from the one that was designed. Tapping a zone now always
    // takes the ordinary 50/50 spark — which is also what the headless path has
    // always done, so the client and the engine agree for the first time.
    // ── SIGNATURE ARSENALS — one compact route per Spirit (hidden from the others) ──
    //
    // 🪦 NO ABILITY CARRIES A PRICE ANY MORE (2026-10-02). The flat 6 Db unlock
    // (`dbCost`) went first — the draft hands each seat two abilities, ready — and
    // then Db itself was cut (Alex: "the cooldowns and 'sacrifices' are the gate,
    // not another economy"). What gates an ability now is its cooldown and what it
    // makes you give up, and every `desc` below says which. ⚠️ Do not re-add a
    // `dbCost`: nothing reads it, and `skillTreeCheck` asserts its absence.
    {
      id: 'shredding_ronin',
      label: 'Shredding Ronin',
      icon: '🗡️',
      desc: 'The way of the blade meets the way of the riff. An exclusive arsenal only the Ronin can wield.',
      spiritOnly: 'cosmic_ronin',
      skills: [
        // 🌀 SHUKUCHI IS FIRST IN THE ROUTE, AND THAT IS DELIBERATE. It is the
        // cheapest thing in his kit and the only one that does not need a rival
        // on the board to be worth anything, so a Ronin who buys nothing else
        // still has a reason to walk somewhere. ⚠️ The `desc` sells the AP bill
        // in the first sentence: the trap for a new player is reading "six hexes"
        // and not "three of your steps".
        { id:'shukuchi',        label:'Shukuchi Arpeggio (縮地)', icon:'🌀', gated:false,
          desc:`Shrink the earth — each step you take becomes a ${SHUKUCHI_HOP_RINGS}-hex LEAP, up to ${SHUKUCHI_MAX_HOPS} of them, and each leap still costs ${SHUKUCHI_AP_PER_HOP} Action Point exactly like walking. ⚠️ THREE LEAPS IS THREE OF YOUR STEPS — six hexes of ground for the price of three, not for free. You may take one, two or three, and each one picks its own direction. 🌀 NOTHING STOPS YOU IN THE AIR: bodies, hazards, walls and 🐙 poison slime all pass underneath, and only the hex you LAND on has to be empty. 🎵 Every landing picks up a Lost Chord note you touch down on. ⚠️ You end up facing the way you last leapt, so line up the strike with your final hop. ${SHUKUCHI_CD}-round cooldown — and the clock starts on the FIRST leap, so a Ronin who hops once and thinks better of it has spent the whole ability.` },
        { id:'psycho_bushido',  label:'Psycho Bushido',  icon:'🌀', gated:false,
          desc:`Iaijutsu draw — strike a rival standing ${PSYCHO_BUSHIDO_MIN_RANGE} to ${PSYCHO_BUSHIDO_MAX_RANGE} hexes DIRECTLY IN FRONT of you. ⚡ THEY BRACE, YOU BURST: the rival throws their Sustain as a shield, then you throw your Drive and charge on your dice — and each die you keep hits the shield in turn. Whatever gets THROUGH is the damage, and pushes them back a hex for every 2 points that got through. If the shield holds, nothing happens to either of you. ⭐ THE FARTHER THE DRAW, THE BIGGER YOUR DICE: ${psychoBushidoD8s(PSYCHO_BUSHIDO_MIN_RANGE)} of your d6s become d8s at ${PSYCHO_BUSHIDO_MIN_RANGE} hexes, ${psychoBushidoD8s(4)} at 4, ${psychoBushidoD8s(PSYCHO_BUSHIDO_MAX_RANGE)} at ${PSYCHO_BUSHIDO_MAX_RANGE}. ⚠️ TOO CLOSE AND YOU CANNOT DRAW AT ALL — there is no run-up, and a rival at 1 or 2 hexes is simply not a target. Any body in the lane blocks it, your own 👤 shadow included. You arrive on the hex in front of them with your guard down. ${PSYCHO_BUSHIDO_AP_COST} Action Points flat, ${PSYCHO_BUSHIDO_CD}-round cooldown — and ⭐ IT BURNS ${PSYCHO_BUSHIDO_STACK_COST} NOTES OFF THE TOP OF YOUR DRIVE STACK before the dice. Losing notes RE-POINTS what you are hunting on the board, so a draw is a choice about your chord as well as about your rival.` },
        { id:'shadow_illusion', label:'Shadow Illusion', icon:'👤', gated:false,
          desc:`Split into a second, identical Ronin, born stacked on your own hex (${SHADOW_ILLUSION_CD}-round cooldown) — nobody sees which one appeared. Rivals cannot tell the double from the real you: it blocks, it faces, and it walks the board on its own steps, refreshed each turn to match your movement range at no cost to your Action Points. 🎵 It can also PICK UP LOST CHORD NOTES for you — an illusion made of sound can carry a sound. It cannot take ⚡ charge zones or 🎪 event spaces, and hazards pass straight through it. ⚠️ IT FEEDS ON YOU: ${SHADOW_ILLUSION_SUSTAIN_DRAIN} Sustain at the start of every turn it stands, and it comes apart the moment you have none to give — you are at your most fragile exactly while nobody can tell which body to hit. Lasts ${SHADOW_ILLUSION_TURNS} turns. Pops if it is struck, if you attack, or if you are attacked. Whoever attacks it burns their AP and Action Token for nothing.` },
        // 🎸 THE IWATO CURSE — v3 "THE TRAP" (Alex, 2026-10-09,
        // `IWATO_CURSE_V3_SPEC.md`). The numbers in this text are the rules' own:
        // 3 haunted notes / 3 cursed turns are `board/cursedShamisen.js`. ⚠️
        // Written as literals because importing `iwatoCurse.js` here would loop
        // through `cooldowns.js`, which imports this file — `test:shamisen` pins
        // the text to the numbers.
        { id:'cursed_shamisen', label:'Cursed Shamisen', icon:'🎸', gated:false,
          desc:`Set a hidden trap. 🪤 Spend your Action Token to stick a 呪 NOROI CARD on one Lost Chord anywhere on the board — only you can see it (${CURSED_SHAMISEN_CD}-round cooldown). It holds its hex until the start of your next turn; if nobody takes it, the card burns to ash in front of everyone. 🌑 The rival who picks it up banks the note — and is CURSED: their Scale Wheel becomes Iwato, the haunted Japanese scale (1 ♭2 4 ♭5 ♭7), on THAT note, so every other note in their hand is discord: no fans. 👻 Three haunted notes are marked on their wheel; each one they play in a melody lifts a ghost, and all three lift the curse. It lasts 3 of their turns — the one they stepped on it counts, so they get two melodies to lift it — and the curse seeps into the notes they draw (⅓ of their in-key notes come up Iwato, then ⅔). Take your own cursed note and the card simply burns. One curse at a time.` },
      ],
    },
    {
      id: 'metalness',
      label: 'Metalness Monster',
      icon: '🤘',
      desc: 'Dripping poison, summoning mosh pits, invoking the Beast. An exclusive arsenal only the Monster can wield.',
      spiritOnly: 'Metalness_Monster',
      skills: [
        { id:'goes_to_11',      label:'Goes to 11',         icon:'🔊', gated:false,
          desc:'SETS your attack to exactly 11 for the turn — not a bonus, a setting, so it beats the bonus cap. ⚠️ If you were already louder than 11, it turns you DOWN: the amp only goes to eleven. You also shrug off knockback. It costs your whole Sustain stack, and it blows your amp — no Sonic at all and a bare d4 on defence until your rig comes back a turn later. Recharges in 2 rounds.' },
        { id:'master_moshpits', label:'Master of Moshpits', icon:'🤘', gated:false,
          desc:'Pulls 3 fans out of the stands and onto the board for a pit. +2 Drive that STANDS — it survives battles and lasts until you call the next pit. Recharges in 2 rounds.' },
        { id:'tentacle',        label:'Tentacle',           icon:'🐙', gated:false,
          desc:'Thrash from any hex of your SLIME TRAIL instead of from where you stand — and the trail you reach THROUGH is consumed. Next to the nearest slime costs 1 hex; three hexes down the road costs 3. It does not move you and it does not turn you, so reaching behind means the rival in front is hitting your back. Range is real, and you pay for it in road. Recharges in 2 rounds.' },
      ],
    },
    {
      id: 'intergalactic',
      label: 'Intergalactic 0',
      icon: '🌀',
      desc: 'Cosmic groove and weaponized sound. An exclusive arsenal only Intergalactic 0 can wield.',
      spiritOnly: 'intergalactic_0',
      skills: [
        { id:'blaster_of_ra', label:'Blaster of Ra', icon:'🌀', gated:false,
          desc:'REPLACES the Smash. A ranged, PIERCING bass-drop: hurl your unused stock down the forward beam, hammering EVERY rival in line — undefendable, scattering their stock and knocking them back. Leaves you Exposed. Recharges in 2 rounds.' },
        { id:'displace', label:'Space is Displaced', icon:'🌌', gated:false,
          desc:`He can't run — he warps. Fold space and appear instantly on any open hex ${DISPLACE_MIN_RINGS} or ${DISPLACE_MAX_RINGS} rings away. ${DISPLACE_CD}-turn cooldown, no Action Points, no rig required. Too close doesn't count: he steps THROUGH the space between, not across it.` },
        { id:'gravity_control', label:'Gravity Control', icon:'🕳️', gated:false,
          desc:`${GRAVITY_CD}-turn cooldown. Tear open a BLACK HOLE VORTEX on any hex within ${GRAVITY_PLACE_RINGS} rings. Every rival within ${GRAVITY_PULL_RINGS} rings is dragged ${GRAVITY_PULL_HEXES} hex toward it — and anyone pulled all the way INTO it watches ${GRAVITY_NOTE_DRAIN} notes get swallowed, ${GRAVITY_NOTE_DRAIN} fewer in their pool next turn. The vortex hangs there for one full round, catching anyone who wanders too close, then collapses. Gravity is his to command: it never touches him.` },
        { id:'code_injection', label:'Code Injection', icon:'💻', gated:false,
          desc:`${CODE_INJECT_CD}-turn cooldown. Slip a patch into the fabric of the fight — then say nothing. For one full round, the FIRST rival whose attack would beat you has their dice thrown out and re-rolled, and they live with whatever comes up second. Nobody can see that you've committed: no aura, no tell, no marker on your standee. If nobody attacks, or nobody lands, the cooldown is simply spent. That's the bet.` },
      ],
    },
  ],
};
// Flat lookup: skillId → skill def (including which route/chain it belongs to)
/**
 * Flat lookup: skillId → skill def, carrying its route and chain position.
 *
 * ⚠️ `spiritOnly` IS PUSHED DOWN FROM THE ROUTE, AND IT USED NOT TO BE — that
 * omission was a live ownership hole, found 2026-08-16 the moment this tree was
 * first handed to the engine.
 *
 * Exclusivity is declared once, on the ROUTE ("this whole ladder belongs to the
 * Ronin"), which is the right place to declare it. But the old builder copied
 * only `sk` and `route.id` down, so `skill.spiritOnly` was `undefined` on every
 * one of the 28 skills — and BOTH consumers of that field were reading a value
 * that never existed:
 *
 *   · `legalActions` resolves ownership from `skill.spiritOnly`, so its gate
 *     could never fire. It had simply never been exercised, because SKILL_TREE
 *     was in the monolith and the `skillUnlock` family is absent without it.
 *   · `bot.js` went the other way round, through a HAND-MAINTAINED map
 *     (`SPIRIT_ONLY_ROUTE`) — which had two of the three exclusive routes in it
 *     and was silently missing `intergalactic`. That one was live in the
 *     shipped bot: any Spirit could buy Intergalactic 0's exclusive route.
 *
 * Two consumers, two different derivations of one fact, and a hand-written map
 * as the second source of truth. Pushing it down fixes both at once and deletes
 * the map's reason to exist — see `SPIRIT_ONLY_ROUTE` below, now DERIVED.
 */
export const SKILL_BY_ID = (() => {
  const map = {};
  for (const route of SKILL_TREE.routes) {
    // ⚠️ `?? null`, not a bare spread: an explicit null says "shared route,
    // asked and answered", where an absent key reads the same as "nobody has
    // populated this yet" — which is exactly how the hole above went unnoticed.
    const owned = route.spiritOnly ?? null;
    if (route.skills) {
      for (const sk of route.skills) {
        map[sk.id] = { ...sk, routeId: route.id, spiritOnly: sk.spiritOnly ?? owned };
      }
    }
    if (route.subChains) {
      for (const chain of route.subChains) {
        for (const sk of chain.skills) {
          map[sk.id] = { ...sk, routeId: route.id, chainId: chain.id, spiritOnly: sk.spiritOnly ?? owned };
        }
      }
    }
  }
  return map;
})();

/**
 * routeId → the only Spirit who may climb it. DERIVED from the tree.
 *
 * ⚠️ THIS WAS A HAND-WRITTEN LITERAL IN `bot.js` AND IT WAS WRONG — it listed
 * `shredding_ronin` and `metalness` and omitted `intergalactic`, so the bot's
 * eligibility check waved Intergalactic 0's exclusive route through for every
 * Spirit on the board. A map that must be kept in step with a tree by hand will
 * eventually not be; deriving it means adding an exclusive route to the tree is
 * the only edit an exclusive route needs.
 */
export const SPIRIT_ONLY_ROUTE = Object.fromEntries(
  SKILL_TREE.routes.filter(r => r.spiritOnly).map(r => [r.id, r.spiritOnly]));
