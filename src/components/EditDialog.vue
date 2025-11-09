<template>
  <dialog ref="dlg" @click.self="onClose" @cancel.prevent="onClose">
    <form class="dialog-body" method="dialog" @submit.prevent>
      <div class="dialog-top">
        <h2 class="dialog-title">Pad {{ padIndex + 1 }}</h2>
        <button
          type="button"
          class="dialog-close"
          @click="onClose"
          aria-label="Close"
        >
          <X
            class="dialog-close-icon"
            aria-hidden="true"
            :stroke-width="1.5"
            :absoluteStrokeWidth="true"
          />

          <span class="sr-only">Close</span>
        </button>
      </div>
      <div class="dialog-content">
        <div class="toggle-buttons">
          <label class="toggle-button"
            ><input
              class="toggle-button-input sr-only"
              type="radio"
              name="mode-chooser"
              v-model="model.mode"
              value="scale"
            /><span class="toggle-button-text">Scale mode</span>
          </label>
          <label class="toggle-button"
            ><input
              class="toggle-button-input sr-only"
              type="radio"
              name="mode-chooser"
              v-model="model.mode"
              value="free"
            /><span class="toggle-button-text">Free mode</span>
          </label>
        </div>
      </div>
      <template v-if="model.mode === 'scale'">
        <div class="dialog-content">
          <p class="global-scale-info">
            <Music2
              aria-hidden="true"
              :size="16"
              :stroke-width="1"
              :absoluteStrokeWidth="true"
            />
            Global scale: <span>{{ globalScaleDisplay }}</span>            
          </p>
        </div>
      </template>
      <div class="dialog-content edit-grid">
        <!-- Primary chord selector: degree (scale mode) or root/type (free mode) -->
        <template v-if="model.mode === 'scale'">
          <label class="edit-grid-item">
            <span class="label-text">Chord</span>
            <CustomSelect
              v-model="stateScale.degree"
              wrapper-class="select-chord"
            >
              <template #options>
                <option
                  v-for="ch in editChordOptions"
                  :key="ch.degree"
                  :value="ch.degree"
                >
                  {{ ch.display }}
                </option>
              </template>
            </CustomSelect>
          </label>
        </template>
        <template v-else>
          <label class="edit-grid-item">
            <span class="label-text">Root</span>
            <CustomSelect
              v-model="stateFree.root"
              :options="rootOptions"
              option-value-key="value"
              option-label-key="label"
              wrapper-class="select-scale"
            />
          </label>
          <label class="edit-grid-item">
            <span class="label-text">Type</span>
            <CustomSelect
              v-model="stateFree.type"
              :options="freeTypeOptions"
              option-value-key="value"
              option-label-key="label"
            />
          </label>
        </template>

        <!-- Root octave always active -->
        <label class="edit-grid-item">
          <span class="label-text">Root octave</span>
          <CustomSelect
            v-model="currentOctave"
            :options="[2, 3, 4, 5]"
            :cast-number="true"
          />
        </label>

        <!-- Chord type / extension -->
        <label class="edit-grid-item">
          <span class="label-text">Extension</span>
          <CustomSelect
            v-model="currentExtension"
            :options="extensionOptions"
          />
        </label>

        <!-- Inversion then Voicing pattern -->
        <label class="edit-grid-item">
          <span class="label-text">Inversion</span>
          <CustomSelect
            v-model="currentInversion"
            :options="validInversions"
            :disabled="!currentExtension || isNonTertianChord"
          />
        </label>
        <label class="edit-grid-item">
          <span class="label-text">Voicing</span>
          <CustomSelect
            v-model="currentVoicing"
            :options="voicingTypeOptions"
            :disabled="isNonTertianChord || !currentExtension"
          />
        </label>
      </div>
      <div class="dialog-content chord-preview">
        <div class="chord-preview-output">
          <div class="chord-preview-summary">
            <div class="chord-preview-symbol">
              <span class="uppercase color-meta">Chord: </span>
              <span>{{ previewChordHtml }}</span>
            </div>
            <div class="chord-preview-notes">
              <span class="uppercase color-meta">Notes: </span>
              <span>{{ previewNotesHtml }}</span>
            </div>
          </div>
          <button
            type="button"
            class="chord-preview-play-button"
            :disabled="!hasChordForPreview"
            @pointerdown.prevent.stop="
              $emit('preview-start', {
                event: $event,
                notes: previewNotesAsc,
              })
            "
            @pointerup.prevent.stop="$emit('preview-stop', { event: $event })"
            @pointerleave.prevent.stop="
              $emit('preview-stop', { event: $event })
            "
            @pointercancel.prevent.stop="
              $emit('preview-stop', { event: $event })
            "
            @contextmenu.prevent
          >
            <Headphones
              aria-hidden="true"
              :stroke-width="1"
              :size="16"
              :absoluteStrokeWidth="true"
            />
          </button>
        </div>
        <KeyboardExtended
          :highlighted-notes="previewNotesAsc"
          :start-octave="1"
          :octaves="7"
        />
        <!--<button
          type="button"
          class="button large preview"
          :disabled="!hasChordForPreview"
          @pointerdown.prevent.stop="
            $emit('preview-start', {
              event: $event,
              notes: previewNotesAsc,
            })
          "
          @pointerup.prevent.stop="$emit('preview-stop', { event: $event })"
          @pointerleave.prevent.stop="$emit('preview-stop', { event: $event })"
          @pointercancel.prevent.stop="$emit('preview-stop', { event: $event })"
          @contextmenu.prevent
        >
          Play Chord
        </button>
        -->
      </div>
      <div class="dialog-buttons">
        <button type="button" @click="onClose">Cancel</button>
        <button
          type="button"
          @click="$emit('save', buildPadSnapshot())"
          :disabled="!isDirty"
        >
          Save
        </button>
      </div>
    </form>
  </dialog>
