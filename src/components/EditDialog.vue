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
            :size="16"
            :absoluteStrokeWidth="true"
          />
          <span class="sr-only">Close</span>
        </button>
      </div>
      <div class="dialog-toggles">
        <div class="toggle-buttons">
          <label class="toggle-button"
            ><input
              class="toggle-button-input sr-only"
              type="radio"
              name="mode-chooser"
              v-model="model.mode"
              value="scale"
            /><span class="toggle-button-text">In scale</span>
          </label>
          <label class="toggle-button"
            ><input
              class="toggle-button-input sr-only"
              type="radio"
              name="mode-chooser"
              v-model="model.mode"
              value="free"
            /><span class="toggle-button-text">Free</span>
          </label>
        </div>
      </div>
      <template v-if="model.mode === 'scale'">
        <div class="dialog-content">
          <p class="global-scale-info">
            <Music2
              aria-hidden="true"
              :size="12"
              :stroke-width="1.5"
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
          <label class="edit-grid-item flex-basis-40">
            <span class="label-text">Root</span>
            <CustomSelect
              v-model="stateFree.root"
              :options="rootOptions"
              option-value-key="value"
              option-label-key="label"
              wrapper-class="select-scale"
            />
          </label>
          <label class="edit-grid-item flex-basis-40">
            <span class="label-text">Type</span>
            <CustomSelect
              v-model="stateFree.type"
              :options="freeTypeOptions"
              option-value-key="value"
              option-label-key="label"
            />
          </label>
        </template>

        <!-- Chord type / extension -->
        <label class="edit-grid-item">
          <span class="label-text">Extension</span>
          <CustomSelect
            v-model="currentExtension"
            :options="extensionOptions"
          />
        </label>

        <!-- Combined root octave + inversion via slider -->

        <!-- Voicing pattern -->
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
        <label class="transpose-control">
          <span class="label-text">Transpose</span>

          <input
            class="input-range"
            type="range"
            :min="transposeSliderMin"
            :max="transposeSliderMax"
            step="1"
            :value="currentTranspose"
            :disabled="transposeSliderDisabled"
            @input="currentTranspose = Number($event.target.value)"
          />

        </label>
        <KeyboardExtended
          :highlighted-notes="previewNotesPlayable"
          :start-octave="1"
          :octaves="7"
        />
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
            :class="{ 'is-pressed': isPreviewPressed }"
            :disabled="!hasChordForPreview"
            @pointerdown.prevent.stop="onPreviewPressStart($event)"
            @pointerup.prevent.stop="onPreviewPressEnd($event)"
            @pointerleave.prevent.stop="onPreviewPressEnd($event)"
            @pointercancel.prevent.stop="onPreviewPressEnd($event)"
            @contextmenu.prevent
          >
            <Headphones
              aria-hidden="true"
              :stroke-width="1.5"
              :size="16"
              :absoluteStrokeWidth="true"
            />
          </button>
        </div>
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
import { X, Music2, Headphones } from "lucide-vue-next";
import CustomSelect from "./CustomSelect.vue";
import KeyboardExtended from "./KeyboardExtended.vue";
import { Scale, Note } from "@tonaljs/tonal";
import {
  formatNoteName,
  formatChordSymbol,
  simplifyNoteName,
} from "../utils/enharmonic";
import {
  DEFAULT_EXTENSION,
  allowedExtensionsForChordType,
  normalizeChordType,
  normalizeExtension,
  chordIsNonTertian,
  buildChordDefinition,
  chordNoteCount,
} from "../utils/chordSystem";

// Keep padIndex so the title continues to work; expose open/close for parent
const iconStrokeWidth = Number(globalThis?.APP_ICON_STROKE_WIDTH ?? 1.5);
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
const isPreviewPressed = ref(false);

// Mode flag only; all other selections are kept separate per mode
const model = ref({ mode: "scale" });

const ROOT_OCTAVE_OPTIONS = [2, 3, 4, 5];
const DEFAULT_ROOT_OCTAVE = 4;

// Independent state per mode
const stateScale = reactive({
  degree: "1", // default to tonic degree
  octave: DEFAULT_ROOT_OCTAVE,
  extension: DEFAULT_EXTENSION,
  inversion: "root",
  voicing: "close",
});

