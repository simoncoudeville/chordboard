<template>
  <dialog class="pad-delete-dialog" ref="dlg" @click.self="onCancel" @cancel.prevent="onCancel">
    <form class="dialog-body" method="dialog" @submit.prevent>
      <div class="dialog-top">
        <h2 class="dialog-title">Reset pad</h2>
        <button
          type="button"
          class="dialog-close"
          @click="onCancel"
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
        <p class="color-warning">{{ props.message }}</p>
      </div>
      <div class="dialog-buttons">
        <button type="button" @click="onCancel">Cancel</button>
        <button type="button" @click="onConfirm">Reset pad</button>
      </div>
    </form>
  </dialog>
</template>

<script setup>
import { ref } from "vue";
import { X } from "lucide-vue-next";

const props = defineProps({
  message: {
    type: String,
    default: "Are you sure you want to reset this pad? This will remove the chord.",
  },
});

const emit = defineEmits(["confirm", "cancel", "close"]);

const dlg = ref(null);

function open() {
  dlg.value?.showModal?.();
}

function close() {
  dlg.value?.close?.();
}

function onCancel() {
  emit("cancel");
  emit("close");
  close();
}

function onConfirm() {
  emit("confirm");
  emit("close");
  close();
}

defineExpose({ open, close, dlg });
</script>