</template>

<script setup>
import { ref, computed, reactive, watch, nextTick } from "vue";
import { X, Music2, Volume1, Headphones } from "lucide-vue-next";
import CustomSelect from "./CustomSelect.vue";
import KeyboardExtended from "./KeyboardExtended.vue";
import { Scale, Chord, Note } from "@tonaljs/tonal";
import { formatNoteName, formatChordSymbol } from "../utils/enharmonic";

// Keep padIndex so the title continues to work; expose open/close for parent
const props = defineProps({
  padIndex: { type: Number, default: 0 },
  // Receive current global scale from parent (App.vue)
  globalScaleRoot: { type: String, default: "" },
  globalScaleDisplay: { type: String, default: "" },
  globalScaleType: { type: String, default: "" },
  permissionAllowed: { type: Boolean, default: false },
  midiEnabled: { type: Boolean, default: false },
  // New: incoming saved state for this pad (or null)
  padState: { type: Object, default: null },
});

// Declare emits used in template to avoid warnings
const emit = defineEmits(["save", "close", "preview-start", "preview-stop"]);

const dlg = ref(null);

// Mode flag only; all other selections are kept separate per mode
const model = ref({ mode: "scale" });

// Independent state per mode
const stateScale = reactive({
  degree: "1", // default to tonic degree
  octave: 4,
  extension: "triad",
  inversion: "root",
  voicing: "close",
});

const stateFree = reactive({
  root: "C",
  type: "major", // or "minor"
  octave: 4,
  extension: "triad",
  inversion: "root",
  voicing: "close",
});

const previousScaleExtension = ref("triad");
const previousFreeExtension = ref("triad");

// Mode-bridged computed bindings for shared controls
const currentOctave = computed({
  get: () =>
    model.value.mode === "scale" ? stateScale.octave : stateFree.octave,
  set: (v) => {
    if (model.value.mode === "scale") stateScale.octave = v;
    else stateFree.octave = v;
  },
});
const currentExtension = computed({
  get: () =>
    model.value.mode === "scale" ? stateScale.extension : stateFree.extension,
  set: (v) => {
    if (model.value.mode === "scale") stateScale.extension = v;
    else stateFree.extension = v;
  },
});
const currentInversion = computed({
  get: () =>
    model.value.mode === "scale" ? stateScale.inversion : stateFree.inversion,
  set: (v) => {
    if (model.value.mode === "scale") stateScale.inversion = v;
    else stateFree.inversion = v;
  },
});
const currentVoicing = computed({
  get: () =>
    model.value.mode === "scale" ? stateScale.voicing : stateFree.voicing,
  set: (v) => {
    if (model.value.mode === "scale") stateScale.voicing = v;
    else stateFree.voicing = v;
  },
});
// Notes for the current global scale (pitch classes, no octaves)
const scaleNotes = computed(() => {
  const root = props.globalScaleRoot || "C";
  const type = props.globalScaleType || "major";
  const { notes } = Scale.get(`${root} ${type}`);
  return Array.isArray(notes) ? notes : [];
});

