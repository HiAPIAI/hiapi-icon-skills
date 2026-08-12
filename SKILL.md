---
name: hiapi-icon-skills
description: Generate cohesive product icon sets with original Chinese-named visual styles and role-based palettes through HiAPI image models. Use when Codex needs cartoon macaron chibi icons, clay icons, outlined product icons, tactile craft icons, stickers, batch prompt previews, reference-image direction, or consistent icon-set revisions.
---

# HIAPI Icon Skills

Use the bundled CLI to plan a consistent icon set. Keep Chinese names in user-facing choices and use the English specifications internally for image generation.

## Quick Start

Run from this skill directory:

```powershell
node scripts/hiapi-icon-skills.mjs --list-styles
node scripts/hiapi-icon-skills.mjs --list-palettes
node scripts/hiapi-icon-skills.mjs --style macaron-mascot --palette macaron-garden --icons "搜索,设置,用户,下载" --preview
```

`--preview` is offline. It writes `brief.md`, `prompt.json`, and `manifest.json` under `outputs/` without creating a paid task.

## Workflow

1. List styles and palettes; present their Chinese names first.
2. Choose one style and one palette for the entire batch. Prefer `macaron-mascot` with `macaron-garden` for 卡通马卡龙 Q 版 requests.
3. Accept one to twenty concrete subjects. Split large sets into semantically related batches.
4. Run `--preview`; inspect subject count, camera, composition, color roles, consistency rules, exclusions, and request hash.
5. Ask for approval before any future paid image task. The current version does not submit paid tasks.
6. Mark generated assets `generated_unreviewed` until a person checks silhouette, small-size readability, subject accuracy, text, logos, and cross-set consistency.

## Prompt Rules

- Preserve the chosen preset instead of improvising a new visual system mid-batch.
- Keep camera, optical scale, baseline, negative space, light direction, material scale, edge treatment, and detail density fixed.
- Use palette colors by role rather than distributing every color equally.
- For a revision, identify one defect and preserve all unrelated constraints.
- Use a reference image only when the user has the right to use it. Extract high-level properties; never reproduce branding, characters, or protected artwork.
- Never claim pixel-perfect consistency. Review and rerun individual outliers.

## Resources

- `scripts/hiapi-icon-skills.mjs`: offline CLI, validation, prompt generation, manifest, and stable request hash.
- `scripts/style-presets.mjs`: original structured styles and role-based palettes.
- `references/prompting.md`: selection, batching, reference, and revision guidance.
- `references/output.md`: output package and future task-state contract.
