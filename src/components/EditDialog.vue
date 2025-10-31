<template>
  <dialog ref="dlg" @click.self="onClose" @cancel.prevent="onClose">
    <form class="dialog-body" method="dialog" @submit.prevent>
      <div class="dialog-top">
        <h2 class="dialog-title">Edit Pad {{ padIndex + 1 }}</h2>
        <button
          type="button"
          class="dialog-close"
          @click="onClose"
          aria-label="Close"
        >
          <X
            class="dialog-close-icon"
            aria-hidden="true"
            :size="14"
            stroke-width="2"
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
          <p class="global-scale-info color-scale">
            <Music2 aria-hidden="true" :size="14" stroke-width="2" />

            Global scale: <span>{{ globalScale }}</span>
            {{ globalScaleType }}
          </p>
        </div>
      </template>
      <div class="dialog-content edit-grid">
        <!-- Primary chord selector: degree (scale mode) or root/type (free mode) -->
        <template v-if="model.mode === 'scale'">
          <label class="flex-grow-1">
            <span class="label-text">Chord</span>
            <CustomSelect v-model="model.degree" wrapper-class="select-chord">
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
          <label>
            <span class="label-text">Root</span>
            <CustomSelect
              v-model="model.freeRoot"
              :options="MAJOR_KEY_OPTIONS"
              option-value-key="value"
              option-label-key="label"
              wrapper-class="select-scale"
            />
          </label>
          <label>
            <span class="label-text">Type</span>
            <CustomSelect
              v-model="scaleTypeProxy"
              :options="['major', 'minor']"
            />
          </label>
        </template>

        <!-- Root octave always active -->
        <label class="flex-grow-1">
          <span class="label-text">Root octave</span>
          <CustomSelect
            v-model="octaveProxy"
            :options="[2, 3, 4, 5, 6]"
            :cast-number="true"
          />
        </label>

        <!-- Chord type / extension -->
        <label class="flex-grow-1">
          <span class="label-text">Extension</span>
          <CustomSelect v-model="voicingProxy" :options="extensionOptions" />
        </label>

        <!-- Inversion then Voicing pattern -->
        <label class="flex-grow-1">
          <span class="label-text">Inversion</span>
          <CustomSelect
            v-model="inversionProxy"
            :options="editInversions"
            :disabled="!voicingProxy || isNonTertianChord"
          />
        </label>
        <label class="flex-grow-1">
          <span class="label-text">Voicing</span>
          <CustomSelect
            v-model="selectedVoicingType"
            :options="voicingTypeOptions"
            :disabled="isNonTertianChord || !voicingProxy"
          />
        </label>
      </div>
      <div class="dialog-content chord-preview">
        <KeyboardExtended
          :highlighted-notes="previewNotesAsc"
          :start-octave="2"
          :octaves="7"
        />

        <div class="chord-preview-symbol">
          Chord: <span>{{ previewChordHtml }}</span>
        </div>
        <div class="chord-preview-notes">
          Notes: <span>{{ previewNotesHtml }}</span>
        </div>
        <button
          type="button"
          class="button large preview"
          :disabled="!permissionAllowed || !midiEnabled || !hasChordForPreview"
          @pointerdown.prevent.stop="
            $emit('preview-start', {
              event: $event,
              voicingType: selectedVoicingType,
            })
          "
          @pointerup.prevent.stop="
            $emit('preview-stop', {
              event: $event,
              voicingType: selectedVoicingType,
            })
          "
          @pointerleave.prevent.stop="
            $emit('preview-stop', {
              event: $event,
              voicingType: selectedVoicingType,
            })
          "
          @pointercancel.prevent.stop="
            $emit('preview-stop', {
              event: $event,
              voicingType: selectedVoicingType,
            })
          "
          @contextmenu.prevent
        >
          Preview
        </button>
      </div>
      <div class="dialog-buttons">
        <button type="button" @click="onClose">Cancel</button>
        <button type="button" @click="$emit('save')" :disabled="!isEditDirty">
          Save
        </button>
      </div>
    </form>
  </dialog>
</template>

<script setup>
const voicingTypeOptions = ["close", "open", "drop2", "drop3", "spread"];
const selectedVoicingType = ref("close");

const nonTertianTypes = ["add2", "add9", "sus2", "sus4"];
const isNonTertianChord = computed(() =>
  nonTertianTypes.includes(voicingProxy.value)
);

import { ref, computed, toRef, watch } from "vue";
import { X, Music2 } from "lucide-vue-next";
import CustomSelect from "./CustomSelect.vue";
import KeyboardExtended from "./KeyboardExtended.vue";

const props = defineProps({
  padIndex: { type: Number, default: 0 },
  modelValue: { type: Object, default: () => ({}) },
  editScaleTypeModel: { type: String, default: "" },
  editVoicingModel: { type: String, default: "" },
  editInversionModel: { type: String, default: "" },
  editOctaveModel: { type: Number, default: 0 },
  editChordOptions: { type: Array, default: () => [] },
  editInversions: { type: Array, default: () => [] },
  MAJOR_KEY_OPTIONS: { type: Array, default: () => [] },
  globalScale: { type: String, default: "" },
  globalScaleType: { type: String, default: "" },
  permissionAllowed: { type: Boolean, default: false },
  midiEnabled: { type: Boolean, default: false },
  isEditDirty: { type: Boolean, default: false },
});

const emit = defineEmits([
  "update:modelValue",
  "update:editScaleTypeModel",
  "update:editVoicingModel",
  "update:editInversionModel",
  "update:editOctaveModel",
  "save",
  "close",
  "preview-start",
  "preview-stop",
]);

const SUPPORTED_VOICINGS = [
  "triad",
  "add2",
  "add9",
  "7",
  "9",
  "11",
  "13",
  "sus2",
  "sus4",
];

