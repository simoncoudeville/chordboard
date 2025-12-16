<template>
  <div class="top">
    <Keyboard
      :active-key-set="activeKeySet"
      :now-playing-html="nowPlayingHtml"
    />
    <div class="top-buttons">
      <button
        class="icon-button midi"
        type="button"
        @click="openMidiDialog"
        :disabled="!midiSupported"
        :title="!midiSupported ? 'Your browser does not support Web MIDI' : ''"
        aria-label="MIDI settings"
      >
        <Icon
          aria-hidden="true"
          :iconNode="Midi"
          :stroke-width="1.5"
          :size="20"
          :absoluteStrokeWidth="true"
        />
      </button>
      <button
        class="icon-button scale"
        type="button"
        @click="openGlobalKeyDialog"
        aria-label="Global scale settings"
      >
        <Music2
          aria-hidden="true"
          :stroke-width="1.5"
          :size="20"
          :absoluteStrokeWidth="true"
        />
      </button>
      <button
        class="icon-button"
        type="button"
        @click="openInfoDialog"
        aria-label="App information"
      >
        <BadgeInfo
          aria-hidden="true"
          :stroke-width="1.5"
          :size="20"
          :absoluteStrokeWidth="true"
        />
      </button>
    </div>
  </div>
  <PadGrid
    :pads="pads"
    :permission-allowed="permissionAllowed"
    :midi-enabled="midiEnabled"
    :pad-button-label-html="padButtonLabelHtml"
    @start-pad="onStartPad"
    @stop-pad="onStopPad"
    @update-pad="onUpdatePad"
    @delete="requestDeletePad"
    @edit="openEditDialog"
  />
  <div v-if="showMidiWarningButton" class="warning">
    <button class="button-warning" type="button" @click="openMidiDialog">
      <OctagonAlert
        aria-hidden="true"
        :stroke-width="1.5"
        :size="16"
        :absoluteStrokeWidth="true"
      />
      {{ midiWarningLabel }}
    </button>
  </div>
  <EditDialog
    ref="editDialogRef"
    :pad-index="currentPadIndex"
    :pad-state="pads[currentPadIndex]"
    :global-scale-root="preferredGlobalScaleRoot"
    :global-scale-display="globalScaleDisplayName"
    :global-scale-type="globalScaleType"
    :global-scale-enabled="globalScaleEnabled"
    :permission-allowed="permissionAllowed"
    :midi-enabled="midiEnabled"
    @preview-start="onPreviewStart"
    @preview-stop="onPreviewStop"
    @save="saveEdit"
    @close="closeEdit"
  />
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
    :model-enabled="globalScaleEnabled"
    :scale-pad-count="scaleModePadCount"
    @close="onCloseGlobalKey"
    @save="saveGlobalKey"
  />
  <InfoDialog
    ref="infoDialogRef"
    :midi-supported="midiSupported"
    @close="onCloseInfo"
  />
  <ChangelogDialog
    ref="changelogDialogRef"
    @close="onCloseChangelog"
    @dismiss="onDismissChangelog"
  />
  <PadDeleteDialog
    ref="padDeleteDialogRef"
    @confirm="confirmDeletePad"
    @cancel="cancelDeletePad"
    @close="onClosePadDeleteDialog"
  />
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { WebMidi } from "webmidi";
import { Music2, BadgeInfo, OctagonAlert } from "lucide-vue-next";
import { Icon } from "lucide-vue-next";

// Icon data for custom Midi icon
const Midi = [
  [
    "path",
    {
      d: "M12 18h.01",
      key: "mhygvu",
    },
  ],
  [
    "path",
    {
      d: "M16.24 16.24h.01",
      key: "1x84wr",
    },
  ],
  [
    "path",
    {
      d: "M18 12h.01",
      key: "yjnet6",
    },
  ],
  [
    "path",
    {
      d: "M6 12h.01",
      key: "c2rlol",
    },
  ],
  [
    "path",
    {
      d: "M7.76 16.24h.01",
      key: "11ncrc",
    },
  ],
  [
    "circle",
    {
      cx: "12",
      cy: "12",
      r: "10",
      key: "1mglay",
    },
  ],
];

