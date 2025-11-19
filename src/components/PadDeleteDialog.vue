<template>
  <dialog ref="dlg" @click.self="onCancel" @cancel.prevent="onCancel">
    <form class="dialog-body" method="dialog" @submit.prevent>
      <div class="dialog-top">
        <h2 class="dialog-title">Remove chord?</h2>
      </div>
      <div class="dialog-content">
        <p class="color-meta">{{ props.message }}</p>
      </div>
      <div class="dialog-buttons">
        <button type="button" @click="onCancel">Cancel</button>
        <button type="button" @click="onConfirm">Remove chord</button>
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
    default: "Are you sure you want to remove this pad's chord?",
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
