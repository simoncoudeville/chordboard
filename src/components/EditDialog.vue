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
            Global scale: <span>{{ globalScale }}</span>
            {{ globalScaleType }}
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
                  {{ ch.display || ch.degree }}
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
              :options="['major', 'minor']"
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

// Keep padIndex so the title continues to work; expose open/close for parent
const props = defineProps({
  padIndex: { type: Number, default: 0 },
  // Receive current global scale from parent (App.vue)
  globalScale: { type: String, default: "" },
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
  degree: "1",
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
  const root = props.globalScale || "C";
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
const editChordOptions = computed(() =>
  scaleNotes.value.map((n, i) => {
    const q = qualityForDegree(i);
    const suffix = q === "" ? "" : q === "m" ? "m" : q; // "m", "dim", "aug"
    return {
      degree: String(i + 1),
      display: `${n}${suffix}`,
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
const extensionOptions = ["triad", "7", "maj7", "9", "add9", "sus2", "sus4"];

// Valid inversions based on current extension
const validInversions = computed(() => {
  const ext = currentExtension.value;
  // Triad = 3 notes → root, 1st, 2nd
  if (ext === "triad" || ext === "sus2" || ext === "sus4") {
    return ["root", "1st", "2nd"];
  }
  // 7th chord = 4 notes → root, 1st, 2nd, 3rd
  if (ext === "7" || ext === "maj7") {
    return ["root", "1st", "2nd", "3rd"];
  }
  // 9th chord = 5 notes → root, 1st, 2nd, 3rd, 4th
  if (ext === "9" || ext === "add9") {
    return ["root", "1st", "2nd", "3rd", "4th"];
  }
  return ["root", "1st", "2nd"];
});

// All possible inversions for the dropdown
const editInversions = ["root", "1st", "2nd", "3rd", "4th"];
const voicingTypeOptions = ["close", "open", "drop2", "drop3", "spread"];
const isNonTertianChord = computed(() => {
  const ext = currentExtension.value;
  return ext === "sus2" || ext === "sus4";
});

// Skip watcher side-effects while we restore a saved pad state
const isApplyingPadState = ref(false);

// Derive base triad quality for the selected scale degree ("", "m", "dim", "aug")
const baseQualityFromScale = computed(() => {
  if (model.value.mode !== "scale") return "";
  const s = scaleNotes.value;
  if (!Array.isArray(s) || s.length < 3) return "";
  const deg = Math.max(1, parseInt(stateScale.degree, 10) || 1);
  const i = (deg - 1) % s.length;
  // Stack diatonic thirds within the scale
  const triad = [s[i], s[(i + 2) % s.length], s[(i + 4) % s.length]];
  return qualityFromTriad(triad, s[i]);
});

// Compute chord root from degree (scale mode) or free root
const chordRootPc = computed(() => {
  if (model.value.mode === "scale") {
    const idx = Math.max(0, (parseInt(stateScale.degree, 10) || 1) - 1);
    return scaleNotes.value[idx] || "C";
  }
  return stateFree.root || "C";
});

function buildChordSymbol(rootPc, isMinor, ext) {
  const suffixMap = {
    triad: "",
    7: "7",
    maj7: "maj7",
    9: "9",
    add9: "add9",
    sus2: "sus2",
    sus4: "sus4",
  };
  const suffix = suffixMap[ext] ?? "";
  if (!isMinor) return `${rootPc}${suffix}`;
  if (ext === "7") return `${rootPc}m7`;
  if (ext === "9") return `${rootPc}m9`;
  if (ext === "maj7") return `${rootPc}mMaj7`;
  if (ext === "add9") return `${rootPc}madd9`;
  if (ext === "sus2" || ext === "sus4") return `${rootPc}${suffix}`;
  return `${rootPc}m${suffix}`;
}

// Build symbol from explicit quality for scale mode
function buildChordSymbolFromQuality(rootPc, quality, ext) {
  // Suspensions ignore 3rd quality
  if (ext === "sus2" || ext === "sus4") return `${rootPc}${ext}`;
  if (ext === "triad") {
    if (quality === "m") return `${rootPc}m`;
    if (quality === "dim") return `${rootPc}dim`;
    if (quality === "aug") return `${rootPc}aug`;
    return `${rootPc}`;
  }
  if (ext === "7") {
    if (quality === "m") return `${rootPc}m7`;
    if (quality === "dim") return `${rootPc}m7b5`;
    if (quality === "aug") return `${rootPc}7#5`;
    return `${rootPc}7`;
  }
  if (ext === "maj7") {
    if (quality === "m") return `${rootPc}mMaj7`;
    if (quality === "aug") return `${rootPc}maj7#5`;
    return `${rootPc}maj7`;
  }
  if (ext === "9") {
    if (quality === "m") return `${rootPc}m9`;
    return `${rootPc}9`;
  }
  if (ext === "add9") {
    if (quality === "m") return `${rootPc}madd9`;
    if (quality === "dim") return `${rootPc}dim`;
    if (quality === "aug") return `${rootPc}aug`;
    return `${rootPc}add9`;
  }
  return `${rootPc}`;
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
  const order = ["root", "1st", "2nd", "3rd", "4th"];
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

const previewChordSymbol = computed(() => {
  const root = chordRootPc.value;
  const ext = currentExtension.value || "triad";
  if (model.value.mode === "scale") {
    const q = baseQualityFromScale.value; // "", "m", "dim", "aug"
    return buildChordSymbolFromQuality(root, q, ext);
  }
  const isMinor = stateFree.type === "minor";
  return buildChordSymbol(root, isMinor, ext);
});

const previewNotesAsc = computed(() => {
  const pcs = Chord.get(previewChordSymbol.value).notes;
  if (!pcs || pcs.length === 0)
    return [`${chordRootPc.value}${currentOctave.value}`];
  // Base ascending stack from selected octave
  const base = pcsToAscending(pcs, currentOctave.value);
  // Apply inversion (rotate lowest up) then voicing
  const afterInv = applyInversion(base, currentInversion.value || "root");
  const afterVoicing = applyVoicing(afterInv, currentVoicing.value || "close");
  // Always return ascending notes by pitch
  return sortByMidi(afterVoicing);
});

const hasChordForPreview = computed(
  () => (previewNotesAsc.value?.length ?? 0) > 0
);
const previewChordHtml = computed(() => previewChordSymbol.value);
const previewNotesHtml = computed(() =>
  (previewNotesAsc.value || []).join(" ")
);

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
  stateScale.degree = "1";
  stateScale.octave = 4;
  stateScale.extension = "triad";
  stateScale.inversion = "root";
  stateScale.voicing = "close";

  stateFree.root = "C";
  stateFree.type = "major";
  stateFree.octave = 4;
  stateFree.extension = "triad";
  stateFree.inversion = "root";
  stateFree.voicing = "close";
}

// When the global scale changes, reset the edit selections to defaults
watch(
  () => [props.globalScale, props.globalScaleType],
  () => {
    resetToDefaults();
  },
  { immediate: false }
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

// When chord/root/type changes, reset extension, inversion, and voicing to defaults
watch(
  () => [stateScale.degree, stateFree.root, stateFree.type],
  () => {
    if (isApplyingPadState.value) return;
    if (model.value.mode === "scale") {
      stateScale.extension = "triad";
      stateScale.inversion = "root";
      stateScale.voicing = "close";
    } else {
      stateFree.extension = "triad";
      stateFree.inversion = "root";
      stateFree.voicing = "close";
    }
  }
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
    if (s.scale.degree != null) stateScale.degree = String(s.scale.degree);
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
      degree: String(stateScale.degree),
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
      degree: String(s?.scale?.degree ?? "1"),
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
