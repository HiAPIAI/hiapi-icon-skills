# Output Contract

`--preview` writes an offline package under `outputs/<run-id>/`:

- `brief.md`: human-readable request summary and prompt
- `prompt.json`: resolved input and prompt with no API key
- `manifest.json`: schema version, style, palette, subjects, model, status, and request hash

The MVP status is `preview_only`. Future HiAPI task generation must use explicit `--dry-run` and `--spend` approval gates, preserve idempotency keys, and mark image results `generated_unreviewed` until human QC.
