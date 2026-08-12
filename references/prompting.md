# Prompting

## Selection

Choose by use case rather than by a vague aesthetic label:

- 卡通马卡龙 Q 版：`macaron-mascot` + `macaron-garden`
- 柔软无描边 3D：`marshmallow-clay` + `mint-morning`
- 高识别产品描边：`ink-accent` + `lime-signal`
- 真实手作纸材质：`stitched-fiber` + `kraft-play`
- 小尺寸徽章或贴纸：`bubble-sticker` + `soda-shop`
- 功能叙事场景：`mini-diorama` + a restrained palette

## Construction Order

Build every prompt in this order:

1. Chinese and English style identity
2. Material and surface finish
3. Geometry and proportions
4. Camera, perspective, composition, and output ratio
5. Lighting, shadow, and edge treatment
6. Detail density and background
7. Palette roles, color behavior, and contrast rule
8. Numbered subjects
9. Cross-set consistency and equal visual weight
10. Style-specific and global exclusions

## Batching

Keep one to twenty subjects in a batch. Use short concrete nouns or noun phrases. A batch should share similar semantic and geometric complexity; avoid mixing a simple dot indicator with a detailed street scene. Require exactly one separated icon per subject and a common optical baseline.

## References

Use references only with appropriate rights. Describe reusable high-level properties such as view angle, material family, color roles, edge treatment, shadow direction, object coverage, or detail density. Do not name a third-party preset as the desired output and do not reproduce its prompt, logo, character, branded silhouette, or composition exactly.

## Revisions

Change one named problem at a time while retaining all other preset fields. Example:

```text
Keep the same 棉花糖软陶 style, palette roles, camera, lighting, scale, and shadow. Simplify only the notification bell silhouette so it remains readable at 48 px.
```

Review silhouette first, then subject accuracy, consistency, material, color roles, and fine detail. Rerun only outliers when the image model supports isolated revision.
