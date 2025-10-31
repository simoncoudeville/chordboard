<template>
  <div class="top">
    <Keyboard />
    <div class="midi-status-container">
      <button
        class="button md"
        :class="midiEnabled && outputs.length > 0 ? 'valid' : 'warning'"
        type="button"
        @click="openMidiDialog"
        :disabled="!midiSupported"
        :title="!midiSupported ? 'Your browser does not support Web MIDI' : ''"
      >
        MIDI
      </button>
      <button
        class="button md icon scale"
        type="button"
        @click="openGlobalKeyDialog"
      >
        <Music2 aria-hidden="true" :size="14" stroke-width="2" />
      </button>
    </div>
  </div>

  <PadGrid
    :pads="pads"
    :permission-allowed="permissionAllowed"
    :midi-enabled="midiEnabled"
  />

  <EditDialog ref="editDialogRef" @save="saveEdit" @close="closeEdit" />

  <MidiDialog
    ref="midiDialogRef"
    :midi-enabled="midiEnabled"
    :midi-supported="midiSupported"
    :outputs="outputs"
    :permission="permission"
    :permission-prompt="permissionPrompt"
    v-model:midi-model-output-id="midiModelOutputId"
    v-model:midi-model-out-ch="midiModelOutCh"
    :status-display="statusDisplay"
    :is-midi-dirty="isMidiDirty"
    @save="saveMidiDialog"
    @close="closeMidiDialog"
    @rescan="rescanMidi"
    @request-permission="handleRequestPermission"
    @refresh-permission="handleRefreshPermission"
    @request-connect="handleRequestConnect"
  />

  <GlobalKeyDialog
    ref="globalKeyDialogRef"
    :model-scale="globalScale"
    :model-type="globalScaleType"
    @close="onCloseGlobalKey"
    @save="saveGlobalKey"
  />
</template>

<script setup>
import {
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
  watch,
  nextTick,
} from "vue";
import { WebMidi } from "webmidi";
import { Music2 } from "lucide-vue-next";
import Keyboard from "./components/Keyboard.vue";
import PadGrid from "./components/PadGrid.vue";
import EditDialog from "./components/EditDialog.vue";
import MidiDialog from "./components/MidiDialog.vue";
import GlobalKeyDialog from "./components/GlobalKeyDialog.vue";
import { useMidi } from "./composables/useMidi";

const {
  midiEnabled,
  status,
  permission,
  outputs,
  selectedOutputId,
  selectedOutCh,
  permissionAllowed: permissionAllowedMidi,
  permissionPrompt: permissionPromptMidi,
  midiWasConnected,
  connectMidi,
  disconnectMidi,
  updatePermissionStatus,
  renderDevices,
  getSelectedChannel,
  applySavedMidiSettings,
  hasValidSavedMidiSettings,
  saveMidiSettings,
} = useMidi();

const midiSupported = ref(true);
const permissionAllowed = permissionAllowedMidi;
const permissionPrompt = permissionPromptMidi;

const editDialogRef = ref(null);
const midiDialogRef = ref(null);
const globalKeyDialogRef = ref(null);

const midiModelOutputId = ref("");
const midiModelOutCh = ref(1);
const isMidiDirty = computed(() => {
  const list = outputs.value || [];
  if (!Array.isArray(list) || list.length === 0) return false;
  const id = midiModelOutputId.value;
  const ch = Number(midiModelOutCh.value);
  const idExists = list.some((o) => o.id === id);
  const chValid = ch >= 1 && ch <= 16;
  if (!idExists || !chValid) return false;
  return selectedOutputId.value !== id || Number(selectedOutCh.value) !== ch;
});

// Global scale state
const globalScale = ref("C");
const globalScaleType = ref("major");

const GLOBAL_SCALE_KEY = "midi-test:global-scale";

// Load global scale settings from localStorage
function loadGlobalScaleSettings() {
  try {
    const raw = localStorage.getItem(GLOBAL_SCALE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object") {
      if (obj.scale) globalScale.value = obj.scale;
      if (obj.type) globalScaleType.value = obj.type;
    }
  } catch {}
}

// Save global scale settings to localStorage
function saveGlobalScaleSettings() {
  try {
    localStorage.setItem(
      GLOBAL_SCALE_KEY,
      JSON.stringify({
        scale: globalScale.value,
        type: globalScaleType.value,
      })
    );
  } catch {}
}