// Helper to detect simple triad quality for a degree: "", "m", "dim", "aug"
function semitoneDistance(pcFrom, pcTo) {
  const base = Note.midi(`${pcFrom}4`) ?? 60;
  let target = Note.midi(`${pcTo}4`) ?? base;
  while (target < base) target += 12;
  return (target - base) % 12;
}
function qualityFromTriad(triad, rootPc) {
  const [r, t, f] = triad;
  if (!r || !t || !f) return "";
  const third = semitoneDistance(rootPc, t);
  const fifth = semitoneDistance(rootPc, f);
  if (third === 3 && fifth === 6) return "dim";
  if (third === 4 && fifth === 8) return "aug";
  if (third === 3 && fifth === 7) return "m";
  if (third === 4 && fifth === 7) return ""; // major
  return "";
}

function qualityForDegree(index) {
  const s = scaleNotes.value;
  if (!Array.isArray(s) || s.length < 3) return "";
  const i = index % s.length;
  const triad = [s[i], s[(i + 2) % s.length], s[(i + 4) % s.length]];
  return qualityFromTriad(triad, s[i]);
}

// Populate degree selector with chord symbols: C, Dm, Em, F, G, Am, Bdim, etc.
const ROMAN_DEGREES = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
const ROMAN_TO_NUMERIC = ROMAN_DEGREES.reduce((acc, roman, idx) => {
  acc[roman] = String(idx + 1);
  return acc;
}, {});

function normalizeDegree(value) {
  if (value == null) return "1";
  const raw = String(value).trim();
  if (raw in ROMAN_TO_NUMERIC) return ROMAN_TO_NUMERIC[raw];
  const normalizedSymbol = raw.replace(/º/g, "°");
  if (normalizedSymbol in ROMAN_TO_NUMERIC)
    return ROMAN_TO_NUMERIC[normalizedSymbol];
  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return String(((parsed - 1) % 7) + 1);
  }
  return "1";
}

function degreeNumber(value) {
  const normalized = normalizeDegree(value);
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(7, parsed)) : 1;
}

const editChordOptions = computed(() =>
  scaleNotes.value.map((n, i) => {
    const q = qualityForDegree(i);
    const suffix = q === "" ? "" : q === "m" ? "m" : q; // "m", "dim", "aug"
    // Add 7 to dominant (degree V) display (only if not already diminished/augmented)
    let display = `${n}${suffix}`;
    if (i === 4 && suffix === "") {
      display = `${n}7`;
    }
    return {
      degree: String(i + 1),
      roman: ROMAN_DEGREES[i] || String(i + 1),
      display,
    };
  })
);
// Root options for Free mode, generated via Tonal.
// Display both sharp and flat names for black keys.
const ROOT_PCS_SHARP = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
const rootOptions = computed(() => {
  return ROOT_PCS_SHARP.map((pc) => {
    if (pc.includes("#")) {
      const flat = Note.enharmonic(pc);
      // Display both: "C#/Db"
      return { value: flat, label: `${pc}/${flat}` };
    }
    return { value: pc, label: pc };
  });
});
const FREE_TYPE_OPTIONS = Object.freeze([
  { value: "major", label: "Major" },
  { value: "dominant", label: "Dominant" },
  { value: "minor", label: "Minor" },
  { value: "diminished", label: "Diminished" },
  { value: "half-diminished", label: "Half diminished" },
  { value: "augmented", label: "Augmented" },
  { value: "sus2", label: "Sus2" },
  { value: "sus4", label: "Sus4" },
  { value: "power", label: "Power" },
]);
const freeTypeOptions = FREE_TYPE_OPTIONS;
const CHORD_TYPE_EXTENSION_OPTIONS = Object.freeze({
  major: ["triad", "6", "7", "maj7", "maj9", "add9"],
  minor: [
    "triad",
    "6",
    "7",
    "9",
    "add9",
  ],
  dominant: ["7", "9", "add9"],
  diminished: ["triad", "7", "9"],
  halfDiminished: ["7", "9"],
  augmented: ["triad", "maj7", "9"],
  minorMajor: ["maj7", "maj9"],
  major6: ["6", "add9"],
  minor6: ["6", "add9"],
  sus2: ["sus2", "add9"],
  sus4: ["sus4", "add9"],
  power: ["power"],
});

function extensionOptionsForType(type) {
  const opts = CHORD_TYPE_EXTENSION_OPTIONS[type];
  return opts && opts.length ? [...opts] : ["triad"];
}

