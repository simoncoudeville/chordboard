<template>
  <div class="keyboard keyboard-extended">
    <!--<div class="root-dot"></div>-->
    <div class="keyboard-wrapper">
      <div class="keyboard-octaves">
        <div v-for="oct in octavesRange" :key="oct" class="keyboard-octave">
          <div
            v-for="pc in whitePcs"
            :key="pc + oct"
            :class="[
              'key',
              `key-${pc}`,
              'key-white',
              isNoteActive(pc, oct) ? 'key-played' : '',
            ]"
            :data-note="pc.toUpperCase() + oct"
          ></div>
          <div
            v-for="pc in blackPcs"
            :key="pc + oct"
            :class="[
              'key',
              `key-${pc}`,
              'key-black',
              isNoteActive(pc, oct) ? 'key-played' : '',
            ]"
            :data-note="pc.toUpperCase() + oct"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { Note } from "@tonaljs/tonal";
import { pcToKeyToken, normalizePcOct } from "../utils/music";

const props = defineProps({
  highlightedNotes: { type: Array, default: () => [] },
  startOctave: { type: Number, default: 2 },
  octaves: { type: Number, default: 8 },
});

const whitePcs = ["c", "d", "e", "f", "g", "a", "b"];
const blackPcs = ["db", "eb", "gb", "ab", "bb"];

// Normalize highlighted notes into a set of strings like 'c4','db3'
const highlightedSet = computed(() => {
  const s = new Set();
  for (const n of props.highlightedNotes || []) {
    if (!n) continue;
    // Use Tonal to get pitch class and octave and normalize via pcToKeyToken
    try {
      const pc = Note.pitchClass(String(n));
      const oct = Note.octave(String(n));
      if (!pc || oct == null) continue;
      const [token, correctedOct] = normalizePcOct(pc, oct);
      if (!token || correctedOct == null) continue;
      s.add(token + String(correctedOct));
    } catch (e) {
      // Fallback: attempt Note.get
      try {
        const info = Note.get(String(n));
        const [token, correctedOct] = normalizePcOct(info?.pc, info?.oct);
        if (token && typeof correctedOct === "number") {
          s.add(token + String(correctedOct));
        }
      } catch {
        // final fallback: ignore
      }
    }
  }
  return s;
});

const octavesRange = computed(() => {
  const arr = [];
  for (let i = 0; i < props.octaves; i++) arr.push(props.startOctave + i);
  return arr;
});

function isNoteActive(pc, octave) {
  const key = (pc || "").toLowerCase() + String(octave);
  return highlightedSet.value.has(key);
}
</script>
