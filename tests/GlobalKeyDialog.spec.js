import { mount } from "@vue/test-utils";
import { describe, it, expect } from "vitest";
import GlobalKeyDialog from "../src/components/GlobalKeyDialog.vue";

function findSelectByLabel(wrapper, labelText) {
  const labels = wrapper.findAll("label");
  for (const l of labels) {
    if ((l.text() || "").toLowerCase().includes(labelText.toLowerCase())) {
      const sel = l.find("select");
      if (sel.exists()) return sel;
    }
  }
  throw new Error(`Select with label ${labelText} not found`);
}

describe("GlobalKeyDialog inline reset warning", () => {
  it("shows warning and pluralizes correctly when dirty and pads exist", async () => {
    const wrapper = mount(GlobalKeyDialog, {
      props: {
        modelScale: "C",
        modelType: "major",
        scalePadCount: 2,
      },
      global: {
        stubs: {
          X: true,
          ChevronsUpDown: true,
        },
      },
    });

    // Open seeds locals, but we can just change via selects
    await findSelectByLabel(wrapper, "Root").setValue("D");

    const warn = wrapper.find(".dialog-content.color-warning");
    expect(warn.exists()).toBe(true);
    expect(warn.text()).toContain("reset");
    expect(warn.text()).toContain("2 pads");

    // Singular case
    await wrapper.setProps({ scalePadCount: 1 });
    expect(wrapper.find(".dialog-content.color-warning").text()).toContain(
      "1 pad"
    );
  });
});
