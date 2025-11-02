import { mount } from "@vue/test-utils";
import { describe, it, expect } from "vitest";
import EditDialog from "../src/components/EditDialog.vue";

function findSelectByLabel(
  wrapper: ReturnType<typeof mount>,
  labelText: string
) {
  const labels = wrapper.findAll("label");
  for (const l of labels) {
    if ((l.text() || "").toLowerCase().includes(labelText.toLowerCase())) {
      const sel = l.find("select");
      if (sel.exists()) return sel;
    }
  }
  // Fallback: try within dialog-content sections
  const all = wrapper.findAll("select");
  if (all.length) return all[0];
  throw new Error(`Select with label ${labelText} not found`);
}

function getPreviewText(wrapper: ReturnType<typeof mount>) {
  const sym = wrapper.get(".chord-preview-symbol span").text();
  const notes = wrapper.get(".chord-preview-notes span").text();
  return { sym, notes };
}

// Expected notes calculator based on the same algorithm in the component.
// We keep this minimal and local to tests to validate pipeline behavior.
import { Chord, Note } from "@tonaljs/tonal";
function pcsToAscending(pcs: string[], baseOct: number) {
  const out: string[] = [];
  let last = -Infinity;
  let oct = baseOct;
  for (const pc of pcs) {
    let n = `${pc}${oct}`;
    let m = Note.midi(n) ?? -Infinity;
    if (m <= last) {
      oct += 1;
      n = `${pc}${oct}`;
      m = Note.midi(n) ?? m;
    }
    out.push(n);
    last = m;
  }
  return out;
}
function sortByMidi(notes: string[]) {
  return [...notes].sort((a, b) => (Note.midi(a) ?? 0) - (Note.midi(b) ?? 0));
}
function raiseOct(note: string, delta = 1) {
  const info = Note.get(note);
  const pc = (info as any)?.pc || note.replace(/[0-9]/g, "");
  const baseOct =
    typeof (info as any)?.oct === "number"
      ? (info as any).oct
      : parseInt(note.replace(/^[^0-9]+/, ""), 10) || 4;
  return `${pc}${baseOct + delta}`;
}
function lowerOct(note: string, delta = 1) {
  return raiseOct(note, -delta);
}
function insertAscending(arr: string[], note: string) {
  const m = Note.midi(note) ?? 0;
  const out: string[] = [];
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
function applyInversion(notes: string[], inversionLabel: string) {
  const order = ["root", "1st", "2nd", "3rd", "4th"];
  const steps = Math.max(0, order.indexOf(String(inversionLabel)));
  let res = sortByMidi(notes);
  for (let i = 0; i < steps; i++) {
    if (!res.length) break;
    const lowest = res.shift() as string;
    const raised = raiseOct(lowest, 1);
    res = insertAscending(res, raised);
  }
  return sortByMidi(res);
}
function applyVoicing(notes: string[], pattern: string) {
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
        const idx = n - 2;
        out[idx] = lowerOct(out[idx], 1);
      }
      break;
    }
    case "drop3": {
      if (n >= 3) {
        const idx = n - 3;
        out[idx] = lowerOct(out[idx], 1);
      }
      break;
    }
    case "spread": {
      const mid = Math.floor(n / 2);
      out = out.map((x, i) => (i >= mid ? raiseOct(x, 1) : x));
      break;
    }
  }
  return sortByMidi(out);
}

function expectedNotes(
  symbol: string,
  octave: number,
  inversion: string,
  voicing: string
) {
  const pcs = Chord.get(symbol).notes;
  if (!pcs.length) return [];
  const base = pcsToAscending(pcs, octave);
  return applyVoicing(applyInversion(base, inversion), voicing);
}

describe("EditDialog chord preview + save", () => {
  it("renders expected symbol and notes for scale mode with inversion/voicing and emits snapshot on save", async () => {
    const wrapper = mount(EditDialog, {
      props: {
        padIndex: 0,
        globalScale: "C",
        globalScaleType: "major",
        padState: null,
        isEditDirty: true,
      },
      global: {
        stubs: {
          KeyboardExtended: { template: '<div class="kbd-stub" />' },
          X: true,
          Music2: true,
          ChevronsUpDown: true,
        },
      },
    });

    // Ensure mode is scale (default)
    // Set degree to 5 (G), extension 7, octave 4, inversion 2nd, voicing drop2
    await findSelectByLabel(wrapper, "Chord").setValue("5");
    await findSelectByLabel(wrapper, "Extension").setValue("7");
    await findSelectByLabel(wrapper, "Root octave").setValue("4");
    await findSelectByLabel(wrapper, "Inversion").setValue("2nd");
    await findSelectByLabel(wrapper, "Voicing").setValue("drop2");

    const { sym, notes } = getPreviewText(wrapper);
    expect(sym).toBe("G7");

    const expected = expectedNotes("G7", 4, "2nd", "drop2");
    expect(notes).toBe(expected.join(" "));

    // Click Save and verify snapshot payload
    await wrapper
      .get('button:contains("Save")')
      .trigger("click")
      .catch(() => {
        // Fallback for :contains selector not supported in jsdom
        const buttons = wrapper.findAll("button");
        const saveBtn = buttons.find((b) => b.text().trim() === "Save");
        if (!saveBtn) throw new Error("Save button not found");
        return saveBtn.trigger("click");
      });

    const emitted = wrapper.emitted("save");
    expect(emitted).toBeTruthy();
    const payload = emitted![0][0] as any;
    expect(payload).toMatchObject({
      mode: "scale",
      assigned: true,
      scale: {
        degree: "5",
        octave: 4,
        extension: "7",
        inversion: "2nd",
        voicing: "drop2",
      },
    });
  });
});
