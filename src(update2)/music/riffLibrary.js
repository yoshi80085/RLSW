// =============================================================================
// music/riffLibrary.js  —  RIFF LIBRARY data + detection
// =============================================================================
import { pitchIndex } from "./notes.js";

// ─── RIFF LIBRARY ─────────────────────────────────────────────────────────────
// Legendary riffs hidden in the note system. Place the riff's opening interval
// pattern (any key — only the intervals matter) on your track, hit CONFIRM, and
// the full riff plays out with real rhythm. First discovery = full Fame bonus;
// replays earn 1 FP. Patterns are public-domain classics + timeless theory moves.
//
// notes: [semitoneOffsetFromFirstNote, durationInBeats, restAfterInBeats?]
// triggerLen: how many opening notes must appear on the track (interval-matched)
export const RIFF_LIBRARY = [
  { id:'fate_knocks', name:'FATE KNOCKS', fp:4, bpm:100, triggerLen:4, icon:'🚪',
    hint:'Three short, one looong — destiny at the door.',
    flavor:'Beethoven\'s Fifth — the most famous four notes ever written.',
    notes:[[0,.6],[0,.6],[0,.6],[-4,2.6,.4],[-2,.6],[-2,.6],[-2,.6],[-5,3]] },
  { id:'ode_to_joy', name:'ODE TO JOY', fp:3, bpm:132, triggerLen:5, icon:'🕊️',
    hint:'Two repeated notes step up, hold hands, and walk back down.',
    flavor:'Beethoven\'s Ninth — the anthem of anthems.',
    notes:[[0,1],[0,1],[1,1],[3,1],[3,1],[1,1],[0,1],[-2,1.8]] },
  { id:'toccata_doom', name:'TOCCATA OF DOOM', fp:5, bpm:84, triggerLen:5, icon:'🦇',
    hint:'An organ wail, a dramatic pause, then a plunge into darkness.',
    flavor:'Bach\'s Toccata in D minor — the haunted-castle special.',
    notes:[[0,.4],[-2,.4],[0,1.6,.5],[-2,.45],[-4,.45],[-5,.45],[-7,.45],[-8,2.2]] },
  { id:'mountain_king', name:'MOUNTAIN KING', fp:4, bpm:120, triggerLen:5, icon:'🏔️',
    hint:'A sneaky stepwise climb that wants to start running.',
    flavor:'Grieg\'s hall-creeping classic. It only gets faster from here.',
    notes:[[0,.5],[2,.5],[3,.5],[5,.5],[7,.5],[3,.5],[7,1.6]] },
  { id:'fur_elise', name:'FÜR ELISE', fp:4, bpm:120, triggerLen:5, icon:'🌹',
    hint:'Two notes trembling a half-step apart, again and again.',
    flavor:'Beethoven\'s bagatelle — the ringtone of the 1800s.',
    notes:[[0,.5],[-1,.5],[0,.5],[-1,.5],[0,.5],[-5,.5],[-2,.5],[-4,.5],[-9,1.6]] },
  { id:'dies_irae', name:'DIES IRAE', fp:3, bpm:80, triggerLen:4, icon:'💀',
    hint:'The medieval chant of wrath. Doom metal\'s great-grandfather.',
    flavor:'Day of wrath — quoted by every horror score ever made.',
    notes:[[0,1],[-1,.8],[0,.8],[-3,1.2],[-1,.8],[-5,.8],[-3,1.2],[-3,1.6]] },
  { id:'valkyries', name:'RIDE OF THE VALKYRIES', fp:4, bpm:100, triggerLen:4, icon:'🐎',
    hint:'A galloping leap up a minor chord, then back to charge again.',
    flavor:'Wagner\'s war cry. Smells like victory.',
    notes:[[0,.7],[5,.3],[8,1],[5,.3],[8,.7],[0,1.8]] },
  { id:'william_tell', name:'WILLIAM TELL GALLOP', fp:5, bpm:152, triggerLen:6, icon:'🏹',
    hint:'Da-da-DUM, da-da-DUM, da-da-DUM-DUM-DUM.',
    flavor:'Rossini\'s overture — hi-ho and away.',
    notes:[[0,.33],[0,.33],[5,.66],[0,.33],[0,.33],[5,.66],[0,.33],[0,.33],[5,.45],[7,.45],[9,1.4]] },
  { id:'new_world', name:'NEW WORLD LARGO', fp:3, bpm:76, triggerLen:4, icon:'🌅',
    hint:'A gentle rise of a third, held, then easing home.',
    flavor:'Dvořák\'s Largo — goin\' home, goin\' home.',
    notes:[[0,1],[3,1.4],[3,1],[0,1],[-2,.8],[-4,1.4],[-2,2]] },
  { id:'eine_kleine', name:'EINE KLEINE', fp:3, bpm:120, triggerLen:5, icon:'🎻',
    hint:'A bold call bouncing between root and the note below... twice.',
    flavor:'Mozart\'s little night music — big powdered-wig energy.',
    notes:[[0,.5,.25],[-5,.5,.25],[0,.5,.25],[-5,.5,.25],[0,.4],[4,.4],[7,1.4]] },
  { id:'canon_groove', name:'CANON GROOVE', fp:4, bpm:96, triggerLen:5, icon:'🔁',
    hint:'Eight bass notes that secretly power half of all pop music.',
    flavor:'Pachelbel\'s Canon progression — it never lets go.',
    notes:[[0,1],[-5,1],[-3,1],[-8,1],[-7,1],[0,1],[-7,1],[-5,1.5]] },
  { id:'bumblebee', name:'FLIGHT OF THE BUMBLEBEE', fp:5, bpm:160, triggerLen:6, icon:'🐝',
    hint:'A chromatic blur — down four half-steps and buzzing back up.',
    flavor:'Rimsky-Korsakov\'s shred étude. Finger cramps included.',
    notes:[[0,.25],[-1,.25],[-2,.25],[-3,.25],[-2,.25],[-1,.25],[0,.25],[-1,.6]] },
  { id:'moonlight', name:'MOONLIGHT ARPEGGIO', fp:4, bpm:80, triggerLen:6, icon:'🌙',
    hint:'Three notes rolling like waves, twice over.',
    flavor:'Beethoven\'s Moonlight Sonata — slow triplets forever.',
    notes:[[0,.66],[5,.66],[8,.66],[0,.66],[5,.66],[8,1.4]] },
  { id:'power_stance', name:'POWER STANCE', fp:2, bpm:140, triggerLen:4, icon:'🤘',
    hint:'Root, fifth, root, fifth. The oldest move in rock.',
    flavor:'Two notes. Infinite attitude.',
    notes:[[0,.5],[7,.5],[0,.5],[7,1]] },
  { id:'penta_strut', name:'PENTA STRUT', fp:3, bpm:112, triggerLen:5, icon:'🕶️',
    hint:'Climb the five sacred steps of the minor pentatonic.',
    flavor:'The scale every guitar hero learned first.',
    notes:[[0,.5],[3,.5],[5,.5],[7,.5],[10,1.2]] },
  { id:'blues_crawl', name:'BLUES CRAWL', fp:3, bpm:104, triggerLen:5, icon:'🎩',
    hint:'Pentatonic climb with a sly chromatic squeeze in the middle.',
    flavor:'The blue note — the most expensive half-step in music.',
    notes:[[0,.6],[3,.6],[5,.6],[6,.6],[7,1],[10,.6],[0,1.2]] },
  { id:'the_lick', name:'THE LICK™', fp:5, bpm:126, triggerLen:5, icon:'😏',
    hint:'THE jazz cliché. If you know, you know.',
    flavor:'Played at every jam session since the dawn of time.',
    notes:[[0,.5],[2,.5],[3,.5],[5,.5],[2,1],[-2,.5],[0,1.4]] },
  { id:'andalusian', name:'ANDALUSIAN SLIDE', fp:2, bpm:92, triggerLen:4, icon:'💃',
    hint:'Four steps down the Spanish staircase.',
    flavor:'The flamenco descent — drama in four notes.',
    notes:[[0,1],[-2,1],[-4,1],[-5,1.8]] },
  { id:'tritone_summon', name:'TRITONE SUMMONING', fp:3, bpm:66, triggerLen:4, icon:'😈',
    hint:'The devil\'s interval, tolled like a bell.',
    flavor:'Diabolus in musica — banned in church, beloved on stage.',
    notes:[[0,1],[6,1],[0,1],[6,1.8]] },
  { id:'dream_drift', name:'DREAM SEQUENCE', fp:3, bpm:110, triggerLen:5, icon:'💭',
    hint:'Whole steps only — gravity politely declines to apply.',
    flavor:'The whole-tone float. Cue the wavy flashback screen.',
    notes:[[0,.6],[2,.6],[4,.6],[6,.6],[8,1.4]] },
  { id:'circle_rider', name:'CIRCLE RIDER', fp:3, bpm:100, triggerLen:4, icon:'🎡',
    hint:'Leap by fifths, three times in a row.',
    flavor:'Riding the circle of fifths like a carousel.',
    notes:[[0,.7],[7,.7],[2,.7],[9,1.4]] },
  { id:'chromatic_meltdown', name:'CHROMATIC MELTDOWN', fp:2, bpm:140, triggerLen:5, icon:'🫠',
    hint:'Five half-steps straight down. No survivors.',
    flavor:'Every note between here and despair.',
    notes:[[0,.3],[-1,.3],[-2,.3],[-3,.3],[-4,1.2]] },
  { id:'spy_twang', name:'SPY TWANG', fp:3, bpm:108, triggerLen:5, icon:'🕵️',
    hint:'A slinky harmonic-minor crawl. Trust no one.',
    flavor:'Surf reverb sold separately.',
    notes:[[0,.5],[1,.5],[4,.5],[5,.5],[7,1.4]] },
  // ── HOMAGE WING — original riffs in legendary styles. The names wink at
  // rock history; the melodies are ours. Recognition lives in the lore. ──
  { id:'sweet_riff', name:"SWEET RIFF O' MINE", fp:5, bpm:122, triggerLen:6, icon:'🎩',
    hint:'A string-skipping arpeggio exercise that refuses to stay a warm-up.',
    flavor:'Legend says the most famous intro ever started as a finger exercise. This one is still auditioning.',
    notes:[[0,.5],[4,.5],[11,.5],[7,.5],[4,.5],[11,.5],[9,.5],[7,1.6]] },
  { id:'beast_gallop', name:'GALLOP OF THE BEAST', fp:5, bpm:168, triggerLen:8, icon:'🐴',
    hint:'Da-da-dum hooves on the root, climbing one scream at a time.',
    flavor:'Two minutes to midnight, eight notes to glory. Up the irons.',
    notes:[[0,.25],[0,.25],[0,.5],[3,.5],[0,.25],[0,.25],[0,.5],[5,.5],[0,.25],[0,.25],[0,.5],[7,1.2]] },
  { id:'clean_spirit', name:'SMELLS LIKE CLEAN SPIRIT', fp:4, bpm:92, triggerLen:6, icon:'🧼',
    hint:'Four sludgy steps that flunked music school on purpose.',
    flavor:'Flannel not included. Tune down, look down, melt faces.',
    notes:[[0,.8],[3,.8],[2,.8],[0,.8],[-2,.8],[0,1.6]] },
  { id:'disco_lightning', name:'DISCO BALL LIGHTNING', fp:3, bpm:116, triggerLen:6, icon:'🪩',
    hint:'A bassline that walks down to the dance floor and back.',
    flavor:'Survived the Demolition. The groove is immortal.',
    notes:[[0,.25],[0,.25],[-2,.5],[0,.25],[-5,.5],[0,.25],[-2,.5],[0,1]] },
  { id:'surf_apocalypse', name:"SURF'S APOCALYPSE", fp:4, bpm:152, triggerLen:6, icon:'🌊',
    hint:'A harmonic-minor wipeout, tremolo-picked all the way down.',
    flavor:'Hang ten on the wave at the end of the world.',
    notes:[[0,.3],[-1,.3],[-4,.3],[-5,.3],[-7,.3],[-8,.3],[0,1.4]] },
  { id:'punks_not_debt', name:"PUNK'S NOT DEBT", fp:3, bpm:184, triggerLen:6, icon:'🧷',
    hint:'Three chords, zero patience, all downstrokes.',
    flavor:'Recorded in one take because the second take costs money.',
    notes:[[0,.25],[0,.25],[0,.25],[0,.25],[5,.25],[5,.25],[7,.25],[7,.5]] },
  { id:'funk_trunk', name:'FUNK IN THE TRUNK', fp:4, bpm:104, triggerLen:6, icon:'🦆',
    hint:'A sixteenth-note strut with one filthy chromatic squeeze.',
    flavor:'The one. It is always about the one.',
    notes:[[0,.25],[3,.25],[5,.25],[6,.25],[5,.25],[3,.25],[0,.5],[-2,1]] },
  { id:'stadium_stomper', name:'STADIUM STOMPER', fp:4, bpm:120, triggerLen:6, icon:'🏟️',
    hint:'A pentatonic anthem built for 80,000 voices.',
    flavor:'Clap. Clap. Sing the next part even if you don\'t know the words.',
    notes:[[0,.75],[3,.75],[0,.75],[5,.75],[0,.75],[7,1],[5,.75],[3,1.6]] },
  { id:'neon_lords', name:'SYNTH LORDS OF NEON', fp:4, bpm:132, triggerLen:6, icon:'🌆',
    hint:'A minor arpeggio with a ninth, gliding through the rain.',
    flavor:'The year is always 1984 somewhere.',
    notes:[[0,.5],[3,.5],[7,.5],[2,.5],[7,.5],[3,.5],[0,1.4]] },
  { id:'one_band_army', name:'ONE-BAND ARMY', fp:4, bpm:124, triggerLen:6, icon:'🥁',
    hint:'A lone swaggering stomp the whole stadium hums anyway.',
    flavor:'Two members. One riff. Zero mercy.',
    notes:[[0,.75],[3,.5],[0,.75],[-2,.5],[-4,.75],[-5,.75],[0,1.6]] },
  { id:'sludge_commandment', name:'SLUDGE COMMANDMENT', fp:3, bpm:60, triggerLen:5, icon:'🌫️',
    hint:'Five doom-laden tones, slower than continental drift.',
    flavor:'What is this that stands before me? ...A very heavy riff.',
    notes:[[0,1.5],[3,1.5],[0,1.5],[6,1.5],[5,2.5]] },
];
export const RIFF_BY_ID = Object.fromEntries(RIFF_LIBRARY.map(r => [r.id, r]));
// Genre wing of each riff — used by the Riffbook's Legacy Codex
export const RIFF_GENRE = {
  fate_knocks:'classical', ode_to_joy:'classical', toccata_doom:'classical',
  mountain_king:'classical', fur_elise:'classical', dies_irae:'classical',
  valkyries:'classical', william_tell:'classical', new_world:'classical',
  eine_kleine:'classical', canon_groove:'classical', bumblebee:'classical',
  moonlight:'classical',
  power_stance:'theory', penta_strut:'theory', blues_crawl:'theory',
  the_lick:'theory', andalusian:'theory', tritone_summon:'theory',
  dream_drift:'theory', circle_rider:'theory', chromatic_meltdown:'theory',
  spy_twang:'theory',
  sweet_riff:'homage', beast_gallop:'homage', clean_spirit:'homage',
  disco_lightning:'homage', surf_apocalypse:'homage', punks_not_debt:'homage',
  funk_trunk:'homage', stadium_stomper:'homage', neon_lords:'homage',
  one_band_army:'homage', sludge_commandment:'homage',
};
export const RIFF_GENRE_META = {
  classical: { label:'CLASSICAL', color:'#88ddff' },
  theory:    { label:'THEORY',    color:'#44cc88' },
  homage:    { label:'HOMAGE',    color:'#ff88ff' },
};
// Canonical playback name for each pitch class (PITCH_INDEX convention, C = 0)
export const PC_PLAY_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// Interval signature (consecutive pitch-class diffs, mod 12) of a riff's trigger
export function riffTriggerDiffs(riff) {
  const offs = riff.notes.slice(0, riff.triggerLen).map(n => n[0]);
  const d = [];
  for (let i = 0; i < offs.length - 1; i++) d.push(((offs[i + 1] - offs[i]) % 12 + 12) % 12);
  return d;
}

// Scan a melody line for any riff trigger. Key-agnostic: only the interval
// pattern matters. Returns { riff, rootPc } of the best match (longest trigger,
// ties broken by FP) or null.
export function detectRiff(melodyLine) {
  if (!melodyLine || melodyLine.length < 3) return null;
  const pcs = melodyLine.map(n => pitchIndex(n)).filter(p => p >= 0);
  if (pcs.length < 3) return null;
  const diffs = [];
  for (let i = 0; i < pcs.length - 1; i++) diffs.push(((pcs[i + 1] - pcs[i]) % 12 + 12) % 12);
  let best = null;
  for (const riff of RIFF_LIBRARY) {
    const td = riffTriggerDiffs(riff);
    if (td.length > diffs.length) continue;
    for (let s = 0; s + td.length <= diffs.length; s++) {
      let ok = true;
      for (let k = 0; k < td.length; k++) {
        if (diffs[s + k] !== td[k]) { ok = false; break; }
      }
      if (ok) {
        const cand = { riff, rootPc: pcs[s], len: td.length };
        if (!best || cand.len > best.len || (cand.len === best.len && riff.fp > best.riff.fp)) best = cand;
        break;
      }
    }
  }
  return best;
}
