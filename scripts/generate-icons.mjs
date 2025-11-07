import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(process.cwd());
const srcSvg = path.join(root, "public", "icon.svg");
const outDir = path.join(root, "public", "icons");

const sizes = [192, 512];

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function generate() {
  await ensureDir(outDir);
  const svg = await fs.readFile(srcSvg);

  for (const size of sizes) {
    const outFile = path.join(outDir, `icon-${size}.png`);
    await sharp(svg)
      .resize(size, size, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9 })
      .toFile(outFile);
    console.log("wrote", path.relative(root, outFile));
  }

  // Also write a maskable variant if desired (same art, declared as maskable)
  const maskable = path.join(outDir, "icon-512-maskable.png");
  await sharp(svg)
    .resize(512, 512, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(maskable);
  console.log("wrote", path.relative(root, maskable));
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
