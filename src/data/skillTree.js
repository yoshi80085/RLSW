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
// engine reads — `id`, `dbCost`, `gated`, `spiritOnly`, and the route/chain
// position `SKILL_BY_ID` derives — is a RULE. `label`, `icon` and `desc` ride
// along because splitting them would fork one list into two that must agree,
// and a fork is how a tree grows a skill the engine has never heard of.
//
// 📌 The thirteen tuning numbers the descriptions interpolate moved to
// `gameConstants.js` in the same pass, for the same reason: a Db price is a
// rule, and it cannot live where the engine cannot read it.

import {
  SUNBEAM_DB_COST, SUNBEAM_BLIND_TURNS, SUNBEAM_LINGER_CHANCE, SUNBEAM_MAX_BLIND_TURNS,
  DISPLACE_DB_COST, DISPLACE_MIN_RINGS, DISPLACE_MAX_RINGS,
  GRAVITY_DB_COST, GRAVITY_PLACE_RINGS, GRAVITY_PULL_RINGS, GRAVITY_PULL_HEXES, GRAVITY_NOTE_DRAIN,
  CODE_INJECT_DB_COST,
} from "./gameConstants.js";

export const SKILL_TREE = {
  routes: [
    // ── THE LADDER — Music Theory (universal spine: the consonance→dissonance arc) ──
    // Everyone starts on the Major Pentatonic. Climbing the ladder unlocks a wider,
    // riskier, higher-Fame palette. This route ABSORBS the old Discord path — the
    // colour notes (Blues 7th, Devil's Interval, Chromatic, Borrowed Chord) arrive
    // as you learn the theory that justifies them (see applySkillEffects).
    // B1 stripped their combat riders; B3 gives the same tiers a real mechanic —
    // each one widens how far your chord's permission reaches into the melody.
    {
      id: 'theory',
      label: 'Music Theory',
      icon: '🎼',
      color: '#66ccff',
      // B9: was "Start on the Major Pentatonic", which contradicted the free
      // theory_major grant. (For most of this branch's life the blurb was accurate
      // by accident, because the grant was broken — see the initial-skill effect.)
      desc: 'The spine of the game. You start with the full Major scale. Each rung does two things: it widens what your CHORD can make legal, and it gives you room to build a bigger chord — and the bigger the chord, the more it pays to land your line on it.',
      skills: [
        // B9: every desc now states all three things a tier can give — the SCALE
        // expansion (what the key allows), the CONTEXT TIER (what your stacks
        // pardon, B3's ladder) and the SLOT unlock (B0b). Before B9 they mentioned
        // only the first, which left the branch's actual mechanic undocumented in
        // the one place a player goes to read about it.
        { id:'theory_major',     label:'The Full Scale',       icon:'🎼', dbCost:6,  gated:true, prereq:null,
          desc:'Adds the 4th & 7th, completing the Major (Ionian) scale — those two notes stop costing Discord.' },
        { id:'theory_minor',     label:'Minor Tonality',       icon:'🌑', dbCost:8,  gated:true, prereq:'theory_major',
          desc:'Unlocks the Minor scale — stack a minor third and the song follows you into a darker key, Discord-free. And it opens the ladder: CHORD TONE PARDON — any note sitting in your Drive or Sustain stack is never Discord, whatever the key says. Colour notes your chord legalizes pay Drive or Sustain.' },
        { id:'theory_dom7',      label:'Blues / Dominant 7th', icon:'🎷', dbCost:10, gated:true, prereq:'theory_minor',
          desc:'The ♭7 joins your clean palette. PLAY THE CHANGES — the pardon widens from the notes you placed to your stack\'s whole implied chord, completed to its seventh: a C-E-G stack makes B clean though you never stacked it. +1 STACK SLOT (4) — the lesson that teaches you the blues note also lets you build the dominant 7th.' },
        { id:'theory_modes',     label:'Modal Colour',         icon:'🌀', dbCost:12, gated:true, prereq:'theory_dom7',
          desc:"Lydian ♯4 & Mixolydian ♭7 become clean, and the tritone never breaks harmony. EXTENSIONS — the pardon reaches your chord's available tensions by quality: ♯4 over major, natural 6 over minor, ♭9 and 9 over dominant. +1 STACK SLOT (5) — room for 9th chords, and a 9th is worth +2 to land on." },
        // ⚠️ REWRITTEN. This used to headline the chromatic-run Db payout, which
        // fired on 1% of commits — 16 Db for something the player would never see.
        // The capstone now sells the sixth slot, which is the lever that actually
        // moves the ladder: bigger chord, bigger target for Harmonic Lock.
        { id:'theory_chromatic', label:'Chromatic Mastery',    icon:'⚡', dbCost:16, gated:true, prereq:'theory_modes',
          desc:'CAPSTONE — +1 STACK SLOT (6). The biggest chords in the game are yours alone, and a bigger chord is a bigger thing to land your line on. APPROACH NOTES too: any note is clean if the next one lands on a chord tone, so you can walk in from anywhere. Also brings the Major 3rd (Borrowed Chord) online in Minor.' },
      ],
    },
    // ── THE RIG — your amp deck lives at your corner and grows (AMP_DECK_DESIGN.md §4) ──
    {
      id: 'electric',
      label: 'Electric',
      icon: '⚡',
      color: '#ffcc44',
      desc: 'Your rig. It lives at your corner and it only gets bigger.',
      subChains: [
        { id:'rig_amps', label:'🔊 Amps', skills: [
          { id:'amp_1', label:'Amp I',  icon:'🔊', dbCost:6,  gated:true, prereq:null,
            desc:'Your starting Main Amp — 2d6, keep highest, board-wide. Every Spirit begins wired in.' },
          { id:'amp_2', label:'Amp II', icon:'🔊', dbCost:10, gated:true, prereq:'amp_1',
            desc:'+1d6 (roll 3, keep highest). A second cabinet hits the stack.' },
          { id:'amp_3', label:'Amp III',icon:'🔊', dbCost:16, gated:true, prereq:'amp_2',
            desc:'+1d6 (roll 4, keep highest). Three stacks — the wall of sound is complete.' },
          { id:'overcharge', label:'Overcharge', icon:'🎸', dbCost:12, gated:true, prereq:'amp_2',
            desc:'Charge Zones no longer just spark your dice — tapping one now lets you choose: the usual charge (random die floor/ceiling boost), OR one curated Chord Stack note plus a bonus revoice to spend on it.' },
        ]},
        { id:'rig_power', label:'🎛️ Power', skills: [
          { id:'power_1', label:'Power I',  icon:'🎛️', dbCost:8,  gated:true, prereq:'amp_1',
            desc:'A real head on the stack — one of your dice becomes a d8.' },
          { id:'power_2', label:'Power II', icon:'🎛️', dbCost:12, gated:true, prereq:['power_1','amp_2'],
            desc:'A second die becomes a d8.' },
          { id:'power_3', label:'Power III',icon:'🎛️', dbCost:16, gated:true, prereq:['power_2','amp_3'],
            desc:'Three d8s in the pool — maximum wattage.' },
        ]},
        { id:'rig_range', label:'📡 Range', skills: [
          { id:'range_1', label:'Range I',  icon:'📡', dbCost:6,  gated:true, prereq:null,
            desc:'Full rig reaches 4 hexes from home.' },
          { id:'range_2', label:'Range II', icon:'📡', dbCost:10, gated:true, prereq:'range_1',
            desc:'Full rig reaches 7 hexes — the Limelight is inside your field.' },
          { id:'range_3', label:'Range III',icon:'📡', dbCost:14, gated:true, prereq:'range_2',
            desc:'Fully wired. The whole venue is your stage.' },
        ]},
      ],
    },
    // ── SIGNATURE ARSENALS — one compact route per Spirit (hidden from the others) ──
    {
      id: 'shredding_ronin',
      label: 'Shredding Ronin',
      icon: '🗡️',
      color: '#4488ff',
      desc: 'The way of the blade meets the way of the riff. An exclusive arsenal only the Ronin can wield.',
      spiritOnly: 'cosmic_ronin',
      skills: [
        { id:'psycho_bushido',  label:'Psycho Bushido',  icon:'🌀', dbCost:6,  gated:false,
          desc:'Iaijutsu dash — charge in a straight line from your facing and strike whoever you reach. Whatever AP you did not need for the run-up is added to THAT strike as bonus Drive. ⚠️ It powers the blow and expires with the battle — it does not join your Drive stack, and it shares the +5 ceiling with every other attack bonus. 2-round cooldown.' },
        { id:'shadow_illusion', label:'Shadow Illusion', icon:'👤', dbCost:6,  gated:false,
          desc:'Split into a second, identical Ronin, born stacked on your own hex (costs 1 Drive token) — nobody sees which one appeared. Rivals cannot tell the double from the real you: it blocks, it faces, and it walks the board on its own steps, refreshed each turn to match your movement range at no cost to your Action Points. 🎵 It can also PICK UP LOST CHORD NOTES for you — an illusion made of sound can carry a sound. It cannot take ⚡ charge zones or 🎪 event spaces, and hazards pass straight through it. Lasts 3 turns. Pops if it is struck, if you attack, or if you are attacked. Whoever swings at it burns their AP and Action Token for nothing.' },
        { id:'cursed_shamisen', label:'Cursed Shamisen', icon:'🎸', dbCost:8,  gated:false,
          desc:'Set a cursed Shamisen down on your hex (2 Db per use). It plays one endless MINOR phrase for 3 rounds — and only Spirits in a MINOR key can hear it. Anyone in minor inside its 2 rings loses 1 Sustain a round (then Vibe). Each round it wanders one hex toward the nearest minor-key Spirit; if the whole board is in major it has nothing to follow and stands still. It does not spare you — your own key decides whether it is a weapon or a haunting. Calmed by walking onto its hex, which also hands the walker a bonus note.' },
        { id:'wa_no_koe',       label:'Wa no Koe (和の声)', icon:'🎵', dbCost:12, gated:false,
          desc:'Voice of Harmony — when half your melody or more sits inside your Drive or Sustain stack, the alignment pays +1 Drive or Sustain for 3 rounds. The Ronin already starts holding CHORD TONE PARDON, so those same notes are never Discord for him either: this is the amplifier on top of an instinct he was born with.' },
      ],
    },
    {
      id: 'metalness',
      label: 'Metalness Monster',
      icon: '🤘',
      color: '#ffcc00',
      desc: 'Dripping poison, summoning mosh pits, invoking the Beast. An exclusive arsenal only the Monster can wield.',
      spiritOnly: 'Metalness_Monster',
      skills: [
        { id:'goes_to_11',      label:'Goes to 11',         icon:'🔊', dbCost:6, gated:false,
          desc:'SETS your attack to exactly 11 for the turn — not a bonus, a setting, so it beats the bonus cap. ⚠️ If you were already louder than 11, it turns you DOWN: the amp only goes to eleven. You also shrug off knockback. It costs your whole Sustain stack, and it blows your amp — no Sonic at all and a bare d4 on defence until your rig comes back a turn later.' },
        { id:'master_moshpits', label:'Master of Moshpits', icon:'🤘', dbCost:8,  gated:false,
          desc:'Pulls 3 fans out of the stands and onto the board for a pit. +2 Drive that STANDS — it survives battles and lasts until you call the next pit. Once per turn.' },
        { id:'tentacle',        label:'Tentacle',           icon:'🐙', dbCost:10, gated:false,
          desc:'Swing from any hex of your SLIME TRAIL instead of from where you stand — and the trail you reach THROUGH is consumed. Next to the nearest slime costs 1 hex; three hexes down the road costs 3. It does not move you and it does not turn you, so reaching behind means the rival in front is hitting your back. Range is real, and you pay for it in road.' },
        { id:'azrael',          label:'Azrael',             icon:'💀', dbCost:12, gated:false,
          desc:'Each rival you knock down feeds Fame equal to your knockdown streak (1st→1, 2nd→2…). Resets when YOU go down.' },
      ],
    },
    {
      id: 'intergalactic',
      label: 'Intergalactic 0',
      icon: '🌀',
      color: '#aa55ff',
      desc: 'Cosmic groove and weaponized sound. An exclusive arsenal only Intergalactic 0 can wield.',
      spiritOnly: 'intergalactic_0',
      skills: [
        { id:'blaster_of_ra', label:'Blaster of Ra', icon:'🌀', dbCost:10, gated:false,
          desc:'REPLACES the Smash. A ranged, PIERCING bass-drop: hurl your unused stock down the forward beam, hammering EVERY rival in line — undefendable, scattering their stock and knocking them back. Leaves you Exposed.' },
        { id:'displace', label:'Space is Displaced', icon:'🌌', dbCost:8,  gated:false,
          desc:`He can't run — he warps. Spend ${DISPLACE_DB_COST} Db to fold space and appear instantly on any open hex ${DISPLACE_MIN_RINGS} or ${DISPLACE_MAX_RINGS} rings away. No cooldown, no Action Points, no rig required — the only thing that limits it is how loud you've been. Too close doesn't count: he steps THROUGH the space between, not across it.` },
        { id:'gravity_control', label:'Gravity Control', icon:'🕳️', dbCost:6, gated:false,
          desc:`Spend ${GRAVITY_DB_COST} Db to tear open a BLACK HOLE VORTEX on any hex within ${GRAVITY_PLACE_RINGS} rings. Every rival within ${GRAVITY_PULL_RINGS} rings is dragged ${GRAVITY_PULL_HEXES} hex toward it — and anyone pulled all the way INTO it watches ${GRAVITY_NOTE_DRAIN} notes get swallowed, ${GRAVITY_NOTE_DRAIN} fewer in their pool next turn. The vortex hangs there for one full round, catching anyone who wanders too close, then collapses. Gravity is his to command: it never touches him.` },
        { id:'code_injection', label:'Code Injection', icon:'💻', dbCost:6, gated:false,
          desc:`Spend ${CODE_INJECT_DB_COST} Db to slip a patch into the fabric of the fight — then say nothing. For one full round, the FIRST rival whose attack would beat you has their dice thrown out and re-rolled, and they live with whatever comes up second. Nobody can see that you've committed: no aura, no tell, no marker on your standee. If nobody swings, or nobody lands, the Db is simply gone. That's the bet.` },
        { id:'sunbeam', label:'Sunbeam', icon:'☀️', dbCost:14, gated:false,
          desc:`Spend ${SUNBEAM_DB_COST} Db on a connecting attack and the stage goes SUPERNOVA — the rival's whole world whites out for ${SUNBEAM_BLIND_TURNS} turn. They can't see the board, the standees, their own stack. Nothing. ${Math.round(SUNBEAM_LINGER_CHANCE * 100)}% of the time the burn stays seared in for a second turn (${SUNBEAM_MAX_BLIND_TURNS} turns is the ceiling — the sun always sets).` },
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