const VOICINGS_BY_KIND = {
  major: ["triad", "add2", "add9", "6", "7", "9", "11", "13", "sus2", "sus4"],
  minor: ["triad", "add2", "add9", "6", "7", "9", "11", "13", "sus2", "sus4"],
  dominant: ["triad", "7", "9", "11", "13", "sus2", "sus4"],
  diminished: ["triad", "7"],
  "half-diminished": ["triad", "7"],
  augmented: ["triad", "add9", "7"],
};

function allowedVoicingsForMetadata(meta) {
  const kind = meta?.kind || "major";
  const raw = VOICINGS_BY_KIND[kind] || VOICINGS_BY_KIND.major;
  return raw.filter((v) => SUPPORTED_VOICINGS.includes(v));
}

const dlg = ref(null);

const model = toRef(props, "modelValue");
const scaleTypeProxy = computed({
  get: () => props.editScaleTypeModel,
  set: (v) => emit("update:editScaleTypeModel", v),
});
const voicingProxy = computed({
  get: () => props.editVoicingModel,
  set: (v) => emit("update:editVoicingModel", v),
});
const inversionProxy = computed({
  get: () => props.editInversionModel,
  set: (v) => emit("update:editInversionModel", v),
});
const octaveProxy = computed({
  get: () => props.editOctaveModel,
  set: (v) => emit("update:editOctaveModel", v),
});

function open() {
  dlg.value?.showModal();
}
function close() {
  dlg.value?.close();
}

function onClose() {
  emit("preview-stop");
  emit("close");
}

defineExpose({ open, close, dlg });

const padLikeForPreview = computed(() => {
  const pad = model.value || {};
  const mode = pad.mode || "scale";
  const normalized = {
    ...pad,
    mode,
    assigned: true,
    scale: props.globalScale,
    scaleTypeScale: props.globalScaleType,
    scaleTypeFree: scaleTypeProxy.value,
    voicingScale: voicingProxy.value,
    voicingFree: voicingProxy.value,
    inversionScale: inversionProxy.value,
    inversionFree: inversionProxy.value,
    octaveScale: octaveProxy.value,
    octaveFree: octaveProxy.value,
  };
  if (mode === "scale" && !normalized.degree) {
    normalized.degree = props.editChordOptions?.[0]?.degree || "I";
  }
  if (mode === "free" && !normalized.freeRoot) {
    normalized.freeRoot = props.globalScale || "C";
  }
  return normalized;
});

const chordMetadata = computed(() => ({}));

const extensionOptions = computed(() => {
  const options = allowedVoicingsForMetadata(chordMetadata.value);
  return options.length ? options : ["triad"];
});

watch(
  extensionOptions,
  (options) => {
    const list = options && options.length ? options : ["triad"];
    if (list.includes(voicingProxy.value)) return;
    voicingProxy.value = list[0];
  },
  { immediate: true }
);

// When the chord type (extension) changes, reset inversion and voicing pattern
watch(
  () => voicingProxy.value,
  (val, old) => {
    if (val === old) return;
    // Reset inversion to root and voicing pattern to close
    inversionProxy.value = "root";
    selectedVoicingType.value = "close";
    // Emit updated model; inversionProxy and selectedVoicingType watchers
    // will sync the values back into the parent model.
  }
);

// Sync voicing pattern to pad model
watch(selectedVoicingType, (val) => {
  if (model.value.mode === "free") {
    model.value.voicingPatternFree = val;
  } else {
    model.value.voicingPatternScale = val;
  }
  emit("update:modelValue", { ...model.value });
});

// Initialize the selector from the pad model when the dialog is opened/updated.
// This prevents the selector from retaining a previous value when editing
// different pads (the dialog component is reused for all pads).
watch(
  () => model.value,
  (m) => {
    if (!m) return;
    // Initialize from the correct voicing pattern property based on mode.
    // Don't overwrite the selector when unrelated model fields change.
    const voicingPattern =
      m.mode === "free" ? m.voicingPatternFree : m.voicingPatternScale;
    if (voicingPattern != null && voicingPattern !== "") {
      selectedVoicingType.value = voicingPattern;
    } else if (!selectedVoicingType.value) {
      // Only default to 'close' if the selector hasn't been set yet.
      selectedVoicingType.value = "close";
    }
  },
  { immediate: true }
);

import { watchEffect, ref as vueRef } from "vue";
const previewNotesAsc = vueRef([]);
watchEffect(() => {
  const pad = padLikeForPreview.value;
  if (!pad || pad.mode === "unassigned" || pad.assigned === false) {
    previewNotesAsc.value = [];
    return;
  }
  const octRaw = pad.mode === "free" ? pad.octaveFree : pad.octaveScale;
  const parsed = Number(octRaw);
  const baseOct = Number.isFinite(parsed) ? parsed : 4;
  let notes = []; // computeVoicingNotes(pad, baseOct);
  // Apply voicing pattern unless non-tertian
  if (!isNonTertianChord.value) {
    // notes = applyVoicingPattern(notes, selectedVoicingType.value);
  }
  previewNotesAsc.value = notes || [];
});

const previewNotesHtml = computed(() => {
  const pad = padLikeForPreview.value;
  if (!previewNotesAsc.value.length) return "—";
  const display = []; // toDisplayNotesForPad(previewNotesAsc.value, pad);
  return display.length ? display.join(" ") : "—";
});

const previewChordHtml = computed(() => {
  const pad = padLikeForPreview.value;
  if (!pad || pad.mode === "unassigned" || pad.assigned === false) return "—";
  const sym = ""; // chordDisplayForPad(pad);
  return sym || "—";
});

const hasChordForPreview = computed(() => previewNotesAsc.value.length > 0);
</script>
