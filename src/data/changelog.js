export const changelog = [
  {
    version: "1.2.1",
    date: "2025-12-26",
    title: "Smarter Transpose & Ranges",
    description:
      "It is now possible to transpose to lower and higher notes, utilizing the full visible keyboard range. Intelligent constraints keep everything visible and safely within bounds.",
    features: [
      "Extended Transpose Range: Chords can now be transposed across the full visible keyboard (C1-B7), with strict limits to ensure visibility.",
      "Expanded Octave Support: Internal handling for wider octaves to support deep bass and high treble voicings.",
      "Smart Controls: Voicing and Inversion dropdowns now disable options that would push notes off the keyboard.",
      "Auto-Correction: Chords gently slide to the nearest valid octave if you change parameters that would break the range limits, preventing big jumps.",
    ],
  },
  {
    version: "1.2.0",
    date: "2025-12-16",
    title: "X/Y Axis Expression",
    description:
      "Introduces X/Y axis mapping for pads, giving you dynamic control over how your chords are played based on where you tap. Also the default number of pads is now 12.",
    features: [
      "Velocity: Map axis to note velocity",
      "Tilt: Lean towards bass or treble notes",
      "Strum: Control the strum speed (up to 500ms)",
      "Humanization: Add random micro-timing and velocity variations",
      "Aftertouch: Send channel aftertouch messages",
      "Pad count consolidated to 12. Assigned pads outside this range are moved to empty slots, or removed if no space remains.",
    ],
  },
  {
    version: "1.1.0",
    date: "2025-12-02",
    title: "Optional Global Scale",
    description:
      "You can now disable or enable the global scale so you can more easily play chromatic chords if you prefer that.",
    features: [
      "Added a toggle switch in global scale settings",
      "When disabled there is no choice between scale and free mode when assigning chords to pads",
      "Existing pads in scale will be converted to free mode when global scale is disabled",
    ],
  },
];
