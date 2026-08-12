#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRESET_SCHEMA_VERSION, STYLES, PALETTES, getPalette, getStyle } from "./style-presets.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) args[key] = true;
    else { args[key] = next; i += 1; }
  }
  return args;
}

function usage() {
  console.log(`HIAPI 图标技能\n\n  --list-styles\n  --list-palettes\n  --style <id> --palette <id> --icons "搜索,设置" --preview\n  --ratio <1:1> --background <color> --reference-note <text>`);
}

function conciseList(entries) {
  return Object.entries(entries).map(([id, preset]) => ({ id, nameZh: preset.nameZh, nameEn: preset.nameEn, summaryZh: preset.summaryZh }));
}

function requireChoice(args) {
  const styleId = args.style || "marshmallow-clay";
  const paletteId = args.palette || "macaron-garden";
  const style = getStyle(styleId);
  const palette = getPalette(paletteId);
  if (!style) throw new Error(`未知风格：${styleId}`);
  if (!palette) throw new Error(`未知色板：${paletteId}`);
  const icons = String(args.icons || "").split(/[,，]/u).map((item) => item.trim()).filter(Boolean);
  if (!icons.length || icons.length > 20) throw new Error("--icons 需要包含 1-20 个以逗号分隔的图标主题");
  const ratio = args.ratio || "1:1";
  if (!/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(ratio)) throw new Error("--ratio 必须使用宽:高格式，例如 1:1");
  return { styleId, paletteId, style, palette, icons, ratio };
}

export function buildPrompt({ style, palette, icons, ratio, background, referenceNote }) {
  const roles = Object.entries(palette.roles).map(([role, color]) => `${role}: ${color}`).join("; ");
  const chosenBackground = background || palette.roles.background;
  const reference = referenceNote
    ? `\nReference direction supplied by the user: ${referenceNote}. Use it only for high-level composition, material, or color direction; do not reproduce logos, characters, branded shapes, or protected artwork.`
    : "";
  return [
    `Create one cohesive icon set in the original “${style.nameZh} / ${style.nameEn}” visual system.`,
    `Material: ${style.material}. Surface finish: ${style.surface}.`,
    `Geometry: ${style.geometry}. Proportions: ${style.proportions}.`,
    `Camera and perspective: ${style.camera}. Composition: ${style.composition}. Output ratio: ${ratio}.`,
    `Lighting: ${style.lighting}. Shadow: ${style.shadow}. Edge treatment: ${style.edges}.`,
    `Detail density: ${style.detailDensity}. Background: ${chosenBackground}; ${style.background}.`,
    `Palette roles: ${roles}. Color behavior: ${style.colorBehavior}. Palette guidance: ${palette.guidance} Contrast rule: ${palette.contrast}`,
    `Icon subjects (${icons.length}): ${icons.map((item, index) => `${index + 1}. ${item}`).join("; ")}. Render exactly one clearly separated icon for each subject.`,
    `Cross-set consistency: ${style.consistency}. Give every icon equal optical size, visual weight, baseline, negative space, material scale, and rendering quality.`,
    `Best suited to: ${style.bestFor}. Style-specific exclusions: ${style.avoid}.`,
    `Global exclusions: no text, letters, numerals, logos, watermark, UI screenshots, copyrighted characters, extra icons, duplicated subjects, cropped objects, complex scenery, inconsistent styles, or accidental photorealism.${reference}`,
  ].join("\n");
}

function stableRequestHash(input) {
  const canonical = JSON.stringify({
    schemaVersion: PRESET_SCHEMA_VERSION,
    styleId: input.styleId,
    paletteId: input.paletteId,
    icons: input.icons,
    ratio: input.ratio,
    background: input.background || "",
    referenceNote: input.referenceNote || "",
  });
  return `sha256:${crypto.createHash("sha256").update(canonical).digest("hex")}`;
}

async function writePreview(input) {
  const requestHash = stableRequestHash(input);
  const runId = `run-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}`;
  const outputDir = path.resolve(ROOT, "outputs", runId);
  await fs.mkdir(outputDir, { recursive: true });
  const prompt = buildPrompt(input);
  const brief = [
    "# HIAPI 图标技能预览", "",
    `- 风格：${input.style.nameZh}（${input.style.nameEn} / ${input.styleId}）`,
    `- 色板：${input.palette.nameZh}（${input.palette.nameEn} / ${input.paletteId}）`,
    `- 图标：${input.icons.join("、")}`, `- 比例：${input.ratio}`, "- 状态：preview_only", "",
    "## 生成提示词", "", "```text", prompt, "```", "",
  ].join("\n");
  const manifest = {
    schemaVersion: 2,
    presetSchemaVersion: PRESET_SCHEMA_VERSION,
    runId,
    style: input.styleId,
    styleNameZh: input.style.nameZh,
    palette: input.paletteId,
    paletteNameZh: input.palette.nameZh,
    icons: input.icons,
    ratio: input.ratio,
    status: "preview_only",
    requestHash,
    model: "gpt-image-2",
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(outputDir, "brief.md"), brief, "utf8");
  await fs.writeFile(path.join(outputDir, "prompt.json"), JSON.stringify({
    schemaVersion: 2,
    styleId: input.styleId,
    styleNameZh: input.style.nameZh,
    paletteId: input.paletteId,
    paletteNameZh: input.palette.nameZh,
    icons: input.icons,
    ratio: input.ratio,
    background: input.background || "",
    referenceNote: input.referenceNote || "",
    prompt,
    requestHash,
  }, null, 2), "utf8");
  await fs.writeFile(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  console.log(JSON.stringify({ outputDir, requestHash, status: manifest.status, styleNameZh: manifest.styleNameZh, paletteNameZh: manifest.paletteNameZh, prompt }, null, 2));
}

const args = parseArgs(process.argv.slice(2));
try {
  if (args.help || args.h) { usage(); process.exit(0); }
  if (args["list-styles"]) { console.log(JSON.stringify(conciseList(STYLES), null, 2)); process.exit(0); }
  if (args["list-palettes"]) { console.log(JSON.stringify(conciseList(PALETTES), null, 2)); process.exit(0); }
  if (!args.preview) throw new Error("当前版本仅支持 --preview，尚未启用付费生图任务");
  const input = requireChoice(args);
  await writePreview({ ...input, background: args.background || "", referenceNote: args["reference-note"] || "" });
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
