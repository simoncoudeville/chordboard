<template>
  <div class="top">
    <Keyboard
      :active-key-set="activeKeySet"
      :now-playing-html="nowPlayingHtml"
    />
    <div class="midi-status-container">
      <button
        class="icon-button midi"
        :class="midiEnabled && outputs.length > 0 ? '' : 'warning'"
        type="button"
        @click="openMidiDialog"
        :disabled="!midiSupported"
        :title="!midiSupported ? 'Your browser does not support Web MIDI' : ''"
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
      >
        <Music2
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
    @edit="openEditDialog"
  />
  <button
    v-if="showMidiWarningButton"
    class="button-warning"
    type="button"
    @click="openMidiDialog"
  >
    {{ midiWarningLabel }}
  </button>

  <EditDialog
    ref="editDialogRef"
    :pad-index="currentPadIndex"
    :pad-state="pads[currentPadIndex]"
    :global-scale="globalScale"
    :global-scale-type="globalScaleType"
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
    :scale-pad-count="scaleModePadCount"
    @close="onCloseGlobalKey"
    @save="saveGlobalKey"
  />
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { WebMidi } from "webmidi";
import { Music2, Cable, CircleEllipsis, Circle } from "lucide-vue-next";
import { Icon } from "lucide-vue-next";

// Icon data for FoobarIcon (no export needed in <script setup>)
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

