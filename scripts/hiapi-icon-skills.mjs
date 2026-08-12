#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { argv, exit } from "node:process";
import { PRESET_SCHEMA_VERSION, STYLES, PALETTES, getPalette, getStyle } from "./style-presets.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_SCHEMA_VERSION = 3;
const MODES = new Set(["sheet", "individual"]);
const REFERENCE_ROLES = new Set(["style", "composition", "palette", "subject"]);

export function parseArgs(values) {
  const args = {};
  for (let i = 0; i < values.length; i += 1) {
    const token = values[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = values[i + 1];
    const value = !next || next.startsWith("--") ? true : next;
    if (key === "reference") args.reference = [...(args.reference || []), value];
    else args[key] = value;
    if (value !== true) i += 1;
  }
  return args;
}

function usage() {
  console.log(`HIAPI 中文图标技能

规划新图标：
  --list-styles
  --list-palettes
  --style <id> --palette <id> --icons "搜索,设置" --mode <sheet|individual> --preview

可选参数：
  --ratio <1:1> --background <color|transparent>
  --reference <path-or-url> [--reference <path-or-url>]
  --reference-role <style|composition|palette|subject> --reference-note <text>

单点返修：
  --revise-manifest <manifest.json> --revise-icon <主题> --issue <问题> --preview

登记生成结果：
  --register-manifest <manifest.json> --result <image-path> [--result <image-path>]

登记人工验收：
  --qc-manifest <manifest.json> --qc <pass|needs_revision> --qc-note <说明>`);
}

const conciseList = (entries) => Object.entries(entries).map(([id, preset]) => ({
  id, nameZh: preset.nameZh, nameEn: preset.nameEn, summaryZh: preset.summaryZh,
}));

function parseIcons(value) {
  const icons = String(value || "").split(/[,，]/u).map((item) => item.trim()).filter(Boolean);
  if (!icons.length || icons.length > 20) throw new Error("--icons 需要包含 1-20 个以逗号分隔的图标主题");
  if (new Set(icons).size !== icons.length) throw new Error("--icons 不能包含重复主题");
  return icons;
}

function normalizeReferences(args) {
  const references = args.reference || [];
  const role = args["reference-role"] || "style";
  if (!REFERENCE_ROLES.has(role)) throw new Error(`--reference-role 必须是 ${[...REFERENCE_ROLES].join("、")}`);
  return references.map((source, index) => ({ id: index + 1, source: String(source), role }));
}

function requireChoice(args) {
  const styleId = args.style || "marshmallow-clay";
  const paletteId = args.palette || "macaron-garden";
  const style = getStyle(styleId);
  const palette = getPalette(paletteId);
  if (!style) throw new Error(`未知风格：${styleId}`);
  if (!palette) throw new Error(`未知色板：${paletteId}`);
  const mode = args.mode || "sheet";
  if (!MODES.has(mode)) throw new Error("--mode 必须是 sheet 或 individual");
  const ratio = args.ratio || "1:1";
  if (!/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(ratio)) throw new Error("--ratio 必须使用宽:高格式，例如 1:1");
  return {
    styleId, paletteId, style, palette, mode, ratio,
    icons: parseIcons(args.icons),
    background: String(args.background || ""),
    references: normalizeReferences(args),
    referenceNote: String(args["reference-note"] || ""),
  };
}

function chromaKeyFor(palette) {
  const paletteText = Object.values(palette.roles).join(" ").toLowerCase();
  if (/magenta|紫|粉|#ff00ff/.test(paletteText)) return "#00FF00";
  return "#FF00FF";
}

function referenceClause(references, referenceNote) {
  if (!references.length && !referenceNote) return "";
  const images = references.length
    ? `Input images: ${references.map((item) => `Image ${item.id}: ${item.role} reference`).join("; ")}. `
    : "";
  const note = referenceNote ? `Direction: ${referenceNote}. ` : "";
  return `\n${images}${note}Extract only high-level visual properties appropriate to each declared role. Do not reproduce logos, characters, branded shapes, layouts, or protected artwork.`;
}

export function buildPrompt({ style, palette, icons, ratio, background, references = [], referenceNote = "", mode = "sheet" }) {
  const roles = Object.entries(palette.roles).map(([role, color]) => `${role}: ${color}`).join("; ");
  const transparent = background.toLowerCase() === "transparent";
  const key = transparent ? chromaKeyFor(palette) : "";
  const backdrop = transparent
    ? `perfectly flat solid ${key} chroma-key field for later background removal; no floor plane, gradient, texture, reflection, contact shadow, or use of ${key} in any icon`
    : `${background || palette.roles.background}; ${style.background}`;
  const layout = mode === "sheet"
    ? `Arrange all ${icons.length} icons in a clean balanced grid with equal cells and clear separation. Preserve the input order from left to right, then top to bottom.`
    : "Create exactly one isolated icon for the named subject. Do not add companion icons or a grid.";
  return [
    "Use case: stylized-concept",
    `Asset type: ${mode === "sheet" ? "cohesive product icon sheet" : "single product icon"}`,
    `Primary request: Create ${mode === "sheet" ? "one cohesive icon set" : "one icon"} in the original “${style.nameZh} / ${style.nameEn}” visual system.`,
    `Material: ${style.material}. Surface finish: ${style.surface}.`,
    `Geometry: ${style.geometry}. Proportions: ${style.proportions}.`,
    `Camera and perspective: ${style.camera}. Composition: ${style.composition}. ${layout} Output ratio: ${ratio}.`,
    `Lighting: ${style.lighting}. Shadow: ${transparent ? "none; transparency preparation overrides the preset shadow" : style.shadow}. Edge treatment: ${style.edges}.`,
    `Detail density: ${style.detailDensity}. Scene/backdrop: ${backdrop}.`,
    `Palette roles: ${roles}. Color behavior: ${style.colorBehavior}. Palette guidance: ${palette.guidance} Contrast rule: ${palette.contrast}`,
    `Icon subjects (${icons.length}): ${icons.map((item, index) => `${index + 1}. ${item}`).join("; ")}.`,
    `Cross-set consistency: ${style.consistency}. Give every icon equal optical size, visual weight, baseline, negative space, material scale, and rendering quality.`,
    `Style-specific exclusions: ${style.avoid}.`,
    `Global exclusions: no text, letters, numerals, labels, logos, watermark, UI screenshots, copyrighted characters, extra icons, duplicated subjects, cropped objects, complex scenery, inconsistent styles, or accidental photorealism.${referenceClause(references, referenceNote)}`,
  ].join("\n");
}

function promptJobs(input) {
  if (input.mode === "sheet") return [{ jobId: "sheet-01", subject: null, prompt: buildPrompt(input) }];
  return input.icons.map((subject, index) => ({
    jobId: `icon-${String(index + 1).padStart(2, "0")}`,
    subject,
    prompt: buildPrompt({ ...input, icons: [subject] }),
  }));
}

function stableRequestHash(input) {
  const canonical = JSON.stringify({
    schemaVersion: OUTPUT_SCHEMA_VERSION,
    presetSchemaVersion: PRESET_SCHEMA_VERSION,
    styleId: input.styleId,
    paletteId: input.paletteId,
    mode: input.mode,
    icons: input.icons,
    ratio: input.ratio,
    background: input.background,
    references: input.references,
    referenceNote: input.referenceNote,
  });
  return `sha256:${crypto.createHash("sha256").update(canonical).digest("hex")}`;
}

function runId() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `run-${stamp}-${crypto.randomBytes(2).toString("hex")}`;
}

async function writeJson(file, value) {
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writePreview(input) {
  const requestHash = stableRequestHash(input);
  const id = runId();
  const outputDir = path.resolve(ROOT, "outputs", id);
  await fs.mkdir(outputDir, { recursive: true });
  const jobs = promptJobs(input);
  const transparent = input.background.toLowerCase() === "transparent";
  const brief = [
    "# HIAPI 图标技能预览", "",
    `- 风格：${input.style.nameZh}（${input.style.nameEn} / ${input.styleId}）`,
    `- 色板：${input.palette.nameZh}（${input.palette.nameEn} / ${input.paletteId}）`,
    `- 模式：${input.mode === "sheet" ? "整版图标" : "逐枚图标"}`,
    `- 图标：${input.icons.join("、")}`, `- 比例：${input.ratio}`, `- 生成任务：${jobs.length}`, "- 状态：planned", "",
    "## Codex 执行", "",
    "1. 使用内置 image_gen，按 jobs.json 的顺序逐项生成。", "2. 每次生成后检查主题、风格、构图、色板和禁用项。",
    transparent ? "3. 对生成图执行 imagegen Skill 的色键去背流程，验证透明角和边缘无色边。" : "3. 将最终图片保存到本任务目录。",
    "4. 使用 --register-manifest 登记文件，再执行人工 QC。", "",
  ].join("\n");
  const manifest = {
    schemaVersion: OUTPUT_SCHEMA_VERSION,
    presetSchemaVersion: PRESET_SCHEMA_VERSION,
    runId: id,
    style: input.styleId,
    styleNameZh: input.style.nameZh,
    palette: input.paletteId,
    paletteNameZh: input.palette.nameZh,
    mode: input.mode,
    icons: input.icons,
    ratio: input.ratio,
    background: input.background || input.palette.roles.background,
    references: input.references,
    jobCount: jobs.length,
    status: "planned",
    requestHash,
    execution: { provider: "codex_builtin_image_gen", paidHiapiTask: false, transparentPostProcess: transparent },
    results: [],
    qc: { status: "pending", note: "" },
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(outputDir, "brief.md"), brief, "utf8");
  await writeJson(path.join(outputDir, "jobs.json"), { schemaVersion: OUTPUT_SCHEMA_VERSION, requestHash, jobs });
  await writeJson(path.join(outputDir, "request.json"), {
    schemaVersion: OUTPUT_SCHEMA_VERSION,
    styleId: input.styleId, paletteId: input.paletteId, mode: input.mode, icons: input.icons,
    ratio: input.ratio, background: input.background, references: input.references,
    referenceNote: input.referenceNote, requestHash,
  });
  await writeJson(path.join(outputDir, "manifest.json"), manifest);
  console.log(JSON.stringify({ outputDir, manifestPath: path.join(outputDir, "manifest.json"), requestHash, status: manifest.status, jobCount: jobs.length, jobs }, null, 2));
}

async function readManifest(manifestPath) {
  const resolved = path.resolve(manifestPath);
  const manifest = JSON.parse(await fs.readFile(resolved, "utf8"));
  if (manifest.schemaVersion !== OUTPUT_SCHEMA_VERSION) throw new Error(`不支持的 manifest schema：${manifest.schemaVersion}`);
  return { resolved, dir: path.dirname(resolved), manifest };
}

async function writeRevision(args) {
  if (!args["revise-icon"] || !args.issue) throw new Error("返修需要 --revise-icon 和 --issue");
  const parent = await readManifest(String(args["revise-manifest"]));
  const subject = String(args["revise-icon"]);
  if (!parent.manifest.icons.includes(subject)) throw new Error(`父任务中不存在图标主题：${subject}`);
  const style = getStyle(parent.manifest.style);
  const palette = getPalette(parent.manifest.palette);
  const basePrompt = buildPrompt({
    style, palette, icons: [subject], ratio: parent.manifest.ratio,
    background: parent.manifest.background, references: parent.manifest.references || [],
    mode: "individual", referenceNote: "",
  });
  const prompt = `${basePrompt}\nRevision instruction: Change only this issue: ${String(args.issue)}. Preserve the approved style, palette roles, material, camera, scale, lighting, edge treatment, and every unaffected feature.`;
  const id = `${runId()}-revision`;
  const outputDir = path.resolve(ROOT, "outputs", id);
  await fs.mkdir(outputDir, { recursive: true });
  const manifest = {
    schemaVersion: OUTPUT_SCHEMA_VERSION, presetSchemaVersion: PRESET_SCHEMA_VERSION,
    runId: id, parentRunId: parent.manifest.runId, parentRequestHash: parent.manifest.requestHash,
    style: parent.manifest.style, styleNameZh: parent.manifest.styleNameZh,
    palette: parent.manifest.palette, paletteNameZh: parent.manifest.paletteNameZh,
    mode: "revision", icons: [subject], issue: String(args.issue), status: "planned",
    execution: { provider: "codex_builtin_image_gen", paidHiapiTask: false }, results: [],
    qc: { status: "pending", note: "" }, createdAt: new Date().toISOString(),
  };
  await writeJson(path.join(outputDir, "jobs.json"), { schemaVersion: OUTPUT_SCHEMA_VERSION, jobs: [{ jobId: "revision-01", subject, prompt }] });
  await writeJson(path.join(outputDir, "manifest.json"), manifest);
  console.log(JSON.stringify({ outputDir, manifestPath: path.join(outputDir, "manifest.json"), status: manifest.status, jobs: [{ jobId: "revision-01", subject, prompt }] }, null, 2));
}

async function registerResults(args) {
  const target = await readManifest(String(args["register-manifest"]));
  const values = Array.isArray(args.result) ? args.result : [args.result].filter(Boolean);
  if (!values.length) throw new Error("登记结果需要至少一个 --result");
  const results = [];
  for (const value of values) {
    const resolved = path.resolve(String(value));
    const stat = await fs.stat(resolved);
    if (!stat.isFile()) throw new Error(`结果不是文件：${resolved}`);
    results.push({ file: path.relative(target.dir, resolved), bytes: stat.size, sha256: crypto.createHash("sha256").update(await fs.readFile(resolved)).digest("hex") });
  }
  target.manifest.results = results;
  target.manifest.status = "generated_unreviewed";
  target.manifest.updatedAt = new Date().toISOString();
  await writeJson(target.resolved, target.manifest);
  console.log(JSON.stringify({ manifestPath: target.resolved, status: target.manifest.status, results }, null, 2));
}

async function recordQc(args) {
  const target = await readManifest(String(args["qc-manifest"]));
  const status = String(args.qc || "");
  if (!new Set(["pass", "needs_revision"]).has(status)) throw new Error("--qc 必须是 pass 或 needs_revision");
  if (!target.manifest.results?.length) throw new Error("人工 QC 前必须先登记生成结果");
  target.manifest.qc = { status, note: String(args["qc-note"] || ""), reviewedAt: new Date().toISOString() };
  target.manifest.status = status === "pass" ? "approved" : "needs_revision";
  target.manifest.updatedAt = new Date().toISOString();
  await writeJson(target.resolved, target.manifest);
  console.log(JSON.stringify({ manifestPath: target.resolved, status: target.manifest.status, qc: target.manifest.qc }, null, 2));
}

export async function main(values = argv.slice(2)) {
  const args = parseArgs(values);
  if (args.help || args.h) return usage();
  if (args["list-styles"]) return console.log(JSON.stringify(conciseList(STYLES), null, 2));
  if (args["list-palettes"]) return console.log(JSON.stringify(conciseList(PALETTES), null, 2));
  if (args["revise-manifest"]) return writeRevision(args);
  if (args["register-manifest"]) return registerResults(args);
  if (args["qc-manifest"]) return recordQc(args);
  if (!args.preview) throw new Error("规划新图标或返修时需要 --preview；实际生图由 Codex 内置 image_gen 执行");
  return writePreview(requireChoice(args));
}

if (argv[1] && import.meta.url === pathToFileURL(path.resolve(argv[1])).href) {
  main().catch((error) => { console.error(`Error: ${error.message}`); exit(1); });
}
