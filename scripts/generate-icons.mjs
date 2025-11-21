import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(process.cwd());
const srcSvg = path.join(root, "public", "favicon.svg");
const outDir = path.join(root, "public", "icons");

const sizes = [192, 512];

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function generate() {
  await ensureDir(outDir);
  const svg = await fs.readFile(srcSvg);

  // Generate standard icons without padding
  for (const size of sizes) {
    const outFile = path.join(outDir, `icon-${size}.png`);
    await sharp(svg)
      .resize(size, size, {
        fit: "contain",
        background: { r: 13, g: 13, b: 13, alpha: 1 },
      })
      .png({ compressionLevel: 9 })
      .toFile(outFile);
    console.log("wrote", path.relative(root, outFile));
  }

  // Generate maskable variant with 20% padding for safe area
  // Android adaptive icons use ~66% safe zone (circle inscribed in square)
  // 20% padding on each side = 40% total margin = 60% content size
  const maskableSize = 512;
  const contentSize = Math.round(maskableSize * 0.6); // 60% of canvas for content
  const padding = Math.round((maskableSize - contentSize) / 2); // 20% on each side

  const maskable = path.join(outDir, "icon-512-maskable.png");
  await sharp(svg)
    .resize(contentSize, contentSize, {
      fit: "contain",
      background: { r: 13, g: 13, b: 13, alpha: 1 },
    })
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 13, g: 13, b: 13, alpha: 1 },
    })
    .png({ compressionLevel: 9 })
    .toFile(maskable);
  console.log(
    "wrote",
    path.relative(root, maskable),
    "(with safe-area padding)"
  );
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