import Keyboard from "./components/Keyboard.vue";
import PadGrid from "./components/PadGrid.vue";
import EditDialog from "./components/EditDialog.vue";
import MidiDialog from "./components/MidiDialog.vue";
import GlobalKeyDialog from "./components/GlobalKeyDialog.vue";
import InfoDialog from "./components/InfoDialog.vue";
import ChangelogDialog from "./components/ChangelogDialog.vue";
import PadDeleteDialog from "./components/PadDeleteDialog.vue";
import { useMidi } from "./composables/useMidi";
import { Scale, Note } from "@tonaljs/tonal";
import {
  DEFAULT_EXTENSION,
  normalizeChordType,
  normalizeExtension,
  buildChordDefinition,
} from "./utils/chordSystem";
import { pcToKeyToken } from "./utils/music";
import {
  formatNoteName,
  formatChordSymbol,
  preferredScaleRoot,
  formatScaleName,
  simplifyNoteName,
} from "./utils/enharmonic";
import { changelog } from "./data/changelog";

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
const infoDialogRef = ref(null);
const changelogDialogRef = ref(null);
const padDeleteDialogRef = ref(null);

const currentPadIndex = ref(0);
const deleteConfirmIndex = ref(null);

const midiModelOutputId = ref("");
const midiModelOutCh = ref(1);
const isMidiDirty = computed(() => {
  const list = outputs.value || [];
  if (!Array.isArray(list) || list.length === 0) return false;
  const id = midiModelOutputId.value;
  const ch = Number(midiModelOutCh.value);
  const idExists = list.some((o) => String(o?.id) === String(id));
  const chValid = ch >= 1 && ch <= 16;
  if (!idExists || !chValid) return false;
  const currentId = selectedOutputId.value;
  const currentCh = Number(selectedOutCh.value);
  return (
    String(currentId) !== String(id) || Number.isNaN(ch) || currentCh !== ch
  );
});

// Global scale state
const globalScale = ref("C");
const globalScaleType = ref("major");
const globalScaleEnabled = ref(true);

const preferredGlobalScaleRoot = computed(() =>
  preferredScaleRoot(globalScale.value, globalScaleType.value)
);

const globalScaleDisplayName = computed(() =>
  formatScaleName(globalScale.value, globalScaleType.value)
);

const globalScaleNotes = computed(() => {
  try {
    return (
      Scale.get(`${preferredGlobalScaleRoot.value} ${globalScaleType.value}`)
        .notes || []
    );
  } catch {
    return [];
  }
});

const GLOBAL_SCALE_KEY = "chordboard:global-scale";

// Load global scale settings from localStorage
function loadGlobalScaleSettings() {
  try {
    const raw = localStorage.getItem(GLOBAL_SCALE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object") {
      if (obj.scale) globalScale.value = obj.scale;
      if (obj.type) globalScaleType.value = obj.type;
      if (typeof obj.enabled === "boolean")
        globalScaleEnabled.value = obj.enabled;
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
        enabled: globalScaleEnabled.value,
      })
    );
  } catch {}
}

