import { describe, it, expect } from "vitest";
import { Chord } from "@tonaljs/tonal";
import { pcToKeyToken } from "../src/utils/music";

function chordTokens(symbol) {
  const pcs = Chord.get(symbol).notes; // pitch classes (no octaves)
  const toks = pcs.map(pcToKeyToken).filter(Boolean);
  return new Set(toks);
}

describe("Chord -> keyboard tokens", () => {
  it("Abm triad has 3 keys", () => {
    expect(chordTokens("Abm").size).toBe(3);
  });
  it("Bbdim triad has 3 keys", () => {
    // minor triad with flat fifth
    expect(chordTokens("Bbdim").size).toBe(3);
  });
  it("Cb major triad has 3 keys", () => {
    expect(chordTokens("Cb").size).toBe(3);
  });
  it("Db minor triad has 3 keys", () => {
    expect(chordTokens("Dbm").size).toBe(3);
  });
  it("Eb minor triad has 3 keys", () => {
    expect(chordTokens("Ebm").size).toBe(3);
  });
  it("Fb major triad has 3 keys", () => {
    expect(chordTokens("Fb").size).toBe(3);
  });
  it("Gb major triad has 3 keys", () => {
    expect(chordTokens("Gb").size).toBe(3);
  });
});
