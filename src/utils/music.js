import { Note } from "@tonaljs/tonal";

// Map tonal pitch class to Keyboard.vue key token (c, db, d, eb, e, f, gb, g, ab, a, bb, b)
export function pcToKeyToken(pc) {
  if (!pc) return null;
  const allowed = new Set([
    "c",
    "db",
    "d",
    "eb",
    "e",
    "f",
    "gb",
    "g",
    "ab",
    "a",
    "bb",
    "b",
  ]);

  const toTok = (x) => String(x || "").toLowerCase();

  // 1) Try raw pc
  let tok = toTok(pc);
  if (allowed.has(tok)) return tok;

  // 2) Try enharmonic equivalent (covers Cb->B, Fb->E, E#->F, B#->C, F#->Gb, etc.)
  try {
    const enh = Note.enharmonic(pc);
    tok = toTok(enh);
    if (allowed.has(tok)) return tok;
  } catch {}

  // 3) Explicit edge-case fallbacks for rare spellings
  const explicitMap = {
    cb: "b",
    fb: "e",
    "e#": "f",
    "b#": "c",
  };
  if (explicitMap[tok]) return explicitMap[tok];

  // 4) Last resort: strip accidentals
  tok = toTok(pc.replace(/[#b]+/g, ""));
  if (allowed.has(tok)) return tok;

  return null;
}

// Normalize a spelled pitch class + octave to a keyboard token + corrected octave,
// accounting for enharmonic octave crossings: CbN->B(N-1), FbN->E(N-1), B#N->C(N+1), E#N->F(N+1)
export function normalizePcOct(pc, octave) {
  if (!pc || typeof octave !== "number") return [null, null];
  const pcLower = String(pc).toLowerCase();
  // Only Cb and B# cross octaves relative to their naturals
  if (pcLower.startsWith("cb")) return ["b", octave - 1];
  if (pcLower.startsWith("b#")) return ["c", octave + 1];
  // Fb=E and E#=F do not cross octaves
  const tok = pcToKeyToken(pc);
  return [tok, octave];
}
