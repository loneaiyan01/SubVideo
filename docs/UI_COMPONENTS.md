# UI Component Inventory

> Auto-generated documentation for shadcn/ui components installed in this project.

## Configuration

| Setting | Value |
|---|---|
| **Style** | `base-nova` |
| **Framework** | React Server Components (`rsc: true`) |
| **Icon Library** | Lucide |
| **Base Color** | Neutral |
| **CSS Variables** | Enabled |
| **Config file** | [`components.json`](../../components.json) |
| **CSS** | [`src/app/globals.css`](../../src/app/globals.css) |

## Installed Components

| Component | File | Used In |
|---|---|---|
| **Button** | `src/components/ui/button.tsx` | `export-panel`, `batch-panel`, `upload-zone`, `subtitle-editor` |
| **Card** | `src/components/ui/card.tsx` | — (available but unused) |
| **Input** | `src/components/ui/input.tsx` | `style-controls` |
| **Label** | `src/components/ui/label.tsx` | `style-controls` |
| **Separator** | `src/components/ui/separator.tsx` | — (available but unused) |
| **Slider** | `src/components/ui/slider.tsx` | `style-controls`, `subtitle-editor` |
| **Switch** | `src/components/ui/switch.tsx` | `style-controls` |
| **Tabs** | `src/components/ui/tabs.tsx` | `page.tsx`, `upload-zone` |
| **Textarea** | `src/components/ui/textarea.tsx` | `upload-zone` |

## Adding New Components

```bash
npx shadcn@latest add <component-name>
```

## Important Notes

- These components are **auto-generated** by the shadcn CLI — avoid manual modifications.
- If customization is needed, extend via wrapper components rather than editing the `ui/` files directly.
- The project uses Tailwind CSS v4 with CSS variables for theming (see `globals.css`).
