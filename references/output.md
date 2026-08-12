# Output Contract

Each run lives under `outputs/<run-id>/` and begins in `planned` state:

- `brief.md`: Chinese request summary and Codex execution steps
- `request.json`: normalized user choices and stable request hash
- `jobs.json`: one sheet job or one job per individual icon
- `manifest.json`: style, palette, references, execution provider, results, state, and QC

## States

`planned` -> `generated_unreviewed` -> `approved` or `needs_revision`

Use `--register-manifest` to move from planned to generated. It records each result path, byte size, and SHA-256. Use `--qc-manifest` only after visually inspecting every registered image. A revision creates a new manifest with `parentRunId` and `parentRequestHash`; it never mutates the parent prompt.

The provider is `codex_builtin_image_gen`. No paid HiAPI task is created. Transparent requests use chroma-key preparation and local alpha removal according to the installed imagegen Skill, followed by alpha and edge validation.
