#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, env, exit, stdin } from "node:process";

const SKILL_NAME = "hiapi-icon-skills";
const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const COPY_ENTRIES = ["LICENSE", "SKILL.md", "agents", "package.json", "references", "scripts"];

function value(args, name) {
  const hit = args.find((item) => item.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3).replace(/^~(?=$|[\\/])/, homedir()) : null;
}

function targets(args) {
  const explicit = value(args, "target") || value(args, "skills-dir");
  if (explicit) return [{ label: "custom", dir: resolve(explicit) }];
  if (env.AGENT_SKILLS_DIR) return [{ label: "$AGENT_SKILLS_DIR", dir: resolve(env.AGENT_SKILLS_DIR) }];
  const codexRequested = args.includes("--codex");
  const claudeRequested = args.includes("--claude");
  if (codexRequested && claudeRequested) throw new Error("--codex 和 --claude 不能同时使用；用 -y 才表示安装到所有已检测 Agent");
  const codex = env.CODEX_HOME || join(homedir(), ".codex");
  const claude = join(homedir(), ".claude");
  if (codexRequested) return [{ label: "Codex", dir: join(codex, "skills") }];
  if (claudeRequested) return [{ label: "Claude Code", dir: join(claude, "skills") }];
  const candidates = [];
  if (existsSync(codex)) candidates.push({ label: "Codex", dir: join(codex, "skills") });
  if (existsSync(claude)) candidates.push({ label: "Claude Code", dir: join(claude, "skills") });
  if (!candidates.length) throw new Error("未检测到 Agent 技能目录，请使用 --codex、--claude 或 --target=PATH");
  if (candidates.length > 1 && stdin.isTTY && !args.includes("-y") && !args.includes("--yes")) {
    throw new Error("检测到多个 Agent；请用 --codex、--claude，或 -y 安装到全部");
  }
  return candidates;
}

export function install(args = argv.slice(2)) {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`HIAPI 中文图标技能安装器

  npx -y github:HiAPIAI/hiapi-icon-skills -y
  node scripts/install.mjs --codex
  node scripts/install.mjs --claude
  node scripts/install.mjs --target=PATH

选项：--force 覆盖已有安装；-y 安装到所有已检测 Agent。`);
    return;
  }
  for (const target of targets(args)) {
    const destination = join(target.dir, SKILL_NAME);
    if (existsSync(destination)) {
      if (!args.includes("--force")) throw new Error(`${destination} 已存在；确认后使用 --force 覆盖`);
      rmSync(destination, { recursive: true, force: true });
    }
    mkdirSync(destination, { recursive: true });
    for (const entry of COPY_ENTRIES) cpSync(join(SOURCE_ROOT, entry), join(destination, entry), { recursive: true });
    console.log(`[HIAPI 中文图标技能] 已安装到 ${target.label}：${destination}`);
  }
  console.log("请重启会缓存技能列表的 Agent。内置 image_gen 路径不需要额外 API Key。");
}

try { install(); } catch (error) { console.error(`[HIAPI 中文图标技能] ${error.message}`); exit(1); }
