// =============================================================================
// data/rockGods.js — 🤘 ROCK GODS (endgame boss battle) — meta + tuning
// -----------------------------------------------------------------------------
// THE RULE OF THE GODS: reaching FAME_TO_WIN with a RUNAWAY lead (≥
// ROCK_GOD_RUNAWAY_LEAD over 2nd place) crowns a Legend outright. Reach it in a
// CLOSE race and the Gods are not convinced — one descends to the Limelight and
// the Spirits must ally to bring them down. ONE god per game, chosen by the
// leader's dominant playstyle (see pickRockGod).
//
// Boss-phase rules (engine lives in the main file, `ROCK GOD SYSTEM` banner):
//   • No battle overlays — everything resolves on the board, fast.
//   • PvP is off: Swing/Sonic/Smash only reach the God.
//   • Your committed chord's Drive = direct damage; damage = FP, 1:1
//     (granted with amplify=false — the crowd is already screaming).
//   • ⏱️ The God acts on a WALL CLOCK, not on the turn order (2026-08-05):
//     every ROCK_GOD_DIFFICULTY.actSeconds of real time he answers — an armed
//     telegraph lands or a new one opens. Big attacks still telegraph one beat
//     ahead (glowing hexes — same language as pyro arming). Everything else on
//     the board moved onto the round clock; he is the exception, because the
//     finale is supposed to have you on the back foot.
//   • Human turns are TIMED (ROCK_GOD_DIFFICULTY.turnSeconds); expiry = the
//     God's Vengeance + turn force-ends.
//   • God at 0 HP → killing blow pays ROCK_GOD_KILL_BLOW_FP, then the FP
//     leader is crowned. All Spirits KO'd → the God keeps the crown.
// =============================================================================

// ── Engine tuning ────────────────────────────────────────────────────────────
// 🪦 THE FINALE IS SHELVED — Alex, 2026-08-18. While this is true, reaching the
// Fame target ALWAYS crowns a Legend outright: `grantFame` never summons, and
// `hook('summonRockGod')` is never yielded. Nothing else about the God is
// deleted — the data, the systems and the client's fight are all still here —
// because a shelf is a scheduling decision and cutting working rules to express
// one turns it into a rewrite. Flip this to `false` and the finale is back.
//
// ⚠️ IT IS ALSO WHAT LETS THE BENCH PLAY THREE-LIFE MATCHES. `policies/play.js`
// played TWO-life games purely to sidestep this branch, and a short game
// under-rates every investment term in `BOT_STRATEGY_HANDOFF.md` §3.2 and §3.6.
export const ROCK_GODS_SHELVED = true;

export const ROCK_GOD_RUNAWAY_LEAD   = 3;   // lead at FAME_TO_WIN that skips the boss — the finale is for CLOSE races only (was 5; lowered in the 2026-07-16 balance pass)
export const ROCK_GOD_HP_PER_SPIRIT  = 20;  // HP pool = this × living Spirits
export const ROCK_GOD_TIMER_SECONDS  = 45;  // fallback human turn clock (see ROCK_GOD_DIFFICULTY)
export const ROCK_GOD_VENGEANCE_DMG  = 2;   // Vibe cost of letting the clock die
export const ROCK_GOD_KILL_BLOW_FP   = 3;   // Fame flourish for the final hit

// ── ⏱️ THE GOD RUNS ON A CLOCK, NOT ON THE TURN ORDER (2026-08-05) ───────────
// Everything else on the board moved onto the ROUND clock so nobody gets
// bombarded before they've moved. The God is the deliberate exception: he is
// not board weather, he's a boss, and the whole point of the finale is that
// the Spirits are on the back foot and have to be QUICK. So he acts on
// WALL-CLOCK time — every `actSeconds` of real time that the acting player
// spends thinking, the God takes another swing. Dither and he'll take two.
//
// `turnSeconds` is the existing per-turn vengeance clock, kept on the same
// difficulty dial so one setting describes the whole fight.
//
// ⚠️ ONLINE: only the client that controls the acting Spirit runs this timer
// (it dispatches engine actions, and two machines firing it would double the
// God's turns). The setting therefore rides in the game config from the host's
// lobby, NOT in per-client localStorage — otherwise the God's pace would change
// depending on whose turn it was.
export const ROCK_GOD_DIFFICULTY = {
  chill:    { label: 'CHILL',    icon: '🌙', actSeconds: 30, turnSeconds: 60,
              blurb: 'The God is in no hurry. A swing every 30s, a full minute on your turn clock.' },
  standard: { label: 'STANDARD', icon: '🤘', actSeconds: 20, turnSeconds: 45,
              blurb: 'He answers every 20s. Think fast, play faster.' },
  brutal:   { label: 'BRUTAL',   icon: '💀', actSeconds: 12, turnSeconds: 30,
              blurb: 'A swing every 12 seconds. Hesitation is a decision, and it is the wrong one.' },
};
export const ROCK_GOD_DIFFICULTY_DEFAULT = 'standard';
export function rockGodPace(key) {
  return ROCK_GOD_DIFFICULTY[key] ?? ROCK_GOD_DIFFICULTY[ROCK_GOD_DIFFICULTY_DEFAULT];
}

// ── The pantheon ─────────────────────────────────────────────────────────────
// Only the Bardbarian is playable so far; the other three are designed and
// selectable-by-score, but fall back to him until their kits are built.
export const ROCK_GOD_IMPLEMENTED = ['bardbarian'];

