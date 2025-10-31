<template>
  <div class="pads">
    <div class="pad" v-for="(pad, idx) in pads" :key="idx">
      <!-- Unassigned: open edit dialog on click (avoid pointerdown to prevent immediate close) -->
      <button
        v-if="pad?.mode === 'unassigned' || pad?.assigned === false"
        class="pad-play pad-unassigned"
        @click.prevent.stop="onEditUnassigned(idx, $event)"
        @contextmenu.prevent
      >
        <span>UNASSIGNED</span>
      </button>

      <!-- Assigned: play/stop with pointer events -->
      <button
        v-else
        class="pad-play"
        @pointerdown.prevent.stop="onStart(idx, pad, $event)"
        @pointerup.prevent.stop="onStop(idx, pad, $event)"
        @pointerleave.prevent.stop="onStop(idx, pad, $event)"
        @pointercancel.prevent.stop="onStop(idx, pad, $event)"
        @contextmenu.prevent
      >
        <span>{{ padButtonLabelHtml(pad) }}</span>
      </button>
      <div
        class="pad-buttons"
        v-if="!(pad?.mode === 'unassigned' || pad?.assigned === false)"
      >
        <button class="pad-edit" @click="$emit('edit', idx)">
          <Repeat
            class="pad-edit-icon"
            aria-hidden="true"
            :size="14"
            stroke-width="2"
          />
          <span class="sr-only">Edit</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { IterationCw, Repeat2, Repeat, Bolt } from "lucide-vue-next";
const props = defineProps({
  pads: { type: Array, required: true },
  permissionAllowed: { type: Boolean, default: false },
  midiEnabled: { type: Boolean, default: false },
  padButtonLabelHtml: { type: Function, required: false, default: () => "" },
});

const emit = defineEmits(["start-pad", "stop-pad", "edit"]);

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
</script>
