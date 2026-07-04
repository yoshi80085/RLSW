export const EVENT_DECK = [
  {
    id: 'disco_inferno', icon: '\u{1F525}\u{1F4BF}', title: 'DISCO INFERNO', color: '#ff6622',
    flavor: '"Disco sucks!" The crowd storms the field and torches a crate of records. Flaming discs rain down across the stage.',
    rules: '6 flaming discs land on random hexes for 2 full rounds. Step on one — or get pushed into one — and take 1 Vibe damage.',
    kind: 'board',
  },
  {
    id: 'bat_snack', icon: '\u{1F987}', title: 'BAT SNACK', color: '#aa55ff',
    flavor: 'Something leathery sails out of the crowd and lands at your feet. It looks... rubber? Only one way to find out.',
    rules: 'Roll d6. On 4+ — legendary confidence: +2 Vibe and +1 Drive for your next battle. On 1–3 — infection: lose all temp boosts and 1 Vibe.',
    kind: 'roll',
  },
  {
    id: 'satanic_panic', icon: '\u{1F608}', title: 'SATANIC PANIC', color: '#ff3355',
    flavor: 'A televangelist plays your records backwards on national TV. EVERY spirit stands accused of backmasking demon-summoning lyrics.',
    rules: 'Community roll — every spirit rolls d6. Highest roller is acquitted WITH STYLE: +2 Drive for their next battle. Anyone rolling a 1 is convicted: Mojo Drain 1 turn.',
    kind: 'community',
  },
  {
    id: 'spinal_tap', icon: '\u{1F39A}️', title: 'THESE GO TO ELEVEN', color: '#ffcc44',
    flavor: 'A mysterious tech rewires your rig. The knobs now go one louder. Where can you go from ten? Nowhere. Exactly.',
    rules: 'Your amps go to eleven: for your next 2 turns your dice tier counts +1 amp in range (caps at d12). No amps? You still feel one louder: die floor +1 next roll.',
    kind: 'auto',
  },
  {
    id: 'seance_27', icon: '\u{1F56F}️', title: '27 CLUB SÉANCE', color: '#88ddff',
    flavor: 'The lights dip. A cold wind crosses the stage. Someone left a candle, a crossroads map, and a left-handed guitar...',
    rules: 'Roll d6. On 6 — the legends answer: +3 Harmonic Charge. On 2–5 — a faint whisper: +1 HC. On 1 — spooked: 2 stock slots frozen for 1 turn.',
    kind: 'roll',
  },
  {
    id: 'hotel_trash', icon: '\u{1F4FA}', title: 'TRASH THE SUITE', color: '#44cc88',
    flavor: 'Checkout time. The TV is already airborne and the pool is six floors down. Everyone nearby scatters from the splash zone.',
    rules: 'All adjacent rivals are shoved 1 hex directly away from you. No rivals adjacent? Pure catharsis: +1 Vibe.',
    kind: 'auto',
  },
  {
    id: 'payola', icon: '\u{1F4B0}', title: 'PAYOLA SCANDAL', color: '#ffaa22',
    flavor: 'A brown envelope changes hands at the radio station. Your single is suddenly in heavy rotation... or you are suddenly in the headlines.',
    rules: 'Roll d6. Even — your single charts: +2 Harmonic Charge. Odd — busted: lose 2 HC progress.',
    kind: 'roll',
  },
  {
    id: 'stage_dive', icon: '\u{1F938}', title: 'STAGE DIVE', color: '#ff88ff',
    flavor: 'You lock eyes with your nearest rival, point at the crowd, and leap. Whose fans love them more?',
    rules: 'You and your nearest rival both roll d6. Winner steals 1 Vibe from the loser. Tie — the crowd carries you both: +1 Vibe each.',
    kind: 'duel',
  },
  {
    id: 'backstage_pass', icon: '\u{1F39F}️', title: 'BACKSTAGE PASS', color: '#44aaff',
    flavor: 'A laminated all-access pass glints on the floor. Whatever is behind that door, it is yours now.',
    rules: 'Slip backstage and soak up the scene: +3 Harmonic Charge.',
    kind: 'auto',
  },
  {
    id: 'divine_mission', icon: '\u{1F60E}\u{1F576}️', title: 'DIVINE MISSION', color: '#1a1a1a',
    flavor: 'Black suit. Black hat. Black shades. You are on a mission from God — and you are putting the band back together. The faithful who scattered come marching home.',
    rules: 'Reassemble the band: every fan in the Unsure pool returns to YOU as Casuals, and your demolition lockout clears. +1 Vibe of righteous purpose. Plus a blessing — you shrug off the NEXT demolition or hazard that would hit you.',
    kind: 'auto',
  },
];
export const EVENT_BY_ID = Object.fromEntries(EVENT_DECK.map(e => [e.id, e]));
