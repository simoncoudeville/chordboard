<template>
  <dialog ref="dlg" @click.self="onClose" @cancel.prevent="onClose">
    <form class="dialog-body" method="dialog" @submit.prevent>
      <div class="dialog-top">
        <h2 class="dialog-title flex align-center gap-1">What's New</h2>
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
        <span class="color-meta uppercase text-sm"
          >v{{ latest.version }} - {{ formatDate(latest.date) }}</span
        >
        <h3>{{ latest.title }}</h3>
      </div>
      <div class="dialog-content">
        <p class="color-meta">{{ latest.description }}</p>
      </div>
      <div class="dialog-content">
        <ul
          class="list color-meta"
          v-if="latest.features && latest.features.length"
        >
          <li v-for="(feature, idx) in latest.features" :key="idx">
            {{ feature }}
          </li>
        </ul>
      </div>

      <div class="dialog-buttons">
        <button class="button primary" @click="onDismiss">
          Don't show again
        </button>
      </div>
    </form>
  </dialog>
</template>

<script setup>
import { ref, computed } from "vue";
import { X, Sparkles } from "lucide-vue-next";
import { changelog } from "../data/changelog";

const emit = defineEmits(["close", "dismiss"]);

const dlg = ref(null);

const latest = computed(() => changelog[0]);

function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function open() {
  dlg.value?.showModal();
}
function close() {
  dlg.value?.close();
}
function onClose() {
  emit("close");
  close();
}

function onDismiss() {
  emit("dismiss");
  close();
}

defineExpose({ open, close, dlg });
</script>