const Midi2 = [
  [
    "path",
    {
      d: "M12 17h.01",
      key: "p32p05",
    },
  ],
  [
    "path",
    {
      d: "M15.5 15.5h.01",
      key: "14q5rk",
    },
  ],
  [
    "path",
    {
      d: "M17 12h.01",
      key: "1m0b6t",
    },
  ],
  [
    "path",
    {
      d: "M7 12h.01",
      key: "eqddd0",
    },
  ],
  [
    "path",
    {
      d: "M8.5 15.5h.01",
      key: "pctjho",
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
import { useMidi } from "./composables/useMidi";
import { Scale, Chord, Note } from "@tonaljs/tonal";
import { pcToKeyToken } from "./utils/music";

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

const currentPadIndex = ref(0);

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
const globalScaleNotes = computed(() => {
  try {
    return (
      Scale.get(`${globalScale.value} ${globalScaleType.value}`).notes || []
    );
  } catch {
    return [];
  }
});

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

function saveGlobalKey({ scale, type }) {
  const changed =
    String(scale) !== String(globalScale.value) ||
    String(type) !== String(globalScaleType.value);
  if (changed) {
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

const PAD_COUNT = 15;
const PADS_KEY = "midi-test:pads";

function defaultPad() {
  return {
    mode: "unassigned",
    assigned: false,
    scale: {
      degree: "1",
      octave: 4,
      extension: "triad",
      inversion: "root",
      voicing: "close",
    },
    free: {
      root: "C",
      type: "major",
      octave: 4,
      extension: "triad",
      inversion: "root",
      voicing: "close",
    },
  };
}

const pads = ref(Array.from({ length: PAD_COUNT }, defaultPad));

function loadPads() {
  try {
    const raw = localStorage.getItem(PADS_KEY);
    const parsed = JSON.parse(raw || "null");
    if (Array.isArray(parsed) && parsed.length === PAD_COUNT) {
      pads.value = parsed.map((p) => ({ ...defaultPad(), ...p }));
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
  if (!midiSupported.value)
    return "Warning: Your browser does not support Web MIDI.";
  if (!midiEnabled.value) return "Warning: MIDI is not enabled.";
  if (!hasMidiOutputs.value) return "Warning: No MIDI devices detected.";
  const text = statusDisplay.value || "";
  return text ? `Warning: ${text}` : "Warning: MIDI configuration issue.";
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

function buildChordSymbol(rootPc, isMinor, ext) {
  const suffixMap = {
    triad: "",
    7: "7",
    maj7: "maj7",
    9: "9",
    add9: "add9",
    sus2: "sus2",
    sus4: "sus4",
  };
  const suffix = suffixMap[ext] ?? "";
  if (!isMinor) return `${rootPc}${suffix}`;
  if (ext === "7") return `${rootPc}m7`;
  if (ext === "9") return `${rootPc}m9`;
  if (ext === "maj7") return `${rootPc}mMaj7`;
  if (ext === "add9") return `${rootPc}madd9`;
  if (ext === "sus2" || ext === "sus4") return `${rootPc}${suffix}`;
  return `${rootPc}m${suffix}`;
}

function buildChordSymbolFromQuality(rootPc, quality, ext) {
  if (ext === "sus2" || ext === "sus4") return `${rootPc}${ext}`;
  if (ext === "triad") {
    if (quality === "m") return `${rootPc}m`;
    if (quality === "dim") return `${rootPc}dim`;
    if (quality === "aug") return `${rootPc}aug`;
    return `${rootPc}`;
  }
  if (ext === "7") {
    if (quality === "m") return `${rootPc}m7`;
    if (quality === "dim") return `${rootPc}m7b5`;
    if (quality === "aug") return `${rootPc}7#5`;
    return `${rootPc}7`;
  }
  if (ext === "maj7") {
    if (quality === "m") return `${rootPc}mMaj7`;
    if (quality === "aug") return `${rootPc}maj7#5`;
    return `${rootPc}maj7`;
  }
  if (ext === "9") {
    if (quality === "m") return `${rootPc}m9`;
    return `${rootPc}9`;
  }
  if (ext === "add9") {
    if (quality === "m") return `${rootPc}madd9`;
    if (quality === "dim") return `${rootPc}dim`;
    if (quality === "aug") return `${rootPc}aug`;
    return `${rootPc}add9`;
  }
  return `${rootPc}`;
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

function padChordSymbol(pad) {
  if (!pad || pad.mode === "unassigned" || pad.assigned === false) return "";
  if (pad.mode === "scale") {
    const s = Array.isArray(globalScaleNotes.value)
      ? globalScaleNotes.value
      : [];
    const deg = Math.max(1, parseInt(pad?.scale?.degree ?? "1", 10) || 1);
    const i = (deg - 1) % (s.length || 7);
    const rootPc = s[i] || "C";
    const q = qualityForDegree(i);
    const ext = pad?.scale?.extension || "triad";
    return buildChordSymbolFromQuality(rootPc, q, ext);
  } else if (pad.mode === "free") {
    const rootPc = pad?.free?.root || "C";
    const isMinor = (pad?.free?.type || "major") === "minor";
    const ext = pad?.free?.extension || "triad";
    return buildChordSymbol(rootPc, isMinor, ext);
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
  const pcs = Chord.get(symbol).notes || [];
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
  return s || "UNASSIGNED";
}

import { reactive } from "vue";
const activePadNotes = reactive({});

function onStartPad(idx) {
  try {
    const pad = pads.value?.[idx];
    const notes = padNotes(pad);
    if (!notes.length) return;
    const sel = getSelectedChannel();
    const ch = sel?.ch;
    if (!ch) return;
    activePadNotes[idx] = notes.slice();
    lastPlayedNotes.value = notes.slice(); // Remember last played chord
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

function onStopPad(idx) {
  try {
    const notes = activePadNotes[idx] || [];
    if (!notes.length) return;
    const sel = getSelectedChannel();
    const ch = sel?.ch;
    if (!ch) return;
    try {
      ch.stopNote(notes);
    } catch {
      for (const n of notes) {
        try {
          ch.stopNote(n);
        } catch {}
      }
    }
  } catch {
  } finally {
    activePadNotes[idx] = [];
  }
}
// Preview MIDI handling
const activePreviewNotes = ref([]);
// Track the last played chord to keep it visible on keyboard
const lastPlayedNotes = ref([]);

function onPreviewStart(payload) {
  try {
    const notes = Array.isArray(payload?.notes) ? payload.notes : [];
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
    return lastPlayedNotes.value;
  }
  return fromPads;
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
  return notes.join(" ");
});
</script>
