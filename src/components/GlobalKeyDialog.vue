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
            :size="14"
            stroke-width="1.25"
          />

          <span class="sr-only">Close</span>
        </button>
      </div>

      <div class="dialog-content edit-grid">
        <label>
          <span class="label-text">Root</span>
          <CustomSelect
            v-model="scaleLocal"
            :options="scaleRoots"
            option-value-key="value"
            option-label-key="label"
            wrapper-class="select-scale"
          />
        </label>
        <label>
          <span class="label-text">Type</span>
          <CustomSelect
            v-model="typeLocal"
            :options="scaleTypes"
            option-value-key="value"
            option-label-key="label"
          />
        </label>
        <p
          v-if="isDirty && scalePadCount > 0"
          class="grid-span-2 color-warning"
        >
          Changing the global scale will reset {{ scalePadCount }} pads
          currently in Scale mode.
        </p>
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
import { ScaleType, Note, Scale } from "@tonaljs/tonal";
import CustomSelect from "./CustomSelect.vue";

const props = defineProps({
  modelScale: { type: String, default: "" },
  modelType: { type: String, default: "" },
  MAJOR_KEY_OPTIONS: { type: Array, default: () => [] },
  scalePadCount: { type: Number, default: 0 },
});
const emit = defineEmits(["save", "close"]);

const dlg = ref(null);
// Local, confirm-on-save state
const scaleLocal = ref(props.modelScale);
const typeLocal = ref(props.modelType);

// Scale options from tonal.js
const scaleRoots = computed(() => {
  return Scale.get("C chromatic").notes.map((name) => ({
    value: name,
    label: name,
  }));
});

const scaleTypes = computed(() => {
  return ScaleType.names().map((name) => ({
    value: name,
    label: name.replace(/-/g, " "),
  }));
});

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
