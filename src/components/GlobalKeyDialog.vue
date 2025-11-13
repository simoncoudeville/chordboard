<template>
  <dialog ref="dlg" @click.self="onClose" @cancel.prevent="onClose">
    <form class="dialog-body" method="dialog" @submit.prevent>
      <div class="dialog-top">
        <h2 class="dialog-title">Global Scale</h2>
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
        <p class="color-meta">
          Set the global scale for all pads in Scale mode.
        </p>
      </div>
      <div class="dialog-content edit-grid">
        <label class="flex-grow-1">
          <span class="label-text">Root</span>
          <CustomSelect
            v-model="scaleLocal"
            :options="scaleRoots"
            option-value-key="value"
            option-label-key="label"
            wrapper-class="select-scale"
          />
        </label>
        <label class="flex-grow-2">
          <span class="label-text">Type</span>
          <CustomSelect
            v-model="typeLocal"
            :options="scaleTypes"
            option-value-key="value"
            option-label-key="label"
          />
        </label>
      </div>
      <div
        v-if="isDirty && scalePadCount > 0"
        class="dialog-content color-warning"
      >
        Changing the global scale will reset
        {{ scalePadCount }} {{ scalePadCount === 1 ? "pad" : "pads" }}
        currently in Scale mode.
      </div>
      <div class="dialog-buttons">
        <button type="button" @click="onClose">Cancel</button>
        <button type="button" @click="onSave" :disabled="!isDirty">Save</button>
      </div>
    </form>
  </dialog>
</template>

<script setup>
import { ref, computed } from "vue";
import { X } from "lucide-vue-next";
import CustomSelect from "./CustomSelect.vue";

const props = defineProps({
  modelScale: { type: String, default: "" },
  modelType: { type: String, default: "" },
  scalePadCount: { type: Number, default: 0 },
});
const emit = defineEmits(["save", "close"]);

const dlg = ref(null);
// Local, confirm-on-save state
const scaleLocal = ref(props.modelScale);
const typeLocal = ref(props.modelType);

// Scale options: display both sharp and flat names for black keys
const scaleRoots = computed(() => [
  { value: "C", label: "C" },
  { value: "Db", label: "C#/Db" },
  { value: "D", label: "D" },
  { value: "Eb", label: "D#/Eb" },
  { value: "E", label: "E" },
  { value: "F", label: "F" },
  { value: "Gb", label: "F#/Gb" },
  { value: "G", label: "G" },
  { value: "Ab", label: "G#/Ab" },
  { value: "A", label: "A" },
  { value: "Bb", label: "A#/Bb" },
  { value: "B", label: "B" },
]);

const usefulScaleTypes = [
  "major",
  "minor",
  "dorian",
  "mixolydian",
  "lydian",
  "phrygian",
  "harmonic minor",
];

const scaleTypes = computed(() =>
  usefulScaleTypes.map((name) => ({
    value: name,
    label: name.replace(/-/g, " "),
  }))
);

const isDirty = computed(
  () =>
    scaleLocal.value !== props.modelScale || typeLocal.value !== props.modelType
);

function open() {
  // Seed locals from current props on each open
  scaleLocal.value = props.modelScale;
  typeLocal.value = props.modelType;
  dlg.value?.showModal();
}
function close() {
  dlg.value?.close();
}
function onClose() {
  emit("close");
  close();
}

function onSave() {
  emit("save", { scale: scaleLocal.value, type: typeLocal.value });
  close();
}

defineExpose({ open });
</script>
