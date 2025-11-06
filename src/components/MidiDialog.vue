<template>
  <dialog ref="dlg" @click.self="onClose" @cancel.prevent="onClose">
    <form class="dialog-body" method="dialog" @submit.prevent>
      <div class="dialog-top">
        <h2 class="dialog-title">MIDI</h2>
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
      <!-- State machine per design -->
      <template v-if="!midiSupported">
        <div class="dialog-content">
          <p class="color-warning">Web MIDI not supported</p>
          <p class="color-meta">
            Your browser doesn’t support Web MIDI. Try Chrome or Edge.
          </p>
        </div>
      </template>
      <template v-else>
        <!-- 1) Permission required -->
        <template v-if="permissionOnly && permission !== 'denied'">
          <div class="dialog-content">
            <p class="color-warning">MIDI permission required</p>
            <p class="color-meta">
              To use external MIDI devices, allow access when your browser
              prompts you.
            </p>
          </div>
          <div class="dialog-content">
            <button
              type="button"
              class="button block large"
              @click="$emit('request-permission')"
            >
              Allow MIDI
            </button>
          </div>
        </template>

        <!-- 1.1) Permission denied -->
        <template v-else-if="permissionOnly && permission === 'denied'">
          <div class="dialog-content">
            <p class="color-warning">MIDI denied</p>
            <p class="color-meta">
              MIDI permission was blocked. To grant access again, change this
              site's MIDI permission in your browser settings, then reopen this
              dialog.
            </p>
          </div>
        </template>

        <!-- 1.2) Permission granted but not connected yet -->
        <template v-else-if="permission === 'granted' && !midiEnabled">
          <div class="dialog-content">
            <p class="color-warning">MIDI allowed but not enabled</p>
            <p class="color-meta">Enable MIDI to continue.</p>
          </div>
          <div class="dialog-content">
            <button
              type="button"
              class="button block large"
              @click="$emit('request-connect')"
            >
              Enable MIDI
            </button>
          </div>
        </template>

        <!-- 2) Connected but no devices detected -->
        <template v-else-if="midiEnabled && outputs.length === 0">
          <div class="dialog-content">
            <p class="color-warning">No MIDI devices detected</p>
            <p class="color-meta">
              Check your MIDI device and try scanning for devices.
            </p>
          </div>
          <div class="dialog-content">
            <button
              type="button"
              class="button block large"
              @click="$emit('rescan')"
            >
              Scan for devices
            </button>
          </div>
          <div class="dialog-content edit-grid">
            <label class="flex-grow-2">
              <span class="label-text">Output Port</span>
              <CustomSelect
                v-model="outputIdProxy"
                :options="outputs"
                option-value-key="id"
                option-label-key="name"
                :disabled="true"
              />
            </label>
            <label class="flex-grow-2">
              <span class="label-text">Channel</span>
              <CustomSelect
                v-model="outChProxy"
                :options="[
                  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
                ]"
                :cast-number="true"
                :disabled="true"
              />
            </label>
          </div>
          <div class="dialog-buttons">
            <button type="button" @click="onClose">Close</button>
            <button
              type="button"
              @click="$emit('save')"
              :disabled="!isMidiDirty"
            >
              Save
            </button>
          </div>
        </template>

        <!-- 3) Connected with devices -->
        <template v-else>
          <div class="dialog-content">
            <p class="color-valid">MIDI connected</p>
            <p class="color-meta">
              Your MIDI device is connected and ready to use.
            </p>
          </div>
          <div class="dialog-content">
            <button
              type="button"
              class="button block large"
              @click="$emit('rescan')"
            >
              Scan for devices
            </button>
          </div>
          <div class="dialog-content edit-grid">
            <label class="flex-grow-1">
              <span class="label-text">Output Port</span>
              <CustomSelect
                v-model="outputIdProxy"
                :options="outputs"
                option-value-key="id"
                option-label-key="name"
              />
            </label>
            <label>
              <span class="label-text">Channel</span>
              <CustomSelect
                v-model="outChProxy"
                :options="[
                  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
                ]"
                :cast-number="true"
              />
            </label>
          </div>
          <div class="dialog-buttons">
            <button type="button" @click="onClose">Close</button>
            <button
              type="button"
              @click="$emit('save')"
              :disabled="!isMidiDirty"
            >
              Save
            </button>
          </div>
        </template>
      </template>
    </form>
  </dialog>
</template>

<script setup>
import { ref, computed } from "vue";
import { X } from "lucide-vue-next";
import CustomSelect from "./CustomSelect.vue";

const props = defineProps({
  midiEnabled: { type: Boolean, default: false },
  midiSupported: { type: Boolean, default: true },
  outputs: { type: Array, default: () => [] },
  midiModelOutputId: { type: String, default: "" },
  midiModelOutCh: { type: Number, default: 1 },
  statusDisplay: { type: String, default: "" },
  isMidiDirty: { type: Boolean, default: false },
  permission: { type: String, default: "unknown" },
  permissionPrompt: { type: Boolean, default: false },
});

const emit = defineEmits([
  "update:midiModelOutputId",
  "update:midiModelOutCh",
  "save",
  "close",
  "rescan",
  "request-permission",
  "request-connect",
]);

const dlg = ref(null);

const outputIdProxy = computed({
  get: () => props.midiModelOutputId,
  set: (val) => emit("update:midiModelOutputId", val),
});
const outChProxy = computed({
  get: () => props.midiModelOutCh,
  set: (val) => emit("update:midiModelOutCh", val),
});

// Step 1: Permission-only mode when MIDI access is not granted and not enabled yet
const permissionOnly = computed(
  () => props.permission !== "granted" && !props.midiEnabled
);

function open() {
  dlg.value?.showModal();
}
function close() {
  dlg.value?.close();
}

function onClose() {
  emit("close");
}

defineExpose({ open, close, dlg });
</script>
