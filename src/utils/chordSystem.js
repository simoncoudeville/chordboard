import { Chord, Note } from "@tonaljs/tonal";

export const DEFAULT_EXTENSION = "none";

export const CHORD_TYPES = Object.freeze([
  "major",
  "minor",
  "diminished",
  "halfDiminished",
  "augmented",
  "sus2",
  "sus4",
  "power",
]);

export const ALLOWED_EXTENSIONS_BY_TYPE = Object.freeze({
  major: ["none", "6", "maj7", "maj9", "add9", "7", "9", "13"],
  minor: ["none", "6", "7", "9", "11", "13", "add9"],
  diminished: ["none", "7"],
  halfDiminished: ["none"],
  augmented: ["none", "maj7", "9"],
  sus2: ["none", "add9"],
  sus4: ["none", "add9"],
  power: ["none"],
});

const TYPE_ALIAS_MAP = Object.freeze(
  Object.fromEntries(
    [
      ["major", "major"],
      ["maj", "major"],
      ["minor", "minor"],
      ["min", "minor"],
      ["m", "minor"],
      ["diminished", "diminished"],
      ["dim", "diminished"],
      ["half-diminished", "halfDiminished"],
      ["half diminished", "halfDiminished"],
      ["halfdiminished", "halfDiminished"],
      ["halfdim", "halfDiminished"],
      ["halfDiminished", "halfDiminished"],
      ["augmented", "augmented"],
      ["aug", "augmented"],
      ["sus2", "sus2"],
      ["sus4", "sus4"],
      ["power", "power"],
      ["power (5)", "power"],
    ].concat(CHORD_TYPES.map((type) => [type, type]))
  )
);

const NON_TERTIAN_TYPES = new Set(["sus2", "sus4", "power"]);

function dedupePitchClasses(notes) {
  const result = [];
  const seen = new Set();
  for (const note of notes || []) {
    const pc = Note.get(note)?.pc || note.replace(/[0-9]/g, "");
    if (!seen.has(pc)) {
      seen.add(pc);
      result.push(pc);
    }
  }
  return result;
}

export function normalizeChordType(value) {
  if (value == null) return "major";
  const raw = String(value).trim();
  if (!raw) return "major";
  const lower = raw.toLowerCase();
  const collapsed = lower.replace(/[_\s-]+/g, "");
  return (
    TYPE_ALIAS_MAP[raw] ||
    TYPE_ALIAS_MAP[lower] ||
    TYPE_ALIAS_MAP[collapsed] ||
    "major"
  );
}

export function normalizeExtension(value) {
  if (value == null) return DEFAULT_EXTENSION;
  const raw = String(value).trim();
  if (!raw) return DEFAULT_EXTENSION;
  const lower = raw.toLowerCase();
  if (lower === "none" || lower === "triad") return DEFAULT_EXTENSION;
  return raw;
}

