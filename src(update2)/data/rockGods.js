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
//   • The God acts at the END of every player turn; big attacks telegraph
//     one turn ahead (glowing hexes — same language as pyro arming).
//   • Human turns are TIMED; expiry = the God's Vengeance + turn force-ends.
//   • God at 0 HP → killing blow pays ROCK_GOD_KILL_BLOW_FP, then the FP
//     leader is crowned. All Spirits KO'd → the God keeps the crown.
// =============================================================================

// ── Engine tuning ────────────────────────────────────────────────────────────
export const ROCK_GOD_RUNAWAY_LEAD   = 5;   // lead at FAME_TO_WIN that skips the boss
export const ROCK_GOD_HP_PER_SPIRIT  = 20;  // HP pool = this × living Spirits
export const ROCK_GOD_TIMER_SECONDS  = 45;  // human turn clock during the boss
export const ROCK_GOD_VENGEANCE_DMG  = 2;   // Vibe cost of letting the clock die
export const ROCK_GOD_KILL_BLOW_FP   = 3;   // Fame flourish for the final hit

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
    bardbarian:       ['shank_skank', 'cosmic_boogaloo', 'moon_shuffle', 'baki_gravity']
                        .filter(has).length * 2 + (has('master_moshpits') ? 1 : 0),
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
export function pickGodAttack(godDef, lastId) {
  const pool = (godDef.attacks ?? []).filter(a => a.id !== lastId);
  const list = pool.length ? pool : (godDef.attacks ?? []);
  const total = list.reduce((s, a) => s + a.weight, 0);
  let roll = Math.random() * total;
  for (const a of list) { roll -= a.weight; if (roll <= 0) return a; }
  return list[list.length - 1] ?? null;
}

export function godTauntLine(godDef, kind) {
  const lines = godDef.taunts?.[kind];
  if (!lines?.length) return null;
  return lines[Math.floor(Math.random() * lines.length)];
}