function openEditDialog(idx) {
  clearVisualDisplay();
  currentPadIndex.value = idx;
  editDialogRef.value?.open?.();
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

function openInfoDialog() {
  clearVisualDisplay();
  infoDialogRef.value?.open?.();
}

function onCloseInfo() {}

function onCloseChangelog() {
  // Do nothing when closed normally (will show again next time)
}

function onDismissChangelog() {
  // Mark as seen ONLY when explicitly dismissed
  const latestVersion = changelog[0]?.version;
  if (latestVersion) {
    localStorage.setItem(CHANGELOG_KEY, latestVersion);
  }
}

const CHANGELOG_KEY = "chordboard:changelog-seen";

function checkChangelog() {
  const latestVersion = changelog[0]?.version;
  if (!latestVersion) return;

  const seenVersion = localStorage.getItem(CHANGELOG_KEY);
  if (seenVersion !== latestVersion) {
    // Open dialog
    // Use setTimeout to ensure it opens after mount and other inits
    setTimeout(() => {
      changelogDialogRef.value?.open?.();
    }, 500);
  }
}

function requestDeletePad(idx) {
  deleteConfirmIndex.value = idx;
  padDeleteDialogRef.value?.open?.();
}

function resetDeleteDialogState() {
  deleteConfirmIndex.value = null;
}

function cancelDeletePad() {
  padDeleteDialogRef.value?.close?.();
  resetDeleteDialogState();
}

function onClosePadDeleteDialog() {
  resetDeleteDialogState();
}

function confirmDeletePad() {
  const idx = deleteConfirmIndex.value;
  if (typeof idx !== "number" || idx < 0 || idx >= pads.value.length) {
    padDeleteDialogRef.value?.close?.();
    resetDeleteDialogState();
    return;
  }
  const pad = pads.value[idx];
  if (pad && pad.mode !== "unassigned" && pad.assigned !== false) {
    onStopPad(idx, pad, null);
  }
  pads.value.splice(idx, 1, defaultPad());
  savePads();
  padDeleteDialogRef.value?.close?.();
  resetDeleteDialogState();
}

function saveGlobalKey({ scale, type, enabled }) {
  const wasEnabled = globalScaleEnabled.value;
  const changed =
    String(scale) !== String(globalScale.value) ||
    String(type) !== String(globalScaleType.value);

  // If disabling scale mode, migrate all scale-mode pads to free mode
  if (wasEnabled && !enabled) {
    pads.value = pads.value.map((p) => {
      if (p && p.mode === "scale" && p.assigned !== false) {
        // Calculate current musical values
        const rootPc = chordRootForPad(p);
        const q = qualityForDegree(currentScaleIndex(p));
        const chordType =
          q === "m"
            ? "minor"
            : q === "dim"
            ? "diminished"
            : q === "aug"
            ? "augmented"
            : "major";

        // Return new pad object in free mode
        return {
          ...p,
          mode: "free",
          free: {
            root: rootPc,
            type: chordType,
            octave: p.scale.octave,
            extension: p.scale.extension,
            inversion: p.scale.inversion,
            voicing: p.scale.voicing,
            accidental: null,
          },
        };
      }
      return p;
    });
    savePads();
  } else if (enabled && changed) {
    // Reset affected pads silently; warning is shown inline in dialog
    const hasAffected = (pads.value || []).some(
      (p) => p && p.mode === "scale" && p.assigned !== false
    );
    if (hasAffected) {
      pads.value = pads.value.map((p) =>
        p && p.mode === "scale" && p.assigned !== false ? defaultPad() : p
      );
      savePads();
    }
  }
  globalScale.value = scale;
  globalScaleType.value = type;
  globalScaleEnabled.value = enabled;
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
  lastPlayedNotes.value = [];
}

const PAD_COUNT = 12;
const PADS_KEY = "chordboard:pads";

function defaultPad() {
  return {
    mode: "unassigned",
    assigned: false,
    scale: {
      degree: "1",
      octave: 4,
      extension: DEFAULT_EXTENSION,
      inversion: "root",
      voicing: "close",
    },
    free: {
      root: "C",
      type: "major",
      accidental: null,
      octave: 4,
      extension: DEFAULT_EXTENSION,
      inversion: "root",
      voicing: "close",
    },
    settings: {
      x: "none",
      y: "none",
    },
  };
}

const pads = ref(Array.from({ length: PAD_COUNT }, defaultPad));

function loadPads() {
  try {
    const raw = localStorage.getItem(PADS_KEY);
    const parsed = JSON.parse(raw || "null");
    if (Array.isArray(parsed)) {
      pads.value = pads.value.map((p, i) =>
        parsed[i] ? { ...defaultPad(), ...parsed[i] } : p
      );
    }
  } catch {}
}
function savePads() {
  try {
    localStorage.setItem(PADS_KEY, JSON.stringify(pads.value));
  } catch {}
}

onMounted(() => {
  midiSupported.value = Boolean(
    (WebMidi && "supported" in WebMidi ? WebMidi.supported : undefined) ??
      (typeof navigator !== "undefined" &&
        typeof navigator.requestMIDIAccess === "function")
  );
  updatePermissionStatus();
  loadGlobalScaleSettings();
  loadPads();
  checkChangelog();
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

const hasMidiOutputs = computed(
  () => Array.isArray(outputs.value) && outputs.value.length > 0
);

const showMidiWarningButton = computed(() => {
  if (!midiSupported.value) return true;
  if (!midiEnabled.value) return true;
  return !hasMidiOutputs.value;
});

const midiWarningLabel = computed(() => {
  if (!midiSupported.value) return "Your browser does not support Web MIDI";
  if (!midiEnabled.value) return "MIDI is not enabled";
  if (!hasMidiOutputs.value) return "No MIDI devices detected";
  const text = statusDisplay.value || "";
  return text ? `${text}` : "MIDI configuration issue";
});

// Count scale-mode pads for inline warning in GlobalKeyDialog
const scaleModePadCount = computed(() =>
  (pads.value || []).reduce(
    (acc, p) => acc + (p && p.mode === "scale" && p.assigned !== false ? 1 : 0),
    0
  )
);

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

function saveEdit(snapshot) {
  try {
    const idx = Number(currentPadIndex.value) || 0;
    const next = { ...defaultPad(), ...snapshot, assigned: true };
    pads.value.splice(idx, 1, next);
    savePads();
  } catch {}
  closeEdit();
}

function closeEdit() {
  editDialogRef.value?.close?.();
}

// Build chord label and notes from pad state
function semitoneDistance(pcFrom, pcTo) {
  const base = Note.midi(`${pcFrom}4`) ?? 60;
  let target = Note.midi(`${pcTo}4`) ?? base;
  while (target < base) target += 12;
  return (target - base) % 12;
}
function qualityFromTriad(triad, rootPc) {
  const [r, t, f] = triad;
  if (!r || !t || !f) return "";
  const third = semitoneDistance(rootPc, t);
  const fifth = semitoneDistance(rootPc, f);
  if (third === 3 && fifth === 6) return "dim";
  if (third === 4 && fifth === 8) return "aug";
  if (third === 3 && fifth === 7) return "m";
  if (third === 4 && fifth === 7) return "";
  return "";
}
function qualityForDegree(index) {
  const s = Array.isArray(globalScaleNotes.value) ? globalScaleNotes.value : [];
  if (s.length < 3) return "";
  const i = index % s.length;
  const triad = [s[i], s[(i + 2) % s.length], s[(i + 4) % s.length]];
  return qualityFromTriad(triad, s[i]);
}

function buildChordSymbol(rootPc, type, extension) {
  const definition = buildChordDefinition(rootPc, type, extension);
  return definition.displaySymbol;
}

function pcsToAscending(pcs, baseOct) {
  const out = [];
  let lastMidi = -Infinity;
  let oct = Number.isFinite(baseOct) ? baseOct : 4;
  for (const pc of pcs) {
    let n = `${pc}${oct}`;
    let m = Note.midi(n) ?? -Infinity;
    if (m <= lastMidi) {
      oct += 1;
      n = `${pc}${oct}`;
      m = Note.midi(n) ?? m;
    }
    out.push(n);
    lastMidi = m;
  }
  return out;
}

// --- Inversion & Voicing helpers (mirror EditDialog logic) ---
function sortByMidi(notes) {
  return [...notes].sort((a, b) => (Note.midi(a) ?? 0) - (Note.midi(b) ?? 0));
}
function raiseOct(note, delta = 1) {
  const info = Note.get(note);
  const pc = info?.pc || note.replace(/[0-9]/g, "");
  const baseOct =
    typeof info?.oct === "number"
      ? info.oct
      : Number.parseInt(note.replace(/^[^0-9]+/, ""), 10) || 4;
  return `${pc}${baseOct + delta}`;
}
function lowerOct(note, delta = 1) {
  return raiseOct(note, -delta);
}
function insertAscending(arr, note) {
  const m = Note.midi(note) ?? 0;
  const out = [];
  let inserted = false;
  for (const n of arr) {
    const mi = Note.midi(n) ?? 0;
    if (!inserted && m <= mi) {
      out.push(note);
      inserted = true;
    }
    out.push(n);
  }
  if (!inserted) out.push(note);
  return out;
}

function applyInversion(notes, inversionLabel) {
  const order = ["root", "1st", "2nd", "3rd", "4th"];
  const steps = Math.max(0, order.indexOf(String(inversionLabel)));
  let res = sortByMidi(notes);
  for (let i = 0; i < steps; i++) {
    if (!res.length) break;
    const lowest = res.shift();
    const raised = raiseOct(lowest, 1);
    res = insertAscending(res, raised);
  }
  return sortByMidi(res);
}

function applyVoicing(notes, pattern) {
  const n = notes.length;
  if (n <= 1 || !pattern || pattern === "close") return sortByMidi(notes);
  let out = [...notes];
  switch (pattern) {
    case "open": {
      const evens = out.filter((_, i) => i % 2 === 0);
      const oddsRaised = out
        .filter((_, i) => i % 2 === 1)
        .map((x) => raiseOct(x, 1));
      out = [...evens, ...oddsRaised];
      break;
    }
    case "drop2": {
      if (n >= 2) {
        const idx = n - 2; // second highest
        out[idx] = lowerOct(out[idx], 1);
      }
      break;
    }
    case "drop3": {
      if (n >= 3) {
        const idx = n - 3; // third highest
        out[idx] = lowerOct(out[idx], 1);
      }
      break;
    }
    case "spread": {
      const mid = Math.floor(n / 2);
      out = out.map((x, i) => (i >= mid ? raiseOct(x, 1) : x));
      break;
    }
    default:
      break;
  }
  return sortByMidi(out);
}

function simplifyNoteList(notes) {
  if (!Array.isArray(notes)) return [];
  return notes.map((n) => simplifyNoteName(n));
}

function chordRootForPad(pad) {
  if (!pad) return "C";
  if (pad.mode === "scale") {
    const s = Array.isArray(globalScaleNotes.value)
      ? globalScaleNotes.value
      : [];
    const deg = Math.max(1, parseInt(pad?.scale?.degree ?? "1", 10) || 1);
    const i = (deg - 1) % (s.length || 7);
    return s[i] || "C";
  }
  return pad?.free?.root || "C";
}

function currentScaleIndex(pad) {
  if (!pad || pad.mode !== "scale") return 0;
  const s = Array.isArray(globalScaleNotes.value) ? globalScaleNotes.value : [];
  const deg = Math.max(1, parseInt(pad?.scale?.degree ?? "1", 10) || 1);
  return (deg - 1) % (s.length || 7);
}

function padChordSymbol(pad) {
  if (!pad || pad.mode === "unassigned" || pad.assigned === false) return "";
  if (pad.mode === "scale") {
    const rootPc = chordRootForPad(pad);
    const q = qualityForDegree(currentScaleIndex(pad));
    const type =
      q === "m"
        ? "minor"
        : q === "dim"
        ? "diminished"
        : q === "aug"
        ? "augmented"
        : "major";
    const ext = normalizeExtension(pad?.scale?.extension);
    return buildChordSymbol(rootPc, type, ext);
  } else if (pad.mode === "free") {
    const rootPc = pad?.free?.root || "C";
    const type = normalizeChordType(pad?.free?.type);
    const ext = normalizeExtension(pad?.free?.extension);
    return buildChordSymbol(rootPc, type, ext);
  }
  return "";
}

function padBaseOctave(pad) {
  if (!pad) return 4;
  if (pad.mode === "scale") return Number(pad?.scale?.octave) || 4;
  if (pad.mode === "free") return Number(pad?.free?.octave) || 4;
  return 4;
}

function padNotes(pad) {
  const symbol = padChordSymbol(pad);
  if (!symbol) return [];
  const type =
    pad.mode === "scale"
      ? normalizeChordType(qualityForDegree(currentScaleIndex(pad)))
      : normalizeChordType(pad?.free?.type);
  const extension =
    pad.mode === "scale"
      ? normalizeExtension(pad?.scale?.extension)
      : normalizeExtension(pad?.free?.extension);
  const definition = buildChordDefinition(
    chordRootForPad(pad),
    type,
    extension
  );
  const pcs = definition.notes;
  const oct = padBaseOctave(pad);
  if (!pcs.length) {
    const rootPc = symbol.replace(/[^A-G#b].*$/, "");
    return [`${rootPc}${oct}`];
  }
  // Base ascending stack
  const base = pcsToAscending(pcs, oct);
  const inv =
    pad.mode === "scale" ? pad?.scale?.inversion : pad?.free?.inversion;
  const voi = pad.mode === "scale" ? pad?.scale?.voicing : pad?.free?.voicing;
  const afterInv = applyInversion(base, inv || "root");
  const afterVoicing = applyVoicing(afterInv, voi || "close");
  return sortByMidi(afterVoicing);
}

function padButtonLabelHtml(pad) {
  const s = padChordSymbol(pad);
  if (!s) return "UNASSIGNED";
  return formatChordSymbol(
    s,
    preferredGlobalScaleRoot.value,
    globalScaleType.value
  );
}

import { reactive } from "vue";
const activePadNotes = reactive({});

const padTimers = reactive({});
const padSchedules = reactive({});

function onStartPad(idx, e, coords) {
  try {
    // Clear any existing state for this pad
    if (padTimers[idx]) {
      padTimers[idx].forEach((id) => clearTimeout(id));
      padTimers[idx] = [];
    } else {
      padTimers[idx] = [];
    }
    padSchedules[idx] = []; // Track scheduled notes { note, time }

    const pad = pads.value?.[idx];
    const rawNotes = padNotes(pad);
    const notes = simplifyNoteList(rawNotes);
    if (!notes.length) return;
    const sel = getSelectedChannel();
    const ch = sel?.ch;
    if (!ch) return;

    // Calculate start parameters
    let baseVelocity = 0.75;
    let strumDuration = 0;
    let humanizeAmount = 0;
    let tiltAmount = 0;

    const settings = pad.settings || { x: "none", y: "none" };

    // Helper to process axis
    const processAxis = (axisValue, func) => {
      if (func === "velocity") {
        baseVelocity = axisValue;
      } else if (func === "strum") {
        // Map 0-1 to 0-500ms
        strumDuration = axisValue * 500;
      } else if (func === "humanization") {
        humanizeAmount = axisValue;
      } else if (func === "velocity-tilt") {
        // Map 0-1 to -1 to 1
        tiltAmount = (axisValue - 0.5) * 2;
      }
    };

    if (coords) {
      processAxis(coords.x, settings.x);
      processAxis(coords.y, settings.y);
    }

    activePadNotes[idx] = notes.slice();
    lastPlayedNotes.value = notes.slice(); // Remember last played chord

    const now = WebMidi.time;
    const strumStep =
      strumDuration > 0 && notes.length > 1 ? strumDuration / notes.length : 0;

    // Look-ahead time for buffering (send notes this many ms in advance)
    const BUFFER_MS = 50;

    // Play notes with individual velocity and timing
    notes.forEach((n, i) => {
      let vel = baseVelocity;

      // Apply Velocity Tilt
      if (tiltAmount !== 0 && notes.length > 1) {
        // -1 (bass loud) to 1 (treble loud)
        // Position in chord: 0 to 1
        const pos = i / (notes.length - 1);
        // Bias: -1 (bass) to 1 (treble)
        const bias = pos * 2 - 1;
        // Effect: tilt * bias.
        // If tilt is -1 (bass loud): bass(bias=-1) -> +1, treble(bias=1) -> -1
        // If tilt is 1 (treble loud): bass(bias=-1) -> -1, treble(bias=1) -> +1
        // Scale factor: 0.25 (so +/- 0.25 velocity change)
        vel += tiltAmount * bias * 0.25;
      }

      // Apply Humanization (Velocity)
      if (humanizeAmount > 0) {
        // +/- 0.2 (approx 25 velocity steps) at max
        const delta = (Math.random() - 0.5) * 0.4 * humanizeAmount;
        vel += delta;
      }

      // Clamp velocity
      vel = Math.max(0.01, Math.min(1, vel));

      // Calculate exact MIDI timestamp for this note
      let noteTime = now + i * strumStep;

      // Apply Humanization (Microtiming)
      if (humanizeAmount > 0) {
        // +/- 35ms * amount
        const timeDelta = (Math.random() - 0.5) * 70 * humanizeAmount;
        noteTime += timeDelta;
      }

      // Ensure we don't schedule in the past
      if (noteTime < now) noteTime = now;

      const schedule = () => {
        try {
          // Use precise MIDI time
          ch.playNote(n, { attack: vel, time: noteTime });
          // Track that we sent this note to the driver
          padSchedules[idx].push({ note: n, time: noteTime });
        } catch {}
      };

      const timeUntilNote = noteTime - WebMidi.time;

      // If note is far in future, wait before scheduling
      // This allows us to cancel the setTimeout if user releases pad early
      if (timeUntilNote > BUFFER_MS) {
        const wakeupTime = timeUntilNote - BUFFER_MS;
        const timerId = setTimeout(schedule, wakeupTime);
        padTimers[idx].push(timerId);
      } else {
        // Close enough, schedule immediately
        schedule();
      }
    });

    // Send initial continuous values if applicable
    if (coords) {
      sendContinuousExpression(ch, settings.x, coords.x);
      sendContinuousExpression(ch, settings.y, coords.y);
    }
  } catch {}
}

function onUpdatePad(idx, coords) {
  try {
    const pad = pads.value?.[idx];
    if (!pad) return;
    const sel = getSelectedChannel();
    const ch = sel?.ch;
    if (!ch) return;

    const settings = pad.settings || { x: "none", y: "none" };
    sendContinuousExpression(ch, settings.x, coords.x);
    sendContinuousExpression(ch, settings.y, coords.y);
  } catch {}
}

function sendContinuousExpression(ch, func, value) {
  if (func === "aftertouch") {
    // Send channel aftertouch
    try {
      ch.setChannelAftertouch(value);
    } catch {}
  }
}

function onStopPad(idx) {
  try {
    // 1. Cancel any future notes that haven't been sent to MIDI driver yet
    if (padTimers[idx]) {
      padTimers[idx].forEach((id) => clearTimeout(id));
      padTimers[idx] = [];
    }

    // 2. Stop notes that were already sent or played
    // We need to stop them SAFELY.
    // If a note was scheduled for the future (e.g. now + 100ms),
    // sending stopNote() NOW (at now) might be ignored or cause stuck note
    // depending on the driver/synth because NoteOff comes before NoteOn.
    // So we must schedule the stop to happen slightly AFTER the start.
    const scheduled = padSchedules[idx] || [];
    const now = WebMidi.time;

    // We also stop 'activePadNotes' just in case, though padSchedules covers it
    const fallbackNotes = activePadNotes[idx] || [];
    const sel = getSelectedChannel();
    const ch = sel?.ch;

    if (ch) {
      // Create a set of notes we know about from schedule
      const handledNotes = new Set();

      scheduled.forEach((item) => {
        handledNotes.add(item.note);
        try {
          // Schedule stop at least 20ms after start, or now, whichever is later
          const stopTime = Math.max(now, item.time + 20);
          ch.stopNote(item.note, { time: stopTime });
        } catch {}
      });

      // Legacy cleanup for any notes not in our schedule list (safety net)
      fallbackNotes.forEach((n) => {
        if (!handledNotes.has(n)) {
          try {
            ch.stopNote(n);
          } catch {}
        }
      });
    }
  } catch {
  } finally {
    activePadNotes[idx] = [];
    padSchedules[idx] = [];
  }
}
// Preview MIDI handling
const activePreviewNotes = ref([]);
// Track the last played chord to keep it visible on keyboard
const lastPlayedNotes = ref([]);

function onPreviewStart(payload) {
  try {
    const rawNotes = Array.isArray(payload?.notes) ? payload.notes : [];
    const notes = simplifyNoteList(rawNotes);
    if (!notes.length) return;
    const sel = getSelectedChannel();
    const ch = sel?.ch;
    if (!ch) return;
    activePreviewNotes.value = notes.slice();
    try {
      ch.playNote(notes);
    } catch {
      for (const n of notes) {
        try {
          ch.playNote(n);
        } catch {}
      }
    }
  } catch {}
}

function onPreviewStop() {
  try {
    if (!activePreviewNotes.value.length) return;
    const sel = getSelectedChannel();
    const ch = sel?.ch;
    if (!ch) return;
    try {
      ch.stopNote(activePreviewNotes.value);
    } catch {
      for (const n of activePreviewNotes.value) {
        try {
          ch.stopNote(n);
        } catch {}
      }
    }
  } catch {
  } finally {
    activePreviewNotes.value = [];
  }
}

// pcToKeyToken imported from ./utils/music

// Currently playing note names (with octaves) from pads.
// When no pads are active, show the last played chord.
const activeNoteNames = computed(() => {
  const fromPads = Object.values(activePadNotes).flatMap((arr) =>
    Array.isArray(arr) ? arr : []
  );
  // If no pads are currently playing, show the last played chord
  if (fromPads.length === 0 && lastPlayedNotes.value.length > 0) {
    return simplifyNoteList(lastPlayedNotes.value);
  }
  return simplifyNoteList(fromPads);
});

// Active keys as a Set of lowercase pitch-class tokens for Keyboard.vue
const activeKeySet = computed(() => {
  const set = new Set();
  for (const n of activeNoteNames.value) {
    const info = Note.get(n);
    const token = pcToKeyToken(info?.pc);
    if (token) set.add(token);
  }
  return set;
});

// Human-friendly now playing line
const nowPlayingHtml = computed(() => {
  const notes = activeNoteNames.value.slice();
  if (!notes.length) return "";
  // Sort ascending by MIDI for readability
  notes.sort((a, b) => (Note.midi(a) ?? 0) - (Note.midi(b) ?? 0));
  // Format each note with enharmonic preference based on global key
  const formatted = notes.map((n) =>
    formatNoteName(n, preferredGlobalScaleRoot.value, globalScaleType.value)
  );
  return formatted.join(" ");
});
</script>