export function allowedExtensionsForChordType(type) {
  const chordType = normalizeChordType(type);
  const list = ALLOWED_EXTENSIONS_BY_TYPE[chordType] || [DEFAULT_EXTENSION];
  const seen = new Set();
  const result = [];
  for (const item of list) {
    const normalized = normalizeExtension(item);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  if (!seen.has(DEFAULT_EXTENSION)) {
    result.unshift(DEFAULT_EXTENSION);
  }
  return result;
}

export function chordIsNonTertian(type) {
  return NON_TERTIAN_TYPES.has(normalizeChordType(type));
}

function buildMajorChordSymbols(root, extension) {
  switch (extension) {
    case "none":
      return { display: `${root}`, tonal: `${root}` };
    case "6":
      return { display: `${root}6`, tonal: `${root}6` };
    case "maj7":
      return { display: `${root}maj7`, tonal: `${root}maj7` };
    case "maj9":
      return { display: `${root}maj9`, tonal: `${root}maj9` };
    case "add9":
      return { display: `${root}add9`, tonal: `${root}add9` };
    case "7":
      return { display: `${root}7`, tonal: `${root}7` };
    case "9":
      return { display: `${root}9`, tonal: `${root}9` };
    case "13":
      return { display: `${root}13`, tonal: `${root}13` };
    default:
      return { display: `${root}`, tonal: `${root}` };
  }
}

function buildMinorChordSymbols(root, extension) {
  switch (extension) {
    case "none":
      return { display: `${root}m`, tonal: `${root}m` };
    case "6":
      return { display: `${root}m6`, tonal: `${root}m6` };
    case "7":
      return { display: `${root}m7`, tonal: `${root}m7` };
    case "9":
      return { display: `${root}m9`, tonal: `${root}m9` };
    case "11":
      return { display: `${root}m11`, tonal: `${root}m11` };
    case "13":
      return { display: `${root}m13`, tonal: `${root}m13` };
    case "add9":
      return { display: `${root}madd9`, tonal: `${root}madd9` };
    default:
      return { display: `${root}m`, tonal: `${root}m` };
  }
}

function buildDiminishedChordSymbols(root, extension) {
  switch (extension) {
    case "none":
      return { display: `${root}dim`, tonal: `${root}dim` };
    case "7":
      return { display: `${root}dim7`, tonal: `${root}dim7` };
    default:
      return { display: `${root}dim`, tonal: `${root}dim` };
  }
}

function buildHalfDiminishedChordSymbols(root) {
  return { display: `${root}m7b5`, tonal: `${root}m7b5` };
}

function buildAugmentedChordSymbols(root, extension) {
  switch (extension) {
    case "none":
      return { display: `${root}aug`, tonal: `${root}aug` };
    case "maj7":
      return { display: `${root}maj7#5`, tonal: `${root}maj7#5` };
    case "9":
      return { display: `${root}9#5`, tonal: `${root}9#5` };
    default:
      return { display: `${root}aug`, tonal: `${root}aug` };
  }
}

function buildSus2ChordSymbols(root, extension) {
  if (extension === "add9") {
    return { display: `${root}sus2add9`, tonal: `${root}sus2` };
  }
  return { display: `${root}sus2`, tonal: `${root}sus2` };
}

function buildSus4ChordSymbols(root, extension) {
  if (extension === "add9") {
    return { display: `${root}sus4add9`, tonal: `${root}sus4` };
  }
  return { display: `${root}sus4`, tonal: `${root}sus4` };
}

function buildPowerChordSymbols(root) {
  return { display: `${root}5`, tonal: `${root}5` };
}

const CHORD_SYMBOL_BUILDERS = {
  major: buildMajorChordSymbols,
  minor: buildMinorChordSymbols,
  diminished: buildDiminishedChordSymbols,
  halfDiminished: buildHalfDiminishedChordSymbols,
  augmented: buildAugmentedChordSymbols,
  sus2: buildSus2ChordSymbols,
  sus4: buildSus4ChordSymbols,
  power: buildPowerChordSymbols,
};

export function buildChordDefinition(rootPc, type, extension) {
  const chordType = normalizeChordType(type);
  const ext = normalizeExtension(extension);
  const builder = CHORD_SYMBOL_BUILDERS[chordType] || buildMajorChordSymbols;
  const { display, tonal } = builder(rootPc, ext);
  const tonalSymbol = tonal || display;
  const chord = Chord.get(tonalSymbol);
  if (Array.isArray(chord.notes) && chord.notes.length) {
    return {
      displaySymbol: display,
      tonalSymbol,
      notes: dedupePitchClasses(chord.notes),
    };
  }

  let fallback = [];
  if (chordType === "sus2" && ext === "add9") {
    fallback = Chord.get(`${rootPc}sus2`).notes;
  } else if (chordType === "sus4" && ext === "add9") {
    fallback = Chord.get(`${rootPc}sus4`).notes;
  }

  if (fallback && fallback.length) {
    return {
      displaySymbol: display,
      tonalSymbol,
      notes: dedupePitchClasses(fallback),
    };
  }

  return {
    displaySymbol: display,
    tonalSymbol,
    notes: [rootPc],
  };
}

export function chordNoteCount(rootPc, type, extension) {
  return buildChordDefinition(rootPc, type, extension).notes.length;
}
