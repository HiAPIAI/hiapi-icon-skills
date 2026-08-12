import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { STYLES, PALETTES } from "../scripts/style-presets.mjs";

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "scripts", "hiapi-icon-skills.mjs");
const installer = path.join(root, "scripts", "install.mjs");
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
});

test("lists concise Chinese-facing styles and palettes", async () => {
  const styles = JSON.parse((await run(process.execPath, [cli, "--list-styles"])).stdout);
  const palettes = JSON.parse((await run(process.execPath, [cli, "--list-palettes"])).stdout);
  assert.equal(styles[0].nameZh, "棉花糖软陶");
  assert.equal(palettes[0].nameZh, "马卡龙花园");
  assert.equal(styles[0].material, undefined);
});

test("sheet preview writes one executable built-in image job", async () => {
  const result = await preview(["--reference", "example.png", "--reference-role", "palette"]);
  assert.equal(result.status, "planned");
  assert.equal(result.jobCount, 1);
  assert.match(result.jobs[0].prompt, /balanced grid/);
  assert.match(result.jobs[0].prompt, /Image 1: palette reference/);
  const manifest = JSON.parse(await fs.readFile(result.manifestPath, "utf8"));
  assert.equal(manifest.execution.provider, "codex_builtin_image_gen");
  assert.equal(manifest.execution.paidHiapiTask, false);
  assert.equal(manifest.schemaVersion, 3);
  assert.match(manifest.requestHash, /^sha256:[a-f0-9]{64}$/);
});

test("individual mode creates one complete prompt per subject", async () => {
  const result = await preview(["--mode", "individual"]);
  assert.equal(result.jobCount, 2);
  assert.equal(result.jobs[0].subject, "搜索");
  assert.match(result.jobs[0].prompt, /exactly one isolated icon/);
  assert.doesNotMatch(result.jobs[0].prompt, /2\. 设置/);
});

test("transparent mode plans chroma-key removal without claiming native alpha", async () => {
  const result = await preview(["--background", "transparent"]);
  assert.match(result.jobs[0].prompt, /chroma-key field/);
  assert.match(result.jobs[0].prompt, /no floor plane/);
  const manifest = JSON.parse(await fs.readFile(result.manifestPath, "utf8"));
  assert.equal(manifest.execution.transparentPostProcess, true);
});

test("request hashes are deterministic but run directories are unique", async () => {
  const first = await preview();
  const second = await preview();
  assert.equal(first.requestHash, second.requestHash);
  assert.notEqual(first.outputDir, second.outputDir);
});

test("revision preserves parent system and changes one named icon", async () => {
  const parent = await preview();
  const { stdout } = await run(process.execPath, [cli, "--revise-manifest", parent.manifestPath, "--revise-icon", "搜索", "--issue", "轮廓太复杂", "--preview"], { cwd: root });
  const revision = JSON.parse(stdout);
  assert.equal(revision.jobs.length, 1);
  assert.match(revision.jobs[0].prompt, /Change only this issue: 轮廓太复杂/);
  assert.match(revision.jobs[0].prompt, /Preserve the approved style/);
});

test("result registration and QC form a gated state sequence", async () => {
  const planned = await preview();
  const image = path.join(planned.outputDir, "result.png");
  await fs.writeFile(image, "fake png bytes");
  const registered = JSON.parse((await run(process.execPath, [cli, "--register-manifest", planned.manifestPath, "--result", image], { cwd: root })).stdout);
  assert.equal(registered.status, "generated_unreviewed");
  assert.match(registered.results[0].sha256, /^[a-f0-9]{64}$/);
  const qc = JSON.parse((await run(process.execPath, [cli, "--qc-manifest", planned.manifestPath, "--qc", "pass", "--qc-note", "主题和风格一致"], { cwd: root })).stdout);
  assert.equal(qc.status, "approved");
});

test("rejects invalid inputs", async () => {
  const icons = Array.from({ length: 21 }, (_, index) => `icon-${index}`).join(",");
  await assert.rejects(run(process.execPath, [cli, "--icons", icons, "--preview"], { cwd: root }));
  await assert.rejects(run(process.execPath, [cli, "--icons", "搜索,搜索", "--preview"], { cwd: root }));
  await assert.rejects(run(process.execPath, [cli, "--icons", "搜索", "--ratio", "square", "--preview"], { cwd: root }));
  await assert.rejects(run(process.execPath, [cli, "--icons", "搜索", "--mode", "sprite", "--preview"], { cwd: root }));
});

test("installer copies runtime files and protects existing installs", async () => {
  const target = await fs.mkdtemp(path.join(os.tmpdir(), "hiapi-icon-install-"));
  try {
    const first = await run(process.execPath, [installer, `--target=${target}`, "--yes"], { cwd: root });
    assert.match(first.stdout, /已安装/);
    const destination = path.join(target, "hiapi-icon-skills");
    assert.match(await fs.readFile(path.join(destination, "SKILL.md"), "utf8"), /HIAPI Icon Skills/);
    await assert.rejects(run(process.execPath, [installer, `--target=${target}`, "--yes"], { cwd: root }));
    await run(process.execPath, [installer, `--target=${target}`, "--yes", "--force"], { cwd: root });
  } finally {
    await fs.rm(target, { recursive: true, force: true });
  }
});

test("source does not contain third-party product or preset branding", async () => {
  const files = ["SKILL.md", "scripts/style-presets.mjs", "scripts/hiapi-icon-skills.mjs", "references/prompting.md"];
  const source = (await Promise.all(files.map((file) => fs.readFile(path.join(root, file), "utf8")))).join("\n");
  const forbidden = ["water", "lemon", "card", "board skill", "line", "pop skill"];
  const patterns = [forbidden[0] + forbidden[1], forbidden[2] + forbidden[3], forbidden[4] + forbidden[5]];
  for (const pattern of patterns) assert.equal(source.toLowerCase().includes(pattern), false);
});
