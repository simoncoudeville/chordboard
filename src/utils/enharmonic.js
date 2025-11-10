import { Note, Scale } from "@tonaljs/tonal";

/**
 * Sharp keys prefer sharp accidentals: G, D, A, E, B, F#, C#
 * Flat keys prefer flat accidentals: F, Bb, Eb, Ab, Db, Gb, Cb
 */
const SHARP_KEYS = ["G", "D", "A", "E", "B", "F#", "C#"];
const FLAT_KEYS = ["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"];

const TITLE_CASE_CACHE = new Map();

function toTitleCase(input = "") {
  if (!input) return "";
  if (TITLE_CASE_CACHE.has(input)) return TITLE_CASE_CACHE.get(input);
  const formatted = input
    .split(/\s+/)
    .map((part) =>
      part.length ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part
    )
    .join(" ");
  TITLE_CASE_CACHE.set(input, formatted);
  return formatted;
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
  if (!root) return "C";
  const scale = Scale.get(`${root} ${type}`);
  // Use Tonal's canonical tonic if available
  if (scale && scale.tonic) {
    return scale.tonic;
  }
  return root;
}

export function formatScaleName(root, type = "major") {
  const preferredRoot = preferredScaleRoot(root, type);
  // User preference: keep ASCII accidentals and use lowercase scale type
  const displayRoot = preferredRoot; // e.g. Ab, C#, Gb
  const displayType = String(type || "").toLowerCase(); // "major" or "minor"
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
  if (!note) return "";

  const simplified = simplifyNoteName(note);
  const info = Note.get(simplified);
  if (!info || !info.pc) return note;

  const pc = info.pc;
  const octave = info.oct;
  const preferredRoot = preferredScaleRoot(globalScale, scaleType);

  // Determine if we should use sharps or flats
  const useSharp =
    SHARP_KEYS.includes(preferredRoot) ||
    (!FLAT_KEYS.includes(preferredRoot) && !SHARP_KEYS.includes(preferredRoot));

  // If note is natural (C, D, E, F, G, A, B), return as-is
  if (!pc.includes("#") && !pc.includes("b")) {
    return typeof octave === "number" ? `${pc}${octave}` : pc;
  }

  // Get enharmonic equivalent
  let formatted;
  if (useSharp) {
    // Prefer sharp notation
    formatted = pc.includes("b") ? Note.enharmonic(pc) : pc;
  } else {
    // Prefer flat notation
    formatted = pc.includes("#") ? Note.enharmonic(pc) : pc;
  }

  // Append octave if present
  return typeof octave === "number" ? `${formatted}${octave}` : formatted;
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
  if (!chordSymbol) return "";

  // Extract root note (everything before the first lowercase letter, number, or special char)
  const match = chordSymbol.match(/^([A-G][#b]?)/);
  if (!match) return chordSymbol;

  const root = match[1];
  const suffix = chordSymbol.slice(root.length);

  const formattedRoot = formatNoteName(root, globalScale, scaleType);
  return formattedRoot + suffix;
}