function openMidiDialog() {
  clearVisualDisplay();
  midiModelOutputId.value =
    selectedOutputId.value || outputs.value?.[0]?.id || "";
  midiModelOutCh.value = Number(selectedOutCh.value) || 1;
  midiDialogRef.value?.open?.();
}

function closeMidiDialog() {
  midiDialogRef.value?.close?.();
}

function openGlobalKeyDialog() {
  clearVisualDisplay();
  globalKeyDialogRef.value?.open?.();
}

function onCloseGlobalKey() {}

function saveGlobalKey({ scale, type }) {
  globalScale.value = scale;
  globalScaleType.value = type;
  saveGlobalScaleSettings();
}

function rescanMidi() {
  try {
    renderDevices();
    const exists = outputs.value?.find((o) => o.id === midiModelOutputId.value);
    if (!exists) midiModelOutputId.value = outputs.value?.[0]?.id || "";
  } catch (err) {
    // Error rescanning MIDI
  }
}

function saveMidiDialog() {
  selectedOutputId.value = midiModelOutputId.value;
  selectedOutCh.value = Number(midiModelOutCh.value) || 1;
  saveMidiSettings();
  closeMidiDialog();
}

watch(
  () => outputs.value,
  (list) => {
    const arr = Array.isArray(list) ? list : [];
    if (!arr.length) return;
    const current = selectedOutputId.value;
    const exists = arr.some((o) => o.id === current);
    const desiredId = exists ? current : arr[0].id;
    if (selectedOutputId.value !== desiredId)
      selectedOutputId.value = desiredId;
    if (midiModelOutputId.value !== desiredId)
      midiModelOutputId.value = desiredId;
    const ch = Number(selectedOutCh.value);
    const chValid = ch >= 1 && ch <= 16 ? ch : 1;
    if (selectedOutCh.value !== chValid) selectedOutCh.value = chValid;
    if (Number(midiModelOutCh.value) !== chValid)
      midiModelOutCh.value = chValid;
  },
  { deep: false }
);

async function handleRequestPermission() {
  try {
    await connectMidi();
  } catch {}
  await updatePermissionStatus();
}

async function handleRefreshPermission() {
  await updatePermissionStatus();
}

async function handleRequestConnect() {
  try {
    await connectMidi();
  } catch {}
  await updatePermissionStatus();
}

function clearVisualDisplay() {
  // Do nothing
}

const pads = ref(
  Array.from({ length: 15 }, () => ({ mode: "unassigned", assigned: false }))
);

onMounted(() => {
  midiSupported.value = Boolean(
    (WebMidi && "supported" in WebMidi ? WebMidi.supported : undefined) ??
      (typeof navigator !== "undefined" &&
        typeof navigator.requestMIDIAccess === "function")
  );
  updatePermissionStatus();
  loadGlobalScaleSettings();

  nextTick(() => {
    try {
      midiDialogRef.value?.open?.();
    } catch {}
  });
});

onBeforeUnmount(() => {
  disconnectMidi();
});

const statusDisplay = computed(() => {
  if (!midiSupported.value) return "Web MIDI not supported";
  if (midiEnabled.value) {
    if (!outputs.value?.length) return "MIDI connected — no devices detected";
    return "MIDI connected";
  }
  if (permission.value === "granted") return "MIDI allowed — not connected";
  if (permission.value === "prompt") return "MIDI permission required";
  if (permission.value === "denied") return "MIDI denied";
  return status.value || "MIDI not connected";
});

watch(
  () => permission.value,
  async (p) => {
    if (p === "granted" && midiSupported.value && !midiEnabled.value) {
      try {
        // Auto-connect if MIDI was connected in the last session
        if (midiWasConnected.value) {
          await connectMidi();
          applySavedMidiSettings();
        }
      } catch {}
    }
  },
  { immediate: false }
);

watch(
  () => midiEnabled.value,
  (enabled) => {
    if (enabled) {
      applySavedMidiSettings();
    } else {
      disconnectMidi();
    }
  },
  { immediate: true }
);

function saveEdit() {
  // Do nothing
}

function closeEdit() {
  editDialogRef.value?.close?.();
}
</script>