function isSuspension(ext) {
  return ext === "sus2" || ext === "sus4";
}

const scaleChordType = computed(() => determineScaleChordType(stateScale.extension));
const freeChordType = computed(() => determineFreeChordType(stateFree.extension));
const scaleBaseChordType = computed(() => determineScaleChordType("triad"));
const freeBaseChordType = computed(() => determineFreeChordType("triad"));
const scaleExtensionOptions = computed(() =>
  extensionOptionsForType(scaleBaseChordType.value)
);
const freeExtensionOptions = computed(() =>
  extensionOptionsForType(freeBaseChordType.value)
);
const extensionOptions = computed(() =>
  model.value.mode === "scale"
    ? scaleExtensionOptions.value
    : freeExtensionOptions.value
);

// Valid inversions based on current extension
const validInversions = computed(() => {
  const ext = currentExtension.value;
  const chordType =
    model.value.mode === "scale" ? scaleChordType.value : freeChordType.value;
  const noteCount = extensionNoteCount(ext, chordType);
  const maxIndex = Math.max(0, noteCount - 1);
  return editInversions.filter((_, idx) => idx <= maxIndex);
});

// All possible inversions for the dropdown
const editInversions = ["root", "1st", "2nd", "3rd", "4th", "5th", "6th"];
const voicingTypeOptions = ["close", "open", "drop2", "drop3", "spread"];
const isNonTertianChord = computed(() => isSuspension(currentExtension.value));

// Skip watcher side-effects while we restore a saved pad state
const isApplyingPadState = ref(false);

// Derive base triad quality for the selected scale degree ("", "m", "dim", "aug")
const baseQualityFromScale = computed(() => {
  if (model.value.mode !== "scale") return "";
  const s = scaleNotes.value;
  if (!Array.isArray(s) || s.length < 3) return "";
  const deg = degreeNumber(stateScale.degree);
  const i = (deg - 1) % s.length;
  // Stack diatonic thirds within the scale
  const triad = [s[i], s[(i + 2) % s.length], s[(i + 4) % s.length]];
  return qualityFromTriad(triad, s[i]);
});

// Compute chord root from degree (scale mode) or free root
const chordRootPc = computed(() => {
  if (model.value.mode === "scale") {
    const deg = degreeNumber(stateScale.degree);
    const idx = Math.max(0, deg - 1);
    return scaleNotes.value[idx] || "C";
  }
  return stateFree.root || "C";
});

function determineScaleChordType(extOverride = stateScale.extension) {
  const ext = extOverride || "triad";
  if (isSuspension(ext)) return ext;
  if (ext === "power") return "power";

  const quality = baseQualityFromScale.value;
  const deg = degreeNumber(stateScale.degree);

  if (quality === "dim") {
    if (ext === "7" || ext === "9") return "halfDiminished";
    return "diminished";
  }

  if (quality === "aug") {
    return "augmented";
  }

  if (quality === "m") {
    if (ext === "6") return "minor6";
    if (ext === "add9" && previousScaleExtension.value === "6")
      return "minor6";
    if (ext === "maj7" || ext === "maj9") return "minorMajor";
    return "minor";
  }

  // Major quality (including dominant)
  if (ext === "6") return "major6";
  if (ext === "add9" && previousScaleExtension.value === "6")
    return "major6";
  if (ext === "7" || ext === "9")
    return "dominant";
  if (deg === 5) return "dominant";
  return "major";
}

function determineFreeChordType(extOverride = stateFree.extension) {
  const ext = extOverride || "triad";
  const selection = stateFree.type || "major";

  if (isSuspension(ext)) return ext;
  if (ext === "power" || selection === "power") return "power";

  if (selection === "sus2") return "sus2";
  if (selection === "sus4") return "sus4";
  if (selection === "augmented") return "augmented";
  if (selection === "half-diminished") return "halfDiminished";
  if (selection === "diminished") return "diminished";
  if (selection === "dominant") return "dominant";

  if (selection === "minor") {
    if (ext === "6" || (ext === "add9" && previousFreeExtension.value === "6"))
      return "minor6";
    return "minor";
  }

  // default to major-type behaviour
  if (ext === "6" || (ext === "add9" && previousFreeExtension.value === "6"))
    return "major6";
  if (ext === "7" || ext === "9") return "dominant";
  return "major";
}