export const ROCK_GODS = {
  bardbarian: {
    name: 'The Bardbarian', icon: '🤘', color: '#ffcc22', aura: '#ff8800',
    title: 'THUNDER GOD OF THE POWER CHORD',
    blurb: 'Half bard, half barbarian, all volume. He respects only those who hit hard and hit LOUD.',
    // Attack deck — weights are relative; telegraphed attacks arm one turn first.
    attacks: [
      { id: 'thunderclap',  weight: 3, telegraph: true,  dmg: 2, radius: 2,
        label: 'THUNDERCLAP', warn: 'He raises both fists — clear the glowing hexes!' },
      { id: 'power_slide',  weight: 3, telegraph: true,  dmg: 3,
        label: 'POWER SLIDE', warn: 'He drops to his knees, aiming a slide — get off the line!' },
      { id: 'face_melter',  weight: 2, telegraph: false, dmg: 2,
        label: 'FACE-MELTER SOLO' },
      { id: 'mosh_command', weight: 2, telegraph: false, dmg: 1,
        label: 'MOSH COMMAND' },
    ],
    taunts: {
      summon: [
        `⚡ "You call THAT a lead?! The Gods demand a FINALE!"`,
        `⚡ "I have shredded the lightning itself. Show me your THUNDER."`,
      ],
      hit: [
        `🤘 "HA! I've had mosquito bites with more sustain!"`,
        `🤘 "Yes... YES! Hit me like you MEAN it!"`,
      ],
      bigHit: [
        `😤 "OKAY. Okay. That one had some CRUNCH."`,
        `😤 "WHO TUNED THAT CHORD?! ...Respect."`,
      ],
      winded: [
        `😵 "One... one second... pulled a hammy on that slide..."`,
        `😵 "The slide taketh... a moment..."`,
      ],
      kill: [
        `💀 "Another opener leaves the stage EARLY!"`,
        `💀 "Sleep well, little riff. The headliner plays ON."`,
      ],
      victory: [
        `👑 "The crown stays with the GODS. Practice your scales, mortals."`,
      ],
      defeat: [
        `🌩️ "...MAGNIFICENT. The stage is yours. WEAR THE CROWN LOUD."`,
      ],
    },
  },
  feedback_warlock: {
    name: 'The Feedback Warlock', icon: '🌀', color: '#aa66ff', aura: '#6633cc',
    title: 'HEXMASTER OF THE HOWLING AMP',
    blurb: 'Turns your own Sonic power against you. Not yet manifested.',
    attacks: [], taunts: {},
  },
  sonic_sorceress: {
    name: 'The Sonic Sorceress', icon: '🔮', color: '#44ddff', aura: '#2288cc',
    title: 'WEAVER OF THE INFINITE WAVEFORM',
    blurb: 'A being of unimaginable magic Sonic energy. Not yet manifested.',
    attacks: [], taunts: {},
  },
  glam_reaper: {
    name: 'The Glam Reaper', icon: '💀', color: '#ff66cc', aura: '#cc2288',
    title: 'DEATH, BUT MAKE IT FABULOUS',
    blurb: 'He watched glam rockers teeter on the edge of death so long he... well. He earned his place. Not yet manifested.',
    attacks: [], taunts: {},
  },
};

// ── God selection — read the leader's playstyle from stats we already track ──
// profile: { unlockedSkills:[], ampsOwned:number, livesLost:number }
// Highest score picks the god; unimplemented gods fall back to the Bardbarian.
export function pickRockGod(profile) {
  const sk = profile.unlockedSkills ?? [];
  const has = id => sk.includes(id);
  const scores = {
    // Bardbarian answers the brawlers — scored on melee-flavoured signature
    // skills (the CQC branch it used to read was cut in the Stance rework).
    bardbarian:       ['master_moshpits', 'azrael', 'goes_to_11', 'psycho_bushido', 'shadow_illusion', 'cursed_shamisen']
                        .filter(has).length * 2,
    feedback_warlock: (profile.ampsOwned ?? 0)
                        + ['amp_1', 'amp_2', 'amp_3', 'pedal_dist', 'power_chords'].filter(has).length,
    sonic_sorceress:  ['theory_major', 'theory_minor', 'theory_dom7', 'theory_modes', 'theory_chromatic']
                        .filter(has).length * 1.5,
    glam_reaper:      (profile.livesLost ?? 0) * 2,
  };
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const picked = ranked[0]?.[0] ?? 'bardbarian';
  return ROCK_GOD_IMPLEMENTED.includes(picked) ? picked : 'bardbarian';
}

// Weighted draw from a god's attack deck, avoiding an immediate repeat.
// `rand` is an injectable 0..1 PRNG (Phase 6c prep — same treatment as the
// Phase-4 riffGeneration / Phase-5a economy rng threading): it defaults to
// Math.random so the still-live client behaves exactly as before, and the
// engine passes its seeded rng at the flip so a GOD_ATTACKED action replays
// deterministically. Pure otherwise.
export function pickGodAttack(godDef, lastId, rand = Math.random) {
  const pool = (godDef.attacks ?? []).filter(a => a.id !== lastId);
  const list = pool.length ? pool : (godDef.attacks ?? []);
  const total = list.reduce((s, a) => s + a.weight, 0);
  let roll = rand() * total;
  for (const a of list) { roll -= a.weight; if (roll <= 0) return a; }
  return list[list.length - 1] ?? null;
}

// `rand` injectable (see pickGodAttack) — taunt flavor is cosmetic, but routing
// it through the seeded rng keeps replays byte-identical once the God speaks.
export function godTauntLine(godDef, kind, rand = Math.random) {
  const lines = godDef.taunts?.[kind];
  if (!lines?.length) return null;
  return lines[Math.floor(rand() * lines.length)];
}
