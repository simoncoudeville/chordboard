<template>
  <div class="top-left">
    <div class="keyboard">
      <div class="keyboard-wrapper">
        <div class="keyboard-octave">
          <div
            class="key key-c key-white"
            :class="{ 'key-played': isKeyActive('c') }"
          ></div>
          <div
            class="key key-d key-white"
            :class="{ 'key-played': isKeyActive('d') }"
          ></div>
          <div
            class="key key-e key-white"
            :class="{ 'key-played': isKeyActive('e') }"
          ></div>
          <div
            class="key key-f key-white"
            :class="{ 'key-played': isKeyActive('f') }"
          ></div>
          <div
            class="key key-g key-white"
            :class="{ 'key-played': isKeyActive('g') }"
          ></div>
          <div
            class="key key-a key-white"
            :class="{ 'key-played': isKeyActive('a') }"
          ></div>
          <div
            class="key key-b key-white"
            :class="{ 'key-played': isKeyActive('b') }"
          ></div>
          <div
            class="key key-db key-black"
            :class="{ 'key-played': isKeyActive('db') }"
          ></div>
          <div
            class="key key-eb key-black"
            :class="{ 'key-played': isKeyActive('eb') }"
          ></div>
          <div
            class="key key-gb key-black"
            :class="{ 'key-played': isKeyActive('gb') }"
          ></div>
          <div
            class="key key-ab key-black"
            :class="{ 'key-played': isKeyActive('ab') }"
          ></div>
          <div
            class="key key-bb key-black"
            :class="{ 'key-played': isKeyActive('bb') }"
          ></div>
        </div>
      </div>
    </div>
    <p>{{ nowPlayingHtml }}</p>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  activeKeySet: { type: Object, required: false, default: () => new Set() }, // Set<string>
  nowPlayingHtml: { type: String, default: "" },
});

function isKeyActive(name) {
  // activeKeySet is a Set of lowercase pitch classes
  return (
    props.activeKeySet && props.activeKeySet.has(String(name).toLowerCase())
  );
}

// Debug readout removed
</script>