function extensionNoteCount(ext, chordType) {
  switch (ext) {
    case "power":
      return 2;
    case "sus2":
    case "sus4":
      return 3;
    case "triad":
      return chordType === "power" ? 2 : 3;
    case "6":
      return 4;
    case "7":
    case "maj7":
      return 4;
    case "9":
    case "maj9":
      return 5;
    case "add9":
      return chordType === "major6" || chordType === "minor6" ? 5 : 4;
    default:
      return 3;
  }
}

function buildChordSymbolForType(rootPc, chordType, ext) {
  const value = ext || "triad";
  switch (chordType) {
    case "major":
      switch (value) {
        case "triad":
          return `${rootPc}`;
        case "6":
          return `${rootPc}6`;
        case "maj7":
          return `${rootPc}maj7`;
        case "maj9":
          return `${rootPc}maj9`;
        case "add9":
          return `${rootPc}add9`;
        default:
          return `${rootPc}`;
      }
    case "major6":
      if (value === "add9") return `${rootPc}6add9`;
      return `${rootPc}6`;
    case "dominant":
      switch (value) {
        case "7":
          return `${rootPc}7`;
        case "9":
          return `${rootPc}9`;
        case "add9":
          return `${rootPc}add9`;
        default:
          return `${rootPc}7`;
      }
    case "minor":
      switch (value) {
        case "triad":
          return `${rootPc}m`;
        case "6":
          return `${rootPc}m6`;
        case "7":
          return `${rootPc}m7`;
        case "9":
          return `${rootPc}m9`;
        case "maj7":
          return `${rootPc}mMaj7`;
        case "maj9":
          return `${rootPc}mMaj9`;
        case "add9":
          return `${rootPc}madd9`;
        default:
          return `${rootPc}m`;
      }
    case "minor6":
      if (value === "add9") return `${rootPc}m6add9`;
      return `${rootPc}m6`;
    case "minorMajor":
      if (value === "maj9") return `${rootPc}mMaj9`;
      return `${rootPc}mMaj7`;
    case "halfDiminished":
      if (value === "9") return `${rootPc}m9b5`;
      return `${rootPc}m7b5`;
    case "augmented":
      if (value === "maj7") return `${rootPc}maj7#5`;
      if (value === "9") return `${rootPc}9#5`;
      return `${rootPc}aug`;
    case "sus2":
      if (value === "add9") return `${rootPc}sus2add9`;
      return `${rootPc}sus2`;
    case "sus4":
      if (value === "add9") return `${rootPc}sus4add9`;
      return `${rootPc}sus4`;
    case "power":
      return `${rootPc}5`;
    default:
      return `${rootPc}`;
  }
}

function mergeUniqueNotes(base, extras) {
  const result = [];
  const seen = new Set();
  for (const note of base || []) {
    const pc = Note.get(note)?.pc || note.replace(/[0-9]/g, "");
    if (!seen.has(pc)) {
      seen.add(pc);
      result.push(note);
    }
  }
  for (const note of extras || []) {
    const pc = Note.get(note)?.pc || note.replace(/[0-9]/g, "");
    if (!seen.has(pc)) {
      seen.add(pc);
      result.push(note);
    }
  }
  return result;
}

function getChordPitchClasses(rootPc, chordType, ext) {
  const symbol = buildChordSymbolForType(rootPc, chordType, ext);
  const pcs = Chord.get(symbol).notes;
  if (pcs && pcs.length) {
    return { symbol, pcs };
  }

  let fallbackNotes = [];
  switch (chordType) {
    case "major6":
      if (ext === "add9") {
        const base = Chord.get(`${rootPc}6`).notes;
        const extra = Chord.get(`${rootPc}add9`).notes;
        fallbackNotes = mergeUniqueNotes(base, extra);
      }
      break;
    case "minor6":
      if (ext === "add9") {
        const base = Chord.get(`${rootPc}m6`).notes;
        const extra = Chord.get(`${rootPc}madd9`).notes;
        fallbackNotes = mergeUniqueNotes(base, extra);
      }
      break;
    case "diminished":
      if (ext === "9") {
        const base = Chord.get(`${rootPc}dim7`).notes;
        const extra = Chord.get(`${rootPc}m9b5`).notes;
        fallbackNotes = mergeUniqueNotes(base, extra);
      }
      break;
    case "sus2":
      if (ext === "add9") {
        fallbackNotes = Chord.get(`${rootPc}sus2`).notes;
      }
      break;
    default:
      break;
  }

  if (fallbackNotes && fallbackNotes.length) {
    return { symbol, pcs: fallbackNotes };
  }

  const fallbackRoot = `${rootPc}`;
  return { symbol, pcs: [fallbackRoot] };
}