const stateFree = reactive({
  root: "C",
  type: "major", // or "minor"
  octave: DEFAULT_ROOT_OCTAVE,
  extension: DEFAULT_EXTENSION,
  inversion: "root",
  voicing: "close",
});

const previousScaleExtension = ref(DEFAULT_EXTENSION);
const previousFreeExtension = ref(DEFAULT_EXTENSION);

function clampOctaveValue(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return DEFAULT_ROOT_OCTAVE;
  if (ROOT_OCTAVE_OPTIONS.includes(num)) return num;
  let closest = DEFAULT_ROOT_OCTAVE;
  let minDiff = Infinity;
  for (const opt of ROOT_OCTAVE_OPTIONS) {
    const diff = Math.abs(opt - num);
    if (diff < minDiff) {
      closest = opt;
      minDiff = diff;
    }
  }
  return closest;
}

// Mode-bridged computed bindings for shared controls
const currentExtension = computed({
  get: () =>
    model.value.mode === "scale" ? stateScale.extension : stateFree.extension,
  set: (v) => {
    const normalized = normalizeExtensionValue(v);
    if (model.value.mode === "scale") stateScale.extension = normalized;
    else stateFree.extension = normalized;
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
    // Format root according to global scale to match preview enharmonics
    const rootDisplay = formatNoteName(
      n,
      props.globalScaleRoot,
      props.globalScaleType
    );
    // Add 7 to dominant (degree V) display (only if not already diminished/augmented)
    let display = `${rootDisplay}${suffix}`;
    if (i === 4 && suffix === "") {
      display = `${rootDisplay}7`;
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
  { value: "minor", label: "Minor" },
  { value: "diminished", label: "Diminished" },
  { value: "halfDiminished", label: "Half diminished" },
  { value: "augmented", label: "Augmented" },
  { value: "sus2", label: "Sus2" },
  { value: "sus4", label: "Sus4" },
  { value: "power", label: "Power (5)" },
]);
const freeTypeOptions = FREE_TYPE_OPTIONS;
const FREE_TYPE_VALUE_SET = new Set(freeTypeOptions.map((opt) => opt.value));
function extensionOptionsForType(type) {
  return allowedExtensionsForChordType(type);
}

function normalizeFreeTypeValue(value) {
  const normalized = normalizeChordType(value);
  return FREE_TYPE_VALUE_SET.has(normalized) ? normalized : "major";
}

function normalizeExtensionValue(value) {
  return normalizeExtension(value);
}

function allowedExtensionsForFreeType(baseType) {
  return allowedExtensionsForChordType(normalizeFreeTypeValue(baseType));
}

const scaleChordType = computed(() => determineScaleChordType());
const freeChordType = computed(() => normalizeFreeTypeValue(stateFree.type));
const scaleExtensionOptions = computed(() =>
  extensionOptionsForType(scaleChordType.value)
);
const freeExtensionOptions = computed(() =>
  allowedExtensionsForFreeType(stateFree.type)
);
const extensionOptions = computed(() =>
  model.value.mode === "scale"
    ? scaleExtensionOptions.value
    : freeExtensionOptions.value
);

function computeValidInversions(ext, chordType, rootPc) {
  const normalizedExt = normalizeExtensionValue(ext);
  const noteCount = extensionNoteCount(normalizedExt, chordType, rootPc);
  const maxIndex = Math.max(0, noteCount - 1);
  return editInversions.filter((_, idx) => idx <= maxIndex);
}

// Valid inversion sets per mode
const validInversionsScale = computed(() =>
  computeValidInversions(
    stateScale.extension,
    scaleChordType.value,
    scaleChordRootPc.value
  )
);
const validInversionsFree = computed(() =>
  computeValidInversions(
    stateFree.extension,
    freeChordType.value,
    freeChordRootPc.value
  )
);
const currentValidInversions = computed(() =>
  model.value.mode === "scale"
    ? validInversionsScale.value
    : validInversionsFree.value
);

// All possible inversions for combination building
const editInversions = ["root", "1st", "2nd", "3rd", "4th", "5th", "6th"];
const voicingTypeOptions = ["close", "open", "drop2", "drop3", "spread"];
const isNonTertianChord = computed(() => {
  const baseType =
    model.value.mode === "scale" ? scaleChordType.value : freeChordType.value;
  return chordIsNonTertian(baseType);
});

function buildTransposeMeta(mode) {
  const inversions =
    mode === "scale" ? validInversionsScale.value : validInversionsFree.value;
  const combos = [];
  for (const oct of ROOT_OCTAVE_OPTIONS) {
    for (const inv of inversions) {
      combos.push({ octave: oct, inversion: inv });
    }
  }
  if (!combos.length) {
    combos.push({ octave: DEFAULT_ROOT_OCTAVE, inversion: "root" });
  }
  let defaultIndex = combos.findIndex(
    (c) => c.octave === DEFAULT_ROOT_OCTAVE && c.inversion === "root"
  );
  if (defaultIndex === -1) defaultIndex = 0;
  return { combos, defaultIndex };
}

const transposeMetaScale = computed(() => buildTransposeMeta("scale"));
const transposeMetaFree = computed(() => buildTransposeMeta("free"));
const currentTransposeMeta = computed(() =>
  model.value.mode === "scale"
    ? transposeMetaScale.value
    : transposeMetaFree.value
);

const transposeSliderMin = computed(
  () => -currentTransposeMeta.value.defaultIndex
);
const transposeSliderMax = computed(
  () =>
    currentTransposeMeta.value.combos.length -
    1 -
    currentTransposeMeta.value.defaultIndex
);
const transposeSliderDisabled = computed(
  () => transposeSliderMin.value === transposeSliderMax.value
);

const currentTranspose = computed({
  get() {
    const { combos, defaultIndex } = currentTransposeMeta.value;
    if (!combos.length) return 0;
    const state = model.value.mode === "scale" ? stateScale : stateFree;
    const idx = combos.findIndex(
      (c) => c.octave === state.octave && c.inversion === state.inversion
    );
    const activeIndex = idx === -1 ? defaultIndex : idx;
    return activeIndex - defaultIndex;
  },
  set(raw) {
    const { combos, defaultIndex } = currentTransposeMeta.value;
    if (!combos.length) return;
    const state = model.value.mode === "scale" ? stateScale : stateFree;
    const value = Number.isFinite(raw) ? Math.trunc(raw) : 0;
    const clampedOffset = Math.max(
      transposeSliderMin.value,
      Math.min(transposeSliderMax.value, value)
    );
    const targetIndex = Math.max(
      0,
      Math.min(combos.length - 1, defaultIndex + clampedOffset)
    );
    const combo = combos[targetIndex];
    state.octave = combo.octave;
    state.inversion = combo.inversion;
  },
});

function applyLegacyTransposeToState(mode, steps) {
  const offset = Number.isFinite(steps) ? Math.trunc(steps) : 0;
  if (!offset) return;
  const meta =
    mode === "scale" ? transposeMetaScale.value : transposeMetaFree.value;
  const combos = meta.combos;
  if (!combos.length) return;
  const state = mode === "scale" ? stateScale : stateFree;
  const idx = combos.findIndex(
    (c) => c.octave === state.octave && c.inversion === state.inversion
  );
  const startIndex = idx === -1 ? meta.defaultIndex : idx;
  let targetIndex = startIndex + offset;
  targetIndex = Math.max(0, Math.min(combos.length - 1, targetIndex));
  const combo = combos[targetIndex];
  state.octave = combo.octave;
  state.inversion = combo.inversion;
}

// Skip watcher side-effects while we restore a saved pad state
const isApplyingPadState = ref(false);

// Derive base triad quality for the selected scale degree ("", "m", "dim", "aug")
const baseQualityFromScale = computed(() => {
  const s = scaleNotes.value;
  if (!Array.isArray(s) || s.length < 3) return "";
  const deg = degreeNumber(stateScale.degree);
  const i = (deg - 1) % s.length;
  // Stack diatonic thirds within the scale
  const triad = [s[i], s[(i + 2) % s.length], s[(i + 4) % s.length]];
  return qualityFromTriad(triad, s[i]);
});

// Compute chord roots for each mode
const scaleChordRootPc = computed(() => {
  const deg = degreeNumber(stateScale.degree);
  const idx = Math.max(0, deg - 1);
  return scaleNotes.value[idx] || "C";
});
const freeChordRootPc = computed(() => stateFree.root || "C");
const chordRootPc = computed(() =>
  model.value.mode === "scale" ? scaleChordRootPc.value : freeChordRootPc.value
);

function determineScaleChordType() {
  const quality = baseQualityFromScale.value;
  switch (quality) {
    case "m":
      return "minor";
    case "dim":
      return "diminished";
    case "aug":
      return "augmented";
    default:
      return "major";
  }
}

function extensionNoteCount(ext, chordType, rootPc) {
  const info = getChordPitchClasses(rootPc || "C", chordType, ext);
  return Array.isArray(info.pcs) ? info.pcs.length : 0;
}

function buildChordRepresentation(rootPc, chordType, ext) {
  const baseType = normalizeFreeTypeValue(chordType);
  const value = normalizeExtensionValue(ext);
  const create = (display, tonal = display) => ({ display, tonal });

  switch (baseType) {
    case "major":
      switch (value) {
        case "none":
          return create(`${rootPc}`);
        case "6":
          return create(`${rootPc}6`);
        case "maj7":
          return create(`${rootPc}maj7`);
        case "maj9":
          return create(`${rootPc}maj9`);
        case "add9":
          return create(`${rootPc}add9`);
        case "7":
          return create(`${rootPc}7`);
        case "9":
          return create(`${rootPc}9`);
        case "13":
          return create(`${rootPc}13`);
        default:
          return create(`${rootPc}`);
      }
    case "minor":
      switch (value) {
        case "none":
          return create(`${rootPc}m`);
        case "6":
          return create(`${rootPc}m6`);
        case "7":
          return create(`${rootPc}m7`);
        case "9":
          return create(`${rootPc}m9`);
        case "11":
          return create(`${rootPc}m11`);
        case "13":
          return create(`${rootPc}m13`);
        case "add9":
          return create(`${rootPc}madd9`);
        default:
          return create(`${rootPc}m`);
      }
    case "diminished":
      switch (value) {
        case "none":
          return create(`${rootPc}dim`);
        case "7":
          return create(`${rootPc}dim7`);
        default:
          return create(`${rootPc}dim`);
      }
    case "halfDiminished":
      return create(`${rootPc}m7b5`);
    case "augmented":
      switch (value) {
        case "none":
          return create(`${rootPc}aug`);
        case "maj7":
          return create(`${rootPc}maj7#5`);
        case "9":
          return create(`${rootPc}9#5`);
        default:
          return create(`${rootPc}aug`);
      }
    case "sus2":
      if (value === "add9") return create(`${rootPc}sus2add9`, `${rootPc}sus2`);
      return create(`${rootPc}sus2`);
    case "sus4":
      if (value === "add9") return create(`${rootPc}sus4add9`, `${rootPc}sus4`);
      return create(`${rootPc}sus4`);
    case "power":
      return create(`${rootPc}5`);
    default:
      return create(`${rootPc}`);
  }
}

function getChordPitchClasses(rootPc, chordType, ext) {
  const definition = buildChordDefinition(rootPc, chordType, ext);
  return {
    symbol: definition.displaySymbol,
    tonalSymbol: definition.tonalSymbol,
    pcs: definition.notes,
  };
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
  const ext = normalizeExtensionValue(currentExtension.value);
  const root = chordRootPc.value;
  const chordType =
    model.value.mode === "scale" ? scaleChordType.value : freeChordType.value;
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
  const baseOctave =
    model.value.mode === "scale" ? stateScale.octave : stateFree.octave;
  const base = pcsToAscending(pitchClasses, baseOctave);
  const afterInv = applyInversion(
    base,
    (model.value.mode === "scale"
      ? stateScale.inversion
      : stateFree.inversion) || "root"
  );
  const afterVoicing = applyVoicing(afterInv, currentVoicing.value || "close");
  return sortByMidi(afterVoicing);
});

const previewNotesPlayable = computed(() =>
  (previewNotesAsc.value || []).map((n) => simplifyNoteName(n))
);

const hasChordForPreview = computed(
  () => (previewNotesPlayable.value?.length ?? 0) > 0
);
const previewChordHtml = computed(() =>
  formatChordSymbol(
    previewChordData.value.symbol,
    props.globalScaleRoot,
    props.globalScaleType
  )
);
const previewNotesHtml = computed(() => {
  const notes = previewNotesPlayable.value || [];
  const formatted = notes.map((n) =>
    formatNoteName(n, props.globalScaleRoot, props.globalScaleType)
  );
  return formatted.join(" ");
});

function onPreviewPressStart(event) {
  if (!hasChordForPreview.value || isPreviewPressed.value) return;
  isPreviewPressed.value = true;
  emit("preview-start", {
    event,
    notes: previewNotesPlayable.value,
  });
}

function onPreviewPressEnd(event) {
  if (isPreviewPressed.value) {
    isPreviewPressed.value = false;
  }
  emit("preview-stop", { event });
}

function open() {
  // Reset dialog state to match the pad's saved state
  applyPadState(props.padState);
  dlg.value?.showModal?.();
}
function close() {
  dlg.value?.close?.();
}
function onClose() {
  isPreviewPressed.value = false;
  emit("preview-stop");
  emit("close");
  close();
}

function resetToDefaults() {
  // Reset mode and both mode states to defaults
  model.value.mode = "scale";
  // Use first available degree from editChordOptions
  const firstDegree =
    editChordOptions.value.length > 0 ? editChordOptions.value[0].degree : "I";
  stateScale.degree = firstDegree;
  stateScale.octave = DEFAULT_ROOT_OCTAVE;
  const defaultScaleExt = normalizeExtensionValue(
    extensionOptionsForType(determineScaleChordType())[0] ?? DEFAULT_EXTENSION
  );
  stateScale.extension = defaultScaleExt;
  stateScale.inversion = "root";
  stateScale.voicing = "close";

  stateFree.root = "C";
  stateFree.type = "major";
  stateFree.octave = DEFAULT_ROOT_OCTAVE;
  const defaultFreeExt = normalizeExtensionValue(
    allowedExtensionsForFreeType(stateFree.type)[0] ?? DEFAULT_EXTENSION
  );
  stateFree.extension = defaultFreeExt;
  stateFree.inversion = "root";
  stateFree.voicing = "close";

  previousScaleExtension.value = DEFAULT_EXTENSION;
  previousFreeExtension.value = DEFAULT_EXTENSION;
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
    const normalizedCurrent = normalizeExtensionValue(stateScale.extension);
    if (!opts.includes(normalizedCurrent)) {
      previousScaleExtension.value = stateScale.extension;
      stateScale.extension = normalizeExtensionValue(
        opts[0] ?? DEFAULT_EXTENSION
      );
    }
  }
);

