<template>
  <div class="pads">
    <div class="pad" v-for="(pad, idx) in pads" :key="idx">
      <!-- Unassigned: open edit dialog on click (avoid pointerdown to prevent immediate close) -->
      <button
        v-if="pad?.mode === 'unassigned' || pad?.assigned === false"
        class="pad-play pad-unassigned"
        @click.prevent.stop="onEditUnassigned(idx, $event)"
        @contextmenu.prevent
        :aria-label="`Unassigned pad ${idx + 1}, click to configure`"
      >
        <span>UNASSIGNED</span>
      </button>

      <!-- Assigned: play/stop with pointer events -->
      <button
        v-else
        class="pad-play"
        :class="{ 'is-pressed': pressedPads.has(idx) }"
        @pointerdown.prevent.stop="onPressStart(idx, pad, $event)"
        @pointerup.prevent.stop="onPressEnd(idx, pad, $event)"
        @pointerleave.prevent.stop="onPressEnd(idx, pad, $event)"
        @pointercancel.prevent.stop="onPressEnd(idx, pad, $event)"
        @contextmenu.prevent
        :aria-label="`Pad ${idx + 1}: ${padButtonLabelHtml(pad)}`"
      >
        <span>{{ padButtonLabelHtml(pad) }}</span>
      </button>
      <div
        class="pad-buttons"
        v-if="!(pad?.mode === 'unassigned' || pad?.assigned === false)"
      >
        <button
          class="pad-edit"
          @click="$emit('delete', idx)"
          :aria-label="`Delete pad ${idx + 1}`"
        >
          <Minus
            class="pad-delete-icon"
            aria-hidden="true"
            :stroke-width="1.25"
            :size="16"
            :absoluteStrokeWidth="true"
          />
          <span class="sr-only">Delete</span>
        </button>
        <button
          class="pad-edit"
          @click="$emit('edit', idx)"
          :aria-label="`Edit pad ${idx + 1}`"
        >
          <Bolt
            class="pad-edit-icon"
            aria-hidden="true"
            :stroke-width="1.25"
            :size="16"
            :absoluteStrokeWidth="true"
          />
          <span class="sr-only">Edit</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  IterationCw,
  Repeat2,
  Repeat,
  Bolt,
  Undo,
  Minus,
  ChevronsUpDown,
} from "lucide-vue-next";
const props = defineProps({
  pads: { type: Array, required: true },
  permissionAllowed: { type: Boolean, default: false },
  midiEnabled: { type: Boolean, default: false },
  padButtonLabelHtml: { type: Function, required: false, default: () => "" },
});

const emit = defineEmits(["start-pad", "stop-pad", "edit"]);

// Track which pad indices are currently pressed to avoid :active delay on mobile
import { ref } from "vue";
const pressedPads = ref(new Set());

function onEditUnassigned(idx, e) {
  // Defer to next macrotask so any bubbling click/pointerup that might
  // trigger closedBy="any" won't instantly close the dialog.
  setTimeout(() => emit("edit", idx), 0);
}

function onStart(idx, pad, e) {
  if (pad?.mode === "unassigned" || pad?.assigned === false) {
    emit("edit", idx);
    return;
  }
  emit("start-pad", idx, e);
}
function onStop(idx, pad, e) {
  if (pad?.mode === "unassigned" || pad?.assigned === false) return;
  emit("stop-pad", idx, e);
}

function onPressStart(idx, pad, e) {
  // mark pressed state immediately for visual feedback
  pressedPads.value.add(idx);
  onStart(idx, pad, e);
}

function onPressEnd(idx, pad, e) {
  // clear pressed state; slight defer to ensure class removal after event cycle
  pressedPads.value.delete(idx);
  onStop(idx, pad, e);
}
</script>