function pcsToAscending(pcs, baseOct) {
  const out = [];
  let lastMidi = -Infinity;
  let oct = Number.isFinite(baseOct) ? baseOct : 4;
  for (const pc of pcs) {
    let n = `${pc}${oct}`;
    let m = Note.midi(n) ?? -Infinity;
    if (m <= lastMidi) {
      oct += 1;
      n = `${pc}${oct}`;
      m = Note.midi(n) ?? m;
    }
    out.push(n);
    lastMidi = m;
  }
  return out;
}

// --- Inversion & Voicing helpers ---
function sortByMidi(notes) {
  return [...notes].sort((a, b) => (Note.midi(a) ?? 0) - (Note.midi(b) ?? 0));
}
function raiseOct(note, delta = 1) {
  const info = Note.get(note);
  const pc = info?.pc || note.replace(/[0-9]/g, "");
  const baseOct =
    typeof info?.oct === "number"
      ? info.oct
      : Number.parseInt(note.replace(/^[^0-9]+/, ""), 10) || 4;
  return `${pc}${baseOct + delta}`;
}
function lowerOct(note, delta = 1) {
  return raiseOct(note, -delta);
}
function insertAscending(arr, note) {
  const m = Note.midi(note) ?? 0;
  const out = [];
  let inserted = false;
  for (const n of arr) {
    const mi = Note.midi(n) ?? 0;
    if (!inserted && m <= mi) {
      out.push(note);
      inserted = true;
    }
    out.push(n);
  }
  if (!inserted) out.push(note);
  return out;
}

// Raise the lowest note per inversion step and keep stack ascending
function applyInversion(notes, inversionLabel) {
  const order = ["root", "1st", "2nd", "3rd", "4th", "5th", "6th"];
  const steps = Math.max(0, order.indexOf(String(inversionLabel)));
  let res = sortByMidi(notes);
  for (let i = 0; i < steps; i++) {
    if (!res.length) break;
    const lowest = res.shift();
    const raised = raiseOct(lowest, 1);
    res = insertAscending(res, raised);
  }
  return sortByMidi(res);
}

// Apply voicing pattern after inversion
function applyVoicing(notes, pattern) {
  const n = notes.length;
  if (n <= 1 || !pattern || pattern === "close") return sortByMidi(notes);
  let out = [...notes];
  switch (pattern) {
    case "open": {
      const evens = out.filter((_, i) => i % 2 === 0);
      const oddsRaised = out
        .filter((_, i) => i % 2 === 1)
        .map((x) => raiseOct(x, 1));
      out = [...evens, ...oddsRaised];
      break;
    }
    case "drop2": {
      if (n >= 2) {
        const idx = n - 2; // second highest
        out[idx] = lowerOct(out[idx], 1);
      }
      break;
    }
    case "drop3": {
      if (n >= 3) {
        const idx = n - 3; // third highest
        out[idx] = lowerOct(out[idx], 1);
      }
      break;
    }
    case "spread": {
      const mid = Math.floor(n / 2);
      out = out.map((x, i) => (i >= mid ? raiseOct(x, 1) : x));
      break;
    }
    default:
      break;
  }
  return sortByMidi(out);
}

const previewChordData = computed(() => {
  const ext = currentExtension.value || "triad";
  const root = chordRootPc.value;
  const chordType =
    model.value.mode === "scale"
      ? determineScaleChordType(ext)
      : determineFreeChordType(ext);
  const chordInfo = getChordPitchClasses(root, chordType, ext);
  return {
    ...chordInfo,
    chordType,
    extension: ext,
  };
});

const previewNotesAsc = computed(() => {
  const pcs = previewChordData.value.pcs;
  const pitchClasses = pcs && pcs.length ? pcs : [chordRootPc.value];
  const base = pcsToAscending(pitchClasses, currentOctave.value);
  const afterInv = applyInversion(base, currentInversion.value || "root");
  const afterVoicing = applyVoicing(afterInv, currentVoicing.value || "close");
  return sortByMidi(afterVoicing);
});

