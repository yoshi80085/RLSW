// Match IDs identify seats; character IDs identify an arsenal and innate rules.
// Legacy saves with unsuffixed IDs remain readable.
export function characterId(spiritOrId) {
  const id = typeof spiritOrId === 'object' && spiritOrId !== null
    ? spiritOrId.characterId ?? spiritOrId.id : spiritOrId;
  return typeof id === 'string' ? id.split('::')[0] : id;
}
export function seatId(character, corner) { return `${characterId(character)}::${corner}`; }
