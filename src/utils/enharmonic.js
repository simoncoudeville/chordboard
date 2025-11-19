import { Note, Scale } from "@tonaljs/tonal";

const MAJOR_SHARP_KEYS = new Set(["C", "G", "D", "A", "E", "B", "F#"]);
const MAJOR_FLAT_KEYS = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb"]);

function isMinorLike(type = "") {
  return String(type).toLowerCase().includes("minor");
}

function sanitizePitchClass(value) {
  if (!value) return "C";
  try {
    const info = Note.get(value);
    if (info?.pc) return info.pc;
  } catch {}
  const match = String(value).match(/^[A-Ga-g][#b]?/);
  if (match) {
    const [letter, accidental] = [match[0][0], match[0].slice(1)];
    return letter.toUpperCase() + accidental;
  }
  return "C";
}

function normalizePitchClassToStyle(pc, style) {
  if (!pc) return pc;
  if (style !== "flat" && style !== "sharp") return pc;
  const wantsFlat = style === "flat";
  const wantsSharp = style === "sharp";
  if (wantsFlat && !pc.includes("#")) return pc;
  if (wantsSharp && !pc.includes("b")) return pc;

  let current = pc;
  const visited = new Set();
  while (!visited.has(current)) {
    visited.add(current);
    try {
      const next = Note.enharmonic(current);
      if (!next || next === current) break;
      current = next;
      if (wantsFlat && !current.includes("#")) return current;
      if (wantsSharp && !current.includes("b")) return current;
    } catch {
      break;
    }
  }
  return current;
}

function normalizeKeyRootForMode(root, type) {
  const minorLike = isMinorLike(type);
  const preferStyle = minorLike ? "sharp" : "flat";
  const pc = sanitizePitchClass(root);
  return normalizePitchClassToStyle(pc, preferStyle);
}

function sanitizeRelativeMajor(rootPc) {
  const transposed = Note.transpose(rootPc || "C", "m3");
  const pc = sanitizePitchClass(transposed || "C");
  return normalizePitchClassToStyle(pc, "flat");
}

export function getAccidentalStyleForKey(root, type = "major") {
  const minorLike = isMinorLike(type);
  const keyRoot = normalizeKeyRootForMode(root, type);
  const keyToCheck = minorLike ? sanitizeRelativeMajor(keyRoot) : keyRoot;
  if (MAJOR_FLAT_KEYS.has(keyToCheck)) return "flat";
  if (MAJOR_SHARP_KEYS.has(keyToCheck)) return "sharp";
  return "sharp";
}

function accidentalScore(note = "") {
  const accidentals = note.replace(/[A-G]/gi, "");
  if (!accidentals) return 0;
  // Penalise double accidentals slightly more to avoid Bbb/C## style spellings
  return accidentals.length;
}

/**
 * Simplify a note name by mapping it to its nearest enharmonic equivalent.
 * Returns the input unchanged if Tonal cannot parse the note.
 */
export function simplifyNoteName(note) {
  if (!note) return note;
  const info = Note.get(note);
  if (!info || (!info.name && !info.pc)) return note;

  const baseName = info.name || info.pc || note;
  const { alt, oct } = info;
  if (typeof alt === "number" && Math.abs(alt) <= 1) {
    return baseName;
  }

  const enh = Note.enharmonic(baseName);
  if (!enh) return baseName;

  const enhHasOctave = /\d$/.test(enh);
  if (enhHasOctave) return enh;
  return typeof oct === "number" ? `${enh}${oct}` : enh;
}

/**
 * Determine the preferred enharmonic spelling for the given scale root/type.
 * Uses Tonal.js to get the canonical tonic from the scale.
 */
export function preferredScaleRoot(root, type = "major") {
  const style = getAccidentalStyleForKey(root, type);
  return normalizeNoteToStyle(root || "C", style) || "C";
}

export function formatScaleName(root, type = "major") {
  const style = getAccidentalStyleForKey(root, type);
  const displayRoot = normalizeNoteToStyle(root || "C", style);
  const displayType = String(type || "").toLowerCase();
  return `${displayRoot} ${displayType}`.trim();
}

/**
 * Format a note name using enharmonic equivalents based on the global key.
 * @param {string} note - The note to format (e.g., "C#4", "Db", "E")
 * @param {string} globalScale - The current global scale root (e.g., "C", "G", "Bb")
 * @param {string} scaleType - The current global scale type (e.g., "major")
 * @returns {string} - Formatted note name with appropriate sharp/flat
 */
export function formatNoteName(note, globalScale = "C", scaleType = "major") {
  const style = getAccidentalStyleForKey(globalScale, scaleType);
  return normalizeNoteToStyle(note, style);
}

/**
 * Format a chord symbol using enharmonic equivalents based on the global key.
 * @param {string} chordSymbol - The chord symbol (e.g., "C#m7", "Dbmaj7")
 * @param {string} globalScale - The current global scale root
 * @param {string} scaleType - The current global scale type
 * @returns {string} - Formatted chord symbol
 */
export function formatChordSymbol(
  chordSymbol,
  globalScale = "C",
  scaleType = "major"
) {
  const style = getAccidentalStyleForKey(globalScale, scaleType);
  return normalizeChordNameToStyle(chordSymbol, style);
}

export function normalizeNoteToStyle(note, style = "sharp") {
  if (!note) return "";
  const simplified = simplifyNoteName(note);
  const info = Note.get(simplified);
  if (!info || !info.pc) return note;
  const targetPc = normalizePitchClassToStyle(info.pc, style);
  return typeof info.oct === "number" ? `${targetPc}${info.oct}` : targetPc;
}

export function normalizeChordNameToStyle(chordName, style = "sharp") {
  if (!chordName) return "";
  const slashIndex = chordName.indexOf("/");
  const mainPart = slashIndex >= 0 ? chordName.slice(0, slashIndex) : chordName;
  const slashPart = slashIndex >= 0 ? chordName.slice(slashIndex + 1) : "";
  const rootMatch = mainPart.match(/^([A-Ga-g][#b]?)/);
  if (!rootMatch) return chordName;
  const root = rootMatch[1];
  const normalizedRoot = normalizeNoteToStyle(root, style);
  let formatted = normalizedRoot + mainPart.slice(root.length);
  if (slashIndex >= 0) {
    if (slashPart) {
      const bassMatch = slashPart.match(/^([A-Ga-g][#b]?)/);
      if (bassMatch) {
        const normalizedBass = normalizeNoteToStyle(bassMatch[1], style);
        formatted += `/${normalizedBass}${slashPart.slice(
          bassMatch[1].length
        )}`;
      } else {
        formatted += `/${slashPart}`;
      }
    } else {
      formatted += "/";
    }
  }
  return formatted;
}

/**
 * Get the proper Roman numerals for a given scale type.
 * Returns an array of 7 Roman numerals with proper case and accidentals.
 */
export function getRomanNumeralsForScale(scaleType = "major") {
  const type = String(scaleType).toLowerCase().trim();

  // Major scale: I ii iii IV V vi vii°
  if (type === "major") {
    return ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
  }

  // Natural minor: i ii° III iv v VI VII
  if (type === "minor" || type === "natural minor") {
    return ["i", "ii°", "III", "iv", "v", "VI", "VII"];
  }

  // Harmonic minor: i ii° III+ iv V VI vii°
  if (type === "harmonic minor") {
    return ["i", "ii°", "III+", "iv", "V", "VI", "vii°"];
  }

  // For modal scales, derive from major pattern
  // Dorian: i ii III IV v vi° VII
  if (type === "dorian") {
    return ["i", "ii", "III", "IV", "v", "vi°", "VII"];
  }

  // Phrygian: i II III iv v° VI vii
  if (type === "phrygian") {
    return ["i", "II", "III", "iv", "v°", "VI", "vii"];
  }

  // Lydian: I II iii iv° V vi vii
  if (type === "lydian") {
    return ["I", "II", "iii", "iv°", "V", "vi", "vii"];
  }

  // Mixolydian: I ii iii° IV v vi VII
  if (type === "mixolydian") {
    return ["I", "ii", "iii°", "IV", "v", "vi", "VII"];
  }

  // Default to major if unknown
  return ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
}

/**
 * Format a chord name with its Roman numeral prefix.
 * @param {string} chordName - The chord symbol (e.g., "Dm", "G7")
 * @param {number} degreeIndex - Zero-based scale degree (0 = tonic)
 * @param {string} scaleType - The scale type
 * @returns {string} - Formatted as "roman chordName"
 */
export function formatChordWithRoman(
  chordName,
  degreeIndex,
  scaleType = "major"
) {
  const romans = getRomanNumeralsForScale(scaleType);
  const idx = Math.max(0, Math.min(6, degreeIndex % 7));
  const roman = romans[idx] || String(idx + 1);
  return `${roman} ${chordName}`;
}