const hasChordForPreview = computed(
  () => (previewNotesAsc.value?.length ?? 0) > 0
);
const previewChordHtml = computed(() =>
  formatChordSymbol(
    previewChordData.value.symbol,
    props.globalScaleRoot,
    props.globalScaleType
  )
);
const previewNotesHtml = computed(() => {
  const notes = previewNotesAsc.value || [];
  const formatted = notes.map((n) =>
    formatNoteName(n, props.globalScaleRoot, props.globalScaleType)
  );
  return formatted.join(" ");
});

function open() {
  // Reset dialog state to match the pad's saved state
  applyPadState(props.padState);
  dlg.value?.showModal?.();
}
function close() {
  dlg.value?.close?.();
}
function onClose() {
  emit("preview-stop");
  emit("close");
  close();
}

function resetToDefaults() {
  // Reset mode and both mode states to defaults
  model.value.mode = "scale";
  // Use first available degree from editChordOptions
  const firstDegree = editChordOptions.value.length > 0 ? editChordOptions.value[0].degree : "I";
  stateScale.degree = firstDegree;
  stateScale.octave = 4;
  const defaultScaleExt = extensionOptionsForType(
    determineScaleChordType("triad")
  )[0] ?? "triad";
  stateScale.extension = defaultScaleExt;
  stateScale.inversion = "root";
  stateScale.voicing = "close";

  stateFree.root = "C";
  stateFree.type = "major";
  stateFree.octave = 4;
  const defaultFreeExt = extensionOptionsForType(
    determineFreeChordType("triad")
  )[0] ?? "triad";
  stateFree.extension = defaultFreeExt;
  stateFree.inversion = "root";
  stateFree.voicing = "close";

  previousScaleExtension.value = "triad";
  previousFreeExtension.value = "triad";
}

// When the global scale changes, reset the edit selections to defaults
watch(
  () => [props.globalScaleRoot, props.globalScaleType],
  () => {
    resetToDefaults();
  },
  { immediate: false }
);

watch(
  () => stateScale.extension,
  (newExt, oldExt) => {
    if (isApplyingPadState.value) return;
    if (oldExt != null) previousScaleExtension.value = oldExt;
  },
  { flush: "sync" }
);

watch(
  () => stateFree.extension,
  (newExt, oldExt) => {
    if (isApplyingPadState.value) return;
    if (oldExt != null) previousFreeExtension.value = oldExt;
  },
  { flush: "sync" }
);

watch(
  () => scaleExtensionOptions.value,
  (opts) => {
    if (isApplyingPadState.value) return;
    if (!Array.isArray(opts) || opts.length === 0) return;
    if (!opts.includes(stateScale.extension)) {
      previousScaleExtension.value = stateScale.extension;
      stateScale.extension = opts[0];
    }
  }
);

watch(
  () => freeExtensionOptions.value,
  (opts) => {
    if (isApplyingPadState.value) return;
    if (!Array.isArray(opts) || opts.length === 0) return;
    if (!opts.includes(stateFree.extension)) {
      previousFreeExtension.value = stateFree.extension;
      stateFree.extension = opts[0];
    }
  }
);

// When extension changes, clamp inversion to valid range and reset voicing
watch(
  () => currentExtension.value,
  () => {
    if (isApplyingPadState.value) return;
    const valid = validInversions.value;
    const currentInv = currentInversion.value;

    // If current inversion is not valid for this extension, reset to root
    if (!valid.includes(currentInv)) {
      if (model.value.mode === "scale") {
        stateScale.inversion = "root";
      } else {
        stateFree.inversion = "root";
      }
    }

    // Always reset voicing when extension changes
    if (model.value.mode === "scale") {
      stateScale.voicing = "close";
    } else {
      stateFree.voicing = "close";
    }
  }
);

// When degree changes, reset scale-mode defaults
watch(
  () => stateScale.degree,
  () => {
    if (isApplyingPadState.value) return;
    const defaultType = determineScaleChordType("triad");
    const options = extensionOptionsForType(defaultType);
    const nextExtension = options[0] ?? "triad";
    if (stateScale.extension !== nextExtension) {
      previousScaleExtension.value = stateScale.extension;
      stateScale.extension = nextExtension;
    }
    stateScale.inversion = "root";
    stateScale.voicing = "close";
  }
);

// When free-mode root or type changes, reset defaults
watch(
  () => [stateFree.root, stateFree.type],
  () => {
    if (isApplyingPadState.value) return;
    const defaultType = determineFreeChordType("triad");
    const options = extensionOptionsForType(defaultType);
    const nextExtension = options[0] ?? "triad";
    if (stateFree.extension !== nextExtension) {
      previousFreeExtension.value = stateFree.extension;
      stateFree.extension = nextExtension;
    }
    stateFree.inversion = "root";
    stateFree.voicing = "close";
  }
);

