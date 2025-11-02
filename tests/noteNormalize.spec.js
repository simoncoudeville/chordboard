import { describe, it, expect } from "vitest";
import { normalizePcOct, pcToKeyToken } from "../src/utils/music";

const cases = [
  // Non-crossing
  ["Ab", 3, ["ab", 3]],
  ["Db", 4, ["db", 4]],
  ["C#", 4, ["db", 4]],
  // Crossing down
  ["Cb", 4, ["b", 3]],
  // Non-crossing enharmonics within octave
  ["Fb", 3, ["e", 3]],
  ["E#", 3, ["f", 3]],
  // Crossing up
  ["B#", 3, ["c", 4]],
];

describe("normalizePcOct", () => {
  it("maps pc+oct to keyboard token with corrected octave", () => {
    for (const [pc, oct, expected] of cases) {
      expect(normalizePcOct(pc, oct)).toEqual(expected);
    }
  });
});
