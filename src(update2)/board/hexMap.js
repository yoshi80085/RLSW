// ─── 111-HEX MAP ──────────────────────────────────────────────────────────────
import { HEX_SIZE, COL_SPACING, ROW_SPACING } from "./constants.js";

export const COLUMNS = [
  [1,2,3,4,5],
  [6,7,8,9,10,11,12,13],
  [14,15,16,17,18,19,20,21,22],
  [23,24,25,26,27,28,29,30,31,32],
  [33,34,35,36,37,38,39,40,41],
  [42,43,44,45,46,47,48,49,50,51],
  [52,53,54,55,56,57,58,59,60],
  [61,62,63,64,65,66,67,68,69,70],
  [71,72,73,74,75,76,77,78,79],
  [80,81,82,83,84,85,86,87,88,89],
  [90,91,92,93,94,95,96,97,98],
  [99,100,101,102,103,104,105,106],
  [107,108,109,110,111],
];
export const COL_TOP_OFFSETS = [4,2,2,1,2,1,2,1,2,1,2,2,4];
export const COL0_X = 1275;
export const ROW0_Y = 75;

export const EDGE_HEX_NUMS = new Set([
  1,2,3,4,5,
  6,13,
  14,22,
  23,32,
  33,41,
  42,51,
  52,60,
  61,70,
  71,79,
  80,89,
  90,98,
  99,100,105,106,
  107,108,109,110,111,
]);

export function buildHexMap() {
  const map = {};
  const byQR = {};
  COLUMNS.forEach((col, colIdx) => {
    const offset = COL_TOP_OFFSETS[colIdx];
    const cxImg = COL0_X + colIdx * COL_SPACING;
    const colYOffset = (colIdx % 2 === 1) ? HEX_SIZE : 0;
    col.forEach((num, rowInCol) => {
      const rowAbs = offset + rowInCol;
      const cyImg = ROW0_Y + rowAbs * ROW_SPACING + colYOffset;
      const q = colIdx - 6;
      const r = rowAbs - (colIdx - (colIdx & 1)) / 2;
      const hex = {
        num, q, r: Math.round(r),
        col: colIdx, row: rowAbs,
        px: Math.round(cxImg),
        py: Math.round(cyImg),
        edge: EDGE_HEX_NUMS.has(num),
        stage: num === 56,
      };
      map[num] = hex;
      byQR[`${hex.q},${hex.r}`] = hex;
    });
  });
  return { map, byQR };
}

export const { map: HEX_BY_NUM, byQR: HEX_BY_QR } = buildHexMap();
export const ALL_HEXES = Object.values(HEX_BY_NUM);