watch(
  () => editChordOptions.value,
  (opts) => {
    if (!opts || opts.length === 0) return;
    const normalizedCurrent = normalizeDegree(stateScale.degree);
    if (opts.some((o) => o.degree === normalizedCurrent)) {
      stateScale.degree = normalizedCurrent;
      return;
    }
    stateScale.degree = opts[0].degree;
  },
  { immediate: true }
);

defineExpose({ open, close, dlg, resetToDefaults });

// --- Saving support ---
function buildPadSnapshot() {
  return {
    mode: model.value.mode,
    assigned: true,
    scale: {
      degree: stateScale.degree,
      octave: stateScale.octave,
      extension: stateScale.extension,
      inversion: stateScale.inversion,
      voicing: stateScale.voicing,
    },
    free: {
      root: stateFree.root,
      type: stateFree.type,
      octave: stateFree.octave,
      extension: stateFree.extension,
      inversion: stateFree.inversion,
      voicing: stateFree.voicing,
    },
  };
}

function applyPadState(s) {
  isApplyingPadState.value = true;
  // Unassigned pad: reset to defaults with scale mode
  if (
    !s ||
    typeof s !== "object" ||
    s.mode === "unassigned" ||
    s.assigned === false
  ) {
    resetToDefaults();
    nextTick(() => {
      isApplyingPadState.value = false;
    });
    return;
  }

  // Assigned pad: apply saved state
  if (s.mode === "scale" || s.mode === "free") model.value.mode = s.mode;
  if (s.scale && typeof s.scale === "object") {
    if (s.scale.degree != null)
      stateScale.degree = normalizeDegree(s.scale.degree);
    if (s.scale.octave != null) stateScale.octave = Number(s.scale.octave);
    if (s.scale.extension) stateScale.extension = String(s.scale.extension);
    if (s.scale.inversion) stateScale.inversion = String(s.scale.inversion);
    if (s.scale.voicing) stateScale.voicing = String(s.scale.voicing);
  }
  if (s.free && typeof s.free === "object") {
    if (s.free.root) stateFree.root = String(s.free.root);
    if (s.free.type) stateFree.type = String(s.free.type);
    if (s.free.octave != null) stateFree.octave = Number(s.free.octave);
    if (s.free.extension) stateFree.extension = String(s.free.extension);
    if (s.free.inversion) stateFree.inversion = String(s.free.inversion);
    if (s.free.voicing) stateFree.voicing = String(s.free.voicing);
  }

  previousScaleExtension.value = stateScale.extension;
  previousFreeExtension.value = stateFree.extension;

  nextTick(() => {
    isApplyingPadState.value = false;
  });
}

watch(
  () => props.padState,
  (s) => applyPadState(s),
  { immediate: true, deep: false }
);

// Internal dirtiness check: compare current selections with incoming padState
const isDirty = computed(() => {
  const s = props.padState || {};
  const current = {
    mode: model.value.mode,
    scale: {
      degree: normalizeDegree(stateScale.degree),
      octave: Number(stateScale.octave),
      extension: String(stateScale.extension),
      inversion: String(stateScale.inversion),
      voicing: String(stateScale.voicing),
    },
    free: {
      root: String(stateFree.root),
      type: String(stateFree.type),
      octave: Number(stateFree.octave),
      extension: String(stateFree.extension),
      inversion: String(stateFree.inversion),
      voicing: String(stateFree.voicing),
    },
  };
  const base = {
    mode: s.mode ?? "scale",
    scale: {
      degree: normalizeDegree(s?.scale?.degree ?? "1"),
      octave: Number(s?.scale?.octave ?? 4),
      extension: String(s?.scale?.extension ?? "triad"),
      inversion: String(s?.scale?.inversion ?? "root"),
      voicing: String(s?.scale?.voicing ?? "close"),
    },
    free: {
      root: String(s?.free?.root ?? "C"),
      type: String(s?.free?.type ?? "major"),
      octave: Number(s?.free?.octave ?? 4),
      extension: String(s?.free?.extension ?? "triad"),
      inversion: String(s?.free?.inversion ?? "root"),
      voicing: String(s?.free?.voicing ?? "close"),
    },
  };
  try {
    return JSON.stringify(current) !== JSON.stringify(base);
  } catch {
    return true;
  }
});
</script>
