---
name: hiapi-icon-skills
description: Generate and revise cohesive product icon sets with original Chinese-named visual styles and role-based palettes. Use when Codex needs cartoon macaron chibi icons, clay icons, outlined product icons, tactile craft icons, stickers, icon sheets, individual PNG icons, transparent-background preparation, reference-image direction, or consistent single-icon revisions.
---

# HIAPI Icon Skills

Generate finished raster icons, not merely prompt suggestions. Present style and palette choices in Chinese. Use the bundled CLI to make a deterministic task package, then execute its jobs with Codex's built-in `image_gen` tool.

## Quick Start

Run from this skill directory:

```powershell
node scripts/hiapi-icon-skills.mjs --list-styles
node scripts/hiapi-icon-skills.mjs --list-palettes
node scripts/hiapi-icon-skills.mjs --style macaron-mascot --palette macaron-garden --icons "搜索,设置,用户,下载" --mode sheet --preview
```

Use `macaron-mascot` + `macaron-garden` when the user asks for 卡通马卡龙 Q 版. Use `--mode sheet` for one comparison sheet and `--mode individual` for separate production assets.

## Generate

1. List the Chinese styles and palettes when the user has not selected them.
2. Ask only for missing choices that materially change the result. Otherwise choose the best matching preset and say what you selected.
3. Accept one to twenty concrete subjects. Keep one style, palette, camera, material, and detail density for the whole batch.
4. If reference images are supplied, inspect them first and declare each role as `style`, `composition`, `palette`, or `subject`. Never imply that a reference grants usage rights.
5. Run `--preview`; read `jobs.json` and its manifest. This step is offline and never creates a paid HiAPI task.
6. Call the built-in `image_gen` once per job, in listed order. For edits or reference images stored locally, expose each image with `view_image` before calling `image_gen`.
7. Save every selected final image inside the run directory. Do not leave project-bound results only under the default generated-images directory.
8. Register all selected files with `--register-manifest`. This records relative paths, byte sizes, and SHA-256 values and changes status to `generated_unreviewed`.
9. Inspect the actual images. Check subject accuracy, silhouette at small size, count/order, optical weight, material, camera, palette roles, text, logos, cropping, and cross-icon consistency.
10. Record `--qc pass` only after inspection. Otherwise record `needs_revision` and use the revision workflow.

For transparent output, pass `--background transparent`. Follow the installed `imagegen` Skill's built-in-first chroma-key removal workflow. Validate an alpha channel, transparent corners, subject coverage, and color fringe before registration. Do not claim native transparency.

## Revise One Icon

Use the parent manifest rather than rebuilding the visual system:

```powershell
node scripts/hiapi-icon-skills.mjs --revise-manifest outputs/<run>/manifest.json --revise-icon "搜索" --issue "轮廓太复杂，缩小后不清楚" --preview
```

Generate only the revision job. Preserve all unaffected style, palette, camera, scale, lighting, and material constraints. Register and inspect the replacement before approval.

## Boundaries

- Do not submit a paid HiAPI task. The current execution provider is Codex's built-in `image_gen`.
- Do not promise pixel-perfect consistency. Generate, inspect, and rerun outliers.
- Do not copy third-party prompt text, style names, branding, characters, encrypted files, or visual assets.
- Use a reference only for declared high-level properties and only when the user has the right to use it.
- Do not approve an output without opening the actual image.

## Resources

- `scripts/hiapi-icon-skills.mjs`: task planning, revision, result registration, QC, manifest, and stable request hash.
- `scripts/style-presets.mjs`: original structured styles and role-based palettes.
- `scripts/install.mjs`: Codex/Claude/custom-directory installer.
- `references/prompting.md`: selection, batching, references, and revisions.
- `references/output.md`: state and output contract.
- `assets/macaron-mascot-sheet.png`: original 2x2 batch-consistency example generated while validating this skill.
- `assets/macaron-mascot-search-revision.png`: original single-icon revision example generated from the approved sheet.
