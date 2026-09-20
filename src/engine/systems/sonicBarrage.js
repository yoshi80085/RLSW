// Pure, replayable ledger. Presentation never rolls or changes this verdict.
export function resolveSonicBarrage(drive, shieldHp) {
  let hp = shieldHp;
  const shots = drive.map((strength, index) => {
    const before = hp, absorbed = Math.min(hp, strength);
    hp -= absorbed;
    return { index, strength, before, after: hp, absorbed,
      through: strength - absorbed, breaks: before > 0 && hp === 0 };
  });
  return { shots, shieldRemaining: hp,
    strengthThrough: shots.reduce((sum, s) => sum + s.through, 0),
    breakIndex: shots.findIndex(s => s.breaks) };
}
