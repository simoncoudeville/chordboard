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
    @start-pad="startPad"
    @stop-pad="stopPad"
  />
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
  const changed = globalScale.value !== scale || globalScaleType.value !== type;
  globalScale.value = scale;
  globalScaleType.value = type;
  if (changed) {
    (pads.value || []).forEach((pad, idx) => {
      if (pad?.mode === "scale") resetPad(idx);
    });
  }
}

function saveMidiDialog() {
  selectedOutputId.value = midiModelOutputId.value;
  selectedOutCh.value = Number(midiModelOutCh.value) || 1;
  saveMidiSettings();
  closeMidiDialog();
}

function rescanMidi() {
  try {
    renderDevices();
    const exists = outputs.value?.find((o) => o.id === midiModelOutputId.value);
    if (!exists) midiModelOutputId.value = outputs.value?.[0]?.id || "";
    logMsg("MIDI devices rescanned");
  } catch (err) {
    logMsg(`Error rescanning MIDI: ${err?.message || err}`);
  }
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

function asPadLike(pad) {
  if (!pad) return null;
  if (pad.mode === "scale") {
    return {
      ...pad,
      scale: globalScale.value,
      scaleTypeScale: globalScaleType.value,
    };
  }
  return pad;
}

function stopAllActive() {
  Object.keys(activePads.value).forEach((idx) => {
    const active = activePads.value[idx];
    if (!active) return;
    if (active.outputId && active.channel != null) {
      const output = WebMidi.outputs.find((o) => o.id === active.outputId);
      const ch = output?.channels?.[active.channel];
      if (ch) {
        for (const note of active.notes || []) ch.sendNoteOff(note);
      }
    }
    delete activePads.value[idx];
  });
  activePads.value = {};
  previewActive.value = null;
  clearVisualDisplay();
}

function clearVisualDisplay() {
  activeKeySet.value = new Set();
  nowPlaying.value = "";
  stickyNotes.value = [];
  stickyLabel.value = "";
  lastActiveIdx.value = null;
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
        await connectMidi();
        applySavedMidiSettings();
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

function saveEdit() {
  // Do nothing
}

async function connectMidiAndMaybeOpenDialog() {
  clearVisualDisplay();
  await connectMidi();
  try {
    if (!hasValidSavedMidiSettings()) openMidiDialog();
  } catch {}
}

function startPad(idx, e) {
  if (activePads.value[idx]) return;
  const padOrig = pads.value[idx];
  if (!padOrig || padOrig.mode === "unassigned" || padOrig.assigned === false)
    return;
  const info = buildPadInfo(padOrig, idx);
  if (!info || !info.notes.length) return;
  const sel = getSelectedChannel();
  try {
    e?.target?.setPointerCapture?.(e.pointerId);
  } catch {}
  if (sel) {
    const channel = sel.output?.channels?.[sel.chNum];
    if (channel) {
      info.notes.forEach((note) => channel.sendNoteOn(note));
    }
  }
  activePads.value[idx] = {
    ...info,
    outputId: sel ? sel.output.id : null,
    channel: sel ? sel.chNum : null,
  };
  stickyNotes.value = info.displayNotes;
  stickyLabel.value = info.label;
  lastActiveIdx.value = idx;
  refreshActiveKeys();
  syncNowPlayingFromActivePads();
  const midiInfo = sel ? ` on ${sel.output.name} ch${sel.chNum}` : " (no MIDI)";
  const notesText = info.displayNotes.length
    ? ` — ${info.displayNotes.join(" ")}`
    : "";
  logMsg(`Start ${idx + 1}: ${info.label}${midiInfo}${notesText}`);
}

function stopPad(idx, e) {
  const active = activePads.value[idx];
  if (!active) return;
  try {
    e?.target?.releasePointerCapture?.(e.pointerId);
  } catch {}
  if (active.outputId && active.channel != null) {
    const output = WebMidi.outputs.find((o) => o.id === active.outputId);
    const ch = output?.channels?.[active.channel];
    if (ch) {
      for (const note of active.notes || []) ch.sendNoteOff(note);
    }
  }
  delete activePads.value[idx];
  refreshActiveKeys();
  syncNowPlayingFromActivePads();
  logMsg(`Stop  ${idx + 1}: ${active.label}`);
}

function startPreview(e) {
  if (previewActive.value) return;
  // Accept voicingType from event payload
  let voicingType = "close";
  let eventObj = e;
  if (e && typeof e === "object" && "voicingType" in e) {
    voicingType = e.voicingType?.value || e.voicingType || "close";
    eventObj = e.event || e;
  }
  // Always use voicingType from event payload for preview
  const info = buildPadInfo(
    { ...editModel.value, voicingType },
    currentEditIndex.value
  );
  if (!info || !info.notes.length) return;
  const sel = getSelectedChannel();
  try {
    eventObj?.target?.setPointerCapture?.(eventObj.pointerId);
  } catch {}
  if (sel) {
    const channel = sel.output?.channels?.[sel.chNum];
    if (channel) {
      info.notes.forEach((note) => channel.sendNoteOn(note));
    }
  }
  previewActive.value = {
    ...info,
    outputId: sel ? sel.output.id : null,
    channel: sel ? sel.chNum : null,
  };
  setActiveKeys(info.cssKeys);
  nowPlaying.value = formatNowPlaying(info.label, info.displayNotes);
  logMsg("Preview start");
}

function stopPreview(e) {
  const active = previewActive.value;
  if (!active) return;
  let eventObj = e;
  if (e && typeof e === "object" && "event" in e) {
    eventObj = e.event || e;
  }
  try {
    eventObj?.target?.releasePointerCapture?.(eventObj.pointerId);
  } catch {}
  if (active.outputId && active.channel != null) {
    const output = WebMidi.outputs.find((o) => o.id === active.outputId);
    const ch = output?.channels?.[active.channel];
    if (ch) {
      for (const note of active.notes || []) ch.sendNoteOff(note);
    }
  }
  previewActive.value = null;
  refreshActiveKeys();
  syncNowPlayingFromActivePads();
  logMsg("Preview stop");
}

function onVisibilityChange() {
  if (document.visibilityState !== "visible") stopAllActive();
}
</script>
