import { describe, it, expect } from "vitest";
import { pcToKeyToken } from "../src/utils/music";

const cases = [
  // Naturals
  ["C", "c"],
  ["D", "d"],
  ["E", "e"],
  ["F", "f"],
  ["G", "g"],
  ["A", "a"],
  ["B", "b"],
  // Simple flats already supported
  ["Db", "db"],
  ["Eb", "eb"],
  ["Gb", "gb"],
  ["Ab", "ab"],
  ["Bb", "bb"],
  // Enharmonic sharps → flats
  ["C#", "db"],
  ["D#", "eb"],
  ["F#", "gb"],
  ["G#", "ab"],
  ["A#", "bb"],
  // Special spellings
  ["Cb", "b"],
  ["Fb", "e"],
  ["E#", "f"],
  ["B#", "c"],
];

describe("pcToKeyToken", () => {
  it("maps pitch classes to keyboard key tokens", () => {
    for (const [input, expected] of cases) {
      expect(pcToKeyToken(input)).toBe(expected);
    }
  });

  it("returns null for garbage", () => {
    expect(pcToKeyToken("H")).toBe(null);
    expect(pcToKeyToken("R##")).toBe(null);
    expect(pcToKeyToken("")).toBe(null);
    expect(pcToKeyToken(null)).toBe(null);
  });
});
