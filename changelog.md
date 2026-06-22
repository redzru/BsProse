# BsProse — Changelog

All notable changes to **bsprose.js**. Versions are BsProse's own and independent of any host
application's versioning. Listed newest → oldest.


## 1.2.4 — Headings & responsive images
- Format menu offers explicit **Heading 1–5** (`formatBlock` replaces the block tag, so h1→h2 changes the
  heading rather than duplicating it).
- Inserted images use **`<picture>`** with viewport `media` sources when the image spec carries `sources` — a
  narrower viewport loads a smaller file, re-evaluated on resize (deterministic), with the largest variant as
  the `<img>` default. `_imgHtml` builds `<picture>` when `spec.sources` is present; otherwise a plain
  responsive `<img srcset sizes>`. (A plain `<img srcset>` is DPR-driven and never downsizes once cached, which
  on HiDPI screens looks like "always loads the largest" — `<picture media>` is the predictable alternative.)

## 1.2.3 — Single-span colours
- Text colour and background share **one** `<span>` (`text-bg-* text-*`) instead of nesting spans.
  "Remove colour" strips only its own group and unwraps the span when no colour class remains; any
  pre-existing nested colour spans are flattened on edit.

## 1.2.2 — Island classification fix
- Top-level **inline** nodes (`a`, `br`, `span`, `strong`, `img`, `picture`, …) stay in the prose flow and are
  never turned into islands. Previously every non-prose-block element became an island, so loose inline content
  — a sentence containing an inline `<a>`, or several consecutive `<br>` — was split into separate blocks (with
  large gaps from separator paragraphs). Islands now = block non-prose elements, or a prose block carrying a
  component class.

## 1.2.1 — Robustness (browser-verified)
- Edit-existing-link works even when the whole link is selected (robust anchor detection across
  start / end / commonAncestor + boundary child).
- Editable paragraph separators are auto-kept between and around adjacent islands, so you can type **between
  sections** (dropped on serialize, re-created on load).
- **YouTube "configuration error" (error 153)** fixed: it is caused by the host page/server sending no
  referrer (e.g. `Referrer-Policy: same-origin`). The iframe now carries `referrerpolicy`, and iframes loaded
  without one are healed on load.

## 1.2.0 — Undo/redo, link & embed fixes
- **Undo/redo** as an internal snapshot stack (Ctrl/Cmd+Z, Ctrl/Cmd+Y or Shift+Z) — native contenteditable
  undo is unreliable once the DOM is mutated directly (islands, colours, grids).
- Link dialog builds the `<a>` directly, so target / rel / colour are applied reliably; clicking the link tool
  while the caret is inside an existing link now **edits** it (prefilled) instead of nesting a new anchor.
- Embed iframe gains `referrerpolicy="strict-origin-when-cross-origin"`; URL parser also handles
  `youtu.be`, `shorts` and `live` links.

## 1.1.0 — Formatting & authoring features
- **Text colour** (`text-*`) and **background colour** (`text-bg-*`) swatch dropdowns.
- **Alignment** (`text-start/center/end/justify`) and **float** (`float-start/end/none`).
- **Link dialog**: optional colour (`link-*`), open-in-new-tab (`target="_blank"`), multi-select `rel`.
- **Grid builder** dialog — create and edit `row`/`col` grids (column count, width, breakpoint, gutter, valign).
- **Embed video** — URL → responsive `<div class="ratio"><iframe>`; YouTube and Vimeo recognised.
- `toolbarSize` option (`sm` / `md` / `lg`); the HTML-source button is pinned to the far right, labelled "HTML".
- **Default block is "Text"**: Enter inserts `<br>` (twice → `<br><br>`), with no automatic `<p>` wrapping —
  paragraphs / headings / quote / code are opt-in via the format menu.

## 1.0.0 — Initial release
- Standalone, dependency-free Bootstrap 5 WYSIWYG content editor — one global `window.BsProse`, no build step.
- **The DOM is the document**: no Delta / format-registry, so unknown markup is never stripped (the reason it
  replaces registry-based editors that erase Bootstrap components on visual↔source round-trips).
- Prose edited natively in a single `contenteditable`. Bootstrap components live as **block islands**
  (`contenteditable=false`) with hover tools (move ↑/↓, edit-HTML, delete) and round-trip byte-for-byte.
- Global **HTML-source toggle**. Clean semantic serializer (drops `<p><br></p>` noise, semantic `<ul>/<ol>`,
  strips all editor scaffolding/attributes).
- **Component palette** (Content / Layout / Inline / Advanced); `{{id}}` tokens become a unique id on every
  insert so accordions/carousels/tabs never collide.
- **Pluggable image sources**: `BsProse.imageUrl()`, `BsProse.imageUpload({ send | endpoint })`, and custom
  `{ open(api) }` providers — use one or several (a chooser is shown when more than one).
- Paste sanitiser (keeps structural prose tags, drops attributes/styles).
- Ships with `upload.php` (framework-free reference upload endpoint, optional WebP variants) and `README.md`.