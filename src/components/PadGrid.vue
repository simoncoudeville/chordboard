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
        @pointermove.prevent.stop="onPointerMove(idx, pad, $event)"
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
import { Bolt, Minus } from "lucide-vue-next";
const props = defineProps({
  pads: { type: Array, required: true },
  permissionAllowed: { type: Boolean, default: false },
  midiEnabled: { type: Boolean, default: false },
  padButtonLabelHtml: { type: Function, required: false, default: () => "" },
});

const emit = defineEmits(["start-pad", "stop-pad", "update-pad", "edit"]);

// Track which pad indices are currently pressed to avoid :active delay on mobile
import { ref } from "vue";
const pressedPads = ref(new Set());

function onEditUnassigned(idx, e) {
  // Defer to next macrotask so any bubbling click/pointerup that might
  // trigger closedBy="any" won't instantly close the dialog.
  setTimeout(() => emit("edit", idx), 0);
}

function onStart(idx, pad, e, coords) {
  if (pad?.mode === "unassigned" || pad?.assigned === false) {
    emit("edit", idx);
    return;
  }
  emit("start-pad", idx, e, coords);
}
function onStop(idx, pad, e) {
  if (pad?.mode === "unassigned" || pad?.assigned === false) return;
  emit("stop-pad", idx, e);
}

function onPressStart(idx, pad, e) {
  // mark pressed state immediately for visual feedback
  pressedPads.value.add(idx);
  const coords = getRelativeCoordinates(e, e.currentTarget);
  onStart(idx, pad, e, coords);
}

function onPointerMove(idx, pad, e) {
  if (!pressedPads.value.has(idx)) return;
  const coords = getRelativeCoordinates(e, e.currentTarget);
  emit("update-pad", idx, coords);
}

function getRelativeCoordinates(event, element) {
  if (!element) return { x: 0.5, y: 0.5 };
  const rect = element.getBoundingClientRect();

  // Safe zones
  const OFF_TOP = 12;
  const OFF_RIGHT = 12;
  const OFF_BOTTOM = 44;
  const OFF_LEFT = 12;

  const w = rect.width - OFF_LEFT - OFF_RIGHT;
  const h = rect.height - OFF_TOP - OFF_BOTTOM;

  if (w <= 0 || h <= 0) return { x: 0.5, y: 0.5 };

  const rawX = event.clientX - rect.left;
  const rawY = event.clientY - rect.top;

  let x = (rawX - OFF_LEFT) / w;
  let y = (rawY - OFF_TOP) / h;

  // Clamp to 0-1
  x = Math.max(0, Math.min(1, x));
  y = Math.max(0, Math.min(1, y));

  // Y is inverted (bottom=0, top=1)
  return { x, y: 1 - y };
}

function onPressEnd(idx, pad, e) {
  // clear pressed state; slight defer to ensure class removal after event cycle
  pressedPads.value.delete(idx);
  onStop(idx, pad, e);
}
</script>
