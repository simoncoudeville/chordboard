<template>
  <dialog
    class="dialog-fullscreen"
    ref="dlg"
    @click.self="onClose"
    @cancel.prevent="onClose"
  >
    <form class="dialog-body" method="dialog" @submit.prevent>
      <div class="dialog-top">
        <h2 class="dialog-title">Info</h2>
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
          Chordboard is a web-based chord pad app. It can send MIDI notes over
          USB to external gear if your browser supports the Web MIDI API.
        </p>
      </div>
      <div class="dialog-content">
        <p
          class="flex align-center gap-1"
          :class="midiSupported ? 'color-valid' : 'color-warning'"
        >
          <BadgeCheck
            v-if="midiSupported"
            class="dialog-info-icon"
            aria-hidden="true"
            :stroke-width="1.5"
            :size="16"
            :absoluteStrokeWidth="true"
          />
          <Frown
            v-else
            class="dialog-info-icon"
            aria-hidden="true"
            :stroke-width="1.5"
            :size="16"
            :absoluteStrokeWidth="true"
          />
          {{ midiSupportMessage }}
        </p>
      </div>
      <div class="dialog-content" v-if="midiSupported">
        <p class="color-meta">
          You should be able to connect external devices. On Android: enable
          <a
            href="https://www.google.com/search?q=android+developer+mode&rlz=1C5GCCM_en&oq=android+developer+mode&gs_lcrp=EgZjaHJvbWUyCQgAEEUYORiABDIHCAEQABiABDIHCAIQABiABDIHCAMQABiABDIHCAQQABiABDIHCAUQABiABDIHCAYQABiABDIHCAcQABiABDIHCAgQABiABDIHCAkQABiABNIBCDUxNDNqMGoxqAIAsAIA&sourceid=chrome&ie=UTF-8"
            >Developer Mode</a
          >
          to allow MIDI over USB. Then connect your device via USB-C and select
          it in the MIDI settings.
        </p>
      </div>
      <div class="dialog-content" v-if="midiSupported">
        <p class="color-meta">
          For best results on mobile, install this website on your phone and add
          it to your home screen.
        </p>
      </div>
      <div class="dialog-content">
        <h3 class="mb-1">Credits</h3>
        <p class="color-meta">
          Created by <a href="https://simoncoudeville.be">Simon Coudeville</a>.
          Check out the source code on
          <a href="https://github.com/simoncoudeville/chordboard">GitHub</a>.
          Open Source under the MIT License.
        </p>
      </div>
    </form>
  </dialog>
</template>

<script setup>
import { ref, computed } from "vue";
import { X, BadgeCheck, Frown } from "lucide-vue-next";

const props = defineProps({
  midiSupported: { type: Boolean, default: true },
});

const emit = defineEmits(["close"]);

const dlg = ref(null);

const midiSupportMessage = computed(() =>
  props.midiSupported
    ? "Great! Your browser supports Web MIDI. "
    : "Unfortunately your browser does not support Web MIDI. Try Chrome on Android or on a desktop browser."
);

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

defineExpose({ open, close, dlg });
</script>
