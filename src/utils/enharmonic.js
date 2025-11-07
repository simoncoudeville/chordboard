import { Note } from '@tonaljs/tonal';

/**
 * Sharp keys prefer sharp accidentals: G, D, A, E, B, F#, C#
 * Flat keys prefer flat accidentals: F, Bb, Eb, Ab, Db, Gb, Cb
 */
const SHARP_KEYS = ['G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
const FLAT_KEYS = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];

/**
 * Format a note name using enharmonic equivalents based on the global key.
 * @param {string} note - The note to format (e.g., "C#4", "Db", "E")
 * @param {string} globalScale - The current global scale root (e.g., "C", "G", "Bb")
 * @returns {string} - Formatted note name with appropriate sharp/flat
 */
export function formatNoteName(note, globalScale = 'C') {
  if (!note) return '';
  
  const info = Note.get(note);
  if (!info || !info.pc) return note;
  
  const pc = info.pc;
  const octave = info.oct;
  
  // Determine if we should use sharps or flats
  const useSharp = SHARP_KEYS.includes(globalScale) || 
                   (!FLAT_KEYS.includes(globalScale) && !SHARP_KEYS.includes(globalScale)); // default to sharps
  
  // If note is natural (C, D, E, F, G, A, B), return as-is
  if (!pc.includes('#') && !pc.includes('b')) {
    return typeof octave === 'number' ? `${pc}${octave}` : pc;
  }
  
  // Get enharmonic equivalent
  let formatted;
  if (useSharp) {
    // Prefer sharp notation
    formatted = pc.includes('b') ? Note.enharmonic(pc) : pc;
  } else {
    // Prefer flat notation
    formatted = pc.includes('#') ? Note.enharmonic(pc) : pc;
  }
  
  // Append octave if present
  return typeof octave === 'number' ? `${formatted}${octave}` : formatted;
}

/**
 * Format a chord symbol using enharmonic equivalents based on the global key.
 * @param {string} chordSymbol - The chord symbol (e.g., "C#m7", "Dbmaj7")
 * @param {string} globalScale - The current global scale root
 * @returns {string} - Formatted chord symbol
 */
export function formatChordSymbol(chordSymbol, globalScale = 'C') {
  if (!chordSymbol) return '';
  
  // Extract root note (everything before the first lowercase letter, number, or special char)
  const match = chordSymbol.match(/^([A-G][#b]?)/);
  if (!match) return chordSymbol;
  
  const root = match[1];
  const suffix = chordSymbol.slice(root.length);
  
  const formattedRoot = formatNoteName(root, globalScale);
  return formattedRoot + suffix;
}