watch(
  () => freeExtensionOptions.value,
  (opts) => {
    if (isApplyingPadState.value) return;
    if (!Array.isArray(opts) || opts.length === 0) return;
    const normalizedCurrent = normalizeExtensionValue(stateFree.extension);
    const preferred = opts.includes(DEFAULT_EXTENSION)
      ? DEFAULT_EXTENSION
      : opts[0];
    if (
      !opts.includes(normalizedCurrent) ||
      (preferred &&
        normalizedCurrent !== preferred &&
        preferred === DEFAULT_EXTENSION)
    ) {
      previousFreeExtension.value = stateFree.extension;
      stateFree.extension = normalizeExtensionValue(
        preferred ?? DEFAULT_EXTENSION
      );
    }
  }
);

// When extension changes, clamp inversion to valid range and reset voicing
watch(
  () => currentExtension.value,
  () => {
    if (isApplyingPadState.value) return;
    const valid = currentValidInversions.value;
    const state = model.value.mode === "scale" ? stateScale : stateFree;
    const currentInv = state.inversion;

    // If current inversion is not valid for this extension, reset to root
    if (!valid.includes(currentInv)) {
      state.inversion = "root";
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
    const defaultType = determineScaleChordType();
    const options = extensionOptionsForType(defaultType);
    const nextExtension = options[0] ?? DEFAULT_EXTENSION;
    if (normalizeExtensionValue(stateScale.extension) !== nextExtension) {
      previousScaleExtension.value = stateScale.extension;
      stateScale.extension = normalizeExtensionValue(nextExtension);
    }
    stateScale.inversion = "root";
    stateScale.voicing = "close";
    stateScale.octave = DEFAULT_ROOT_OCTAVE;
  }
);

// When free-mode root or type changes, reset defaults
watch(
  () => [stateFree.root, stateFree.type],
  () => {
    if (isApplyingPadState.value) return;
    const normalizedType = normalizeFreeTypeValue(stateFree.type);
    if (normalizedType !== stateFree.type) {
      stateFree.type = normalizedType;
    }
    const options = allowedExtensionsForFreeType(normalizedType);
    const normalizedCurrent = normalizeExtensionValue(stateFree.extension);
    const nextExtension = options.includes(DEFAULT_EXTENSION)
      ? DEFAULT_EXTENSION
      : options[0] ?? DEFAULT_EXTENSION;
    const shouldReset =
      !options.includes(normalizedCurrent) ||
      (nextExtension === DEFAULT_EXTENSION &&
        normalizedCurrent !== DEFAULT_EXTENSION);
    if (shouldReset) {
      previousFreeExtension.value = stateFree.extension;
      stateFree.extension = normalizeExtensionValue(nextExtension);
    }
    stateFree.inversion = "root";
    stateFree.voicing = "close";
    stateFree.octave = DEFAULT_ROOT_OCTAVE;
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
      extension: normalizeExtensionValue(stateScale.extension),
      inversion: stateScale.inversion,
      voicing: stateScale.voicing,
    },
    free: {
      root: stateFree.root,
      type: stateFree.type,
      octave: stateFree.octave,
      extension: normalizeExtensionValue(stateFree.extension),
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
    if (s.scale.octave != null)
      stateScale.octave = clampOctaveValue(s.scale.octave);
    if (s.scale.extension != null)
      stateScale.extension = normalizeExtensionValue(s.scale.extension);
    if (s.scale.inversion) stateScale.inversion = String(s.scale.inversion);
    if (s.scale.voicing) stateScale.voicing = String(s.scale.voicing);
    applyLegacyTransposeToState("scale", s.scale.transpose);
  }
  if (s.free && typeof s.free === "object") {
    if (s.free.root) stateFree.root = String(s.free.root);
    if (s.free.type) stateFree.type = String(s.free.type);
    if (s.free.octave != null)
      stateFree.octave = clampOctaveValue(s.free.octave);
    if (s.free.extension != null)
      stateFree.extension = normalizeExtensionValue(s.free.extension);
    if (s.free.inversion) stateFree.inversion = String(s.free.inversion);
    if (s.free.voicing) stateFree.voicing = String(s.free.voicing);
    applyLegacyTransposeToState("free", s.free.transpose);
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
      extension: normalizeExtensionValue(stateScale.extension),
      inversion: String(stateScale.inversion),
      voicing: String(stateScale.voicing),
    },
    free: {
      root: String(stateFree.root),
      type: String(stateFree.type),
      octave: Number(stateFree.octave),
      extension: normalizeExtensionValue(stateFree.extension),
      inversion: String(stateFree.inversion),
      voicing: String(stateFree.voicing),
    },
  };
  const base = {
    mode: s.mode ?? "scale",
    scale: {
      degree: normalizeDegree(s?.scale?.degree ?? "1"),
      octave: Number(s?.scale?.octave ?? 4),
      extension: normalizeExtensionValue(s?.scale?.extension),
      inversion: String(s?.scale?.inversion ?? "root"),
      voicing: String(s?.scale?.voicing ?? "close"),
    },
    free: {
      root: String(s?.free?.root ?? "C"),
      type: String(s?.free?.type ?? "major"),
      octave: Number(s?.free?.octave ?? 4),
      extension: normalizeExtensionValue(s?.free?.extension),
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
