// 📖 SPIRIT STORIES — the backstory a Spirit tells when you linger on it in the
// picker (Alex, 2026-09-25: "if it hovers over even longer, have its backstory
// revealed - place holder story for the time being").
//
// ⚠️ EVERY STORY HERE IS PLACEHOLDER COPY, written only to size the panel. No
// lore exists anywhere else in the repo, so nothing here is canon. Write the real
// ones straight over these paragraphs and set `placeholder:false`; the panel
// stops showing its PLACEHOLDER tag by itself.
//
// 📌 A SEPARATE FILE, NOT A FIELD ON `SPIRIT_DEFS`. A SPIRIT_DEFS entry is copied
// into every match as a live Spirit (vibe, knockedOut, …) and rides the netcode
// snapshots; a few hundred bytes of prose has no business in either.

export const SPIRIT_STORIES = Object.freeze({
  cosmic_ronin: { placeholder:true, paragraphs:[
    'A wandering swordsman who traded his blade for a guitar the night a comet split the sky above his village.',
    'He plays the old five-note scales his teacher sang to him, only louder, and every riff is a kata he has practised ten thousand times.',
    'He is looking for the one stage that can hold all of it. He has not found it yet.',
  ] },
  intergalactic_0: { placeholder:true, paragraphs:[
    'A signal from past the edge of the solar system, answering a broadcast nobody on Earth remembers sending.',
    'Intergalactic 0 bends space the way other players bend strings. The crowd never knows where the next note will land, and neither do the rivals.',
    'It came here to learn what a crowd is.',
  ] },
  Metalness_Monster: { placeholder:true, paragraphs:[
    'Born in the feedback of a thousand blown amps, the Monster was the noise left over when the last show of the night refused to end.',
    'It does not tune, it does not rest and it does not take requests.',
    'Every stage it plays is a little heavier afterwards.',
  ] },
  Glamarchy: { placeholder:true, paragraphs:[
    'Still in development. Her story comes when her set does.',
  ] },
});

/** The story for a Spirit (by character id), or a stand-in so the panel never breaks. */
export function storyFor(id) {
  return SPIRIT_STORIES[id] ?? { placeholder:true, paragraphs:['No story yet.'] };
}
