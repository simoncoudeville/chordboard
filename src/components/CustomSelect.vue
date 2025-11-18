<template>
  <span class="custom-select" :class="wrapperClass">
    <select
      class="custom-select-input"
      :value="modelValue"
      @change="onChange"
      v-bind="$attrs"
    >
      <slot name="options" v-if="$slots.options" />
      <template v-else>
        <option
          v-for="opt in normalizedOptions"
          :key="String(opt.value)"
          :value="opt.value"
        >
          {{ opt.label }}
        </option>
      </template>
    </select>
    <ChevronsUpDown
      class="custom-select-icon"
      aria-hidden="true"
      :stroke-width="1.5"
      :size="16"
      :absoluteStrokeWidth="true"
    />
  </span>
</template>

<script setup>
import { computed } from "vue";
import { ChevronsUpDown } from "lucide-vue-next";

const props = defineProps({
  modelValue: { type: [String, Number], default: "" },
  options: { type: Array, default: () => null }, // array of primitives or objects
  optionValueKey: { type: String, default: "value" },
  optionLabelKey: { type: String, default: "label" },
  castNumber: { type: Boolean, default: false },
  wrapperClass: { type: [String, Object, Array], default: "" },
});

const emit = defineEmits(["update:modelValue", "change"]);

const normalizedOptions = computed(() => {
  if (!Array.isArray(props.options)) return [];
  return props.options.map((o) => {
    if (o && typeof o === "object") {
      return { value: o[props.optionValueKey], label: o[props.optionLabelKey] };
    }
    return { value: o, label: o };
  });
});

function onChange(e) {
  let val = e.target.value;
  if (props.castNumber) {
    const n = Number(val);
    val = Number.isNaN(n) ? val : n;
  }
  emit("update:modelValue", val);
  emit("change", val);
}
</script>
