import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";
import { STYLES, PALETTES } from "../scripts/style-presets.mjs";

const run = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");
const cli = path.join(root, "scripts", "hiapi-icon-skills.mjs");
const requiredStyleFields = ["nameZh", "nameEn", "summaryZh", "material", "surface", "geometry", "proportions", "camera", "composition", "lighting", "shadow", "edges", "detailDensity", "background", "colorBehavior", "consistency", "bestFor", "avoid"];

async function preview(extraArgs = []) {
  const { stdout } = await run(process.execPath, [cli, "--style", "macaron-mascot", "--palette", "macaron-garden", "--icons", "搜索，设置", "--preview", ...extraArgs], { cwd: root });
  return JSON.parse(stdout);
}

test("all presets are complete and Chinese-first names are unique", () => {
  assert.ok(Object.keys(STYLES).length >= 10);
  const names = Object.values(STYLES).map((preset) => preset.nameZh);
  assert.equal(new Set(names).size, names.length);
  for (const [id, preset] of Object.entries(STYLES)) {
    assert.match(id, /^[a-z0-9-]+$/);
    for (const field of requiredStyleFields) assert.ok(String(preset[field] || "").trim(), `${id}.${field} is required`);
  }
  const paletteNames = Object.values(PALETTES).map((preset) => preset.nameZh);
  assert.equal(new Set(paletteNames).size, paletteNames.length);
  for (const [id, preset] of Object.entries(PALETTES)) {
    assert.ok(preset.nameZh && preset.nameEn && preset.summaryZh, `${id} names and summary are required`);
    assert.deepEqual(Object.keys(preset.roles), ["primary", "secondary", "tertiary", "accent", "detail", "background"]);
    assert.ok(preset.guidance && preset.contrast);
  }
});

test("lists concise Chinese-facing styles and palettes", async () => {
  const styles = JSON.parse((await run(process.execPath, [cli, "--list-styles"])).stdout);
  const palettes = JSON.parse((await run(process.execPath, [cli, "--list-palettes"])).stdout);
  assert.equal(styles[0].nameZh, "棉花糖软陶");
  assert.equal(palettes[0].nameZh, "马卡龙花园");
  assert.equal(styles[0].material, undefined);
});

test("preview writes a complete offline package", async () => {
  const result = await preview();
  assert.equal(result.status, "preview_only");
  assert.equal(result.styleNameZh, "马卡龙萌物");
  for (const phrase of ["Camera and perspective", "Composition", "Detail density", "Cross-set consistency", "Global exclusions"]) {
    assert.match(result.prompt, new RegExp(phrase));
  }
  const manifest = JSON.parse(await fs.readFile(path.join(result.outputDir, "manifest.json"), "utf8"));
  assert.equal(manifest.icons.length, 2);
  assert.equal(manifest.styleNameZh, "马卡龙萌物");
  assert.equal(manifest.paletteNameZh, "马卡龙花园");
  assert.equal(manifest.presetSchemaVersion, 2);
  assert.match(manifest.requestHash, /^sha256:[a-f0-9]{64}$/);
});

test("request hash is deterministic across runs", async () => {
  const first = await preview();
  const second = await preview();
  assert.equal(first.requestHash, second.requestHash);
});

test("rejects more than twenty subjects and invalid ratios", async () => {
  const icons = Array.from({ length: 21 }, (_, index) => `icon-${index}`).join(",");
  await assert.rejects(run(process.execPath, [cli, "--icons", icons, "--preview"], { cwd: root }));
  await assert.rejects(run(process.execPath, [cli, "--icons", "搜索", "--ratio", "square", "--preview"], { cwd: root }));
});

test("source does not contain third-party product or preset branding", async () => {
  const files = ["SKILL.md", "scripts/style-presets.mjs", "scripts/hiapi-icon-skills.mjs", "references/prompting.md"];
  const source = (await Promise.all(files.map((file) => fs.readFile(path.join(root, file), "utf8")))).join("\n");
  assert.doesNotMatch(source, /waterlemon|cardboard skill|linepop skill/i);
});
