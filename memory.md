# BsProse — maintainer notes

Internal/design knowledge for maintaining and extending **bsprose.js**. Public usage + full API → `README.md`.
Version history → `changelog.md`. BsProse versions are independent of any host application.

## What it is / why
A standalone, dependency-free Bootstrap 5 WYSIWYG content editor. The defining decision: **the DOM is the
document** — there is NO intermediate model (no Delta, no format registry). Registry-based editors re-parse
HTML through a set of known formats and silently drop everything else, which destroys Bootstrap components on
visual↔source round-trips. BsProse edits the DOM directly and serialises it, so arbitrary/unknown markup
survives byte-for-byte.

## Core model
- One `contenteditable` "surface". `getHTML()` clones it, unwraps islands, strips editor scaffolding and
  lightly tidies → clean semantic HTML. `setHTML()` parses HTML and rebuilds the surface.
- **Block islands**: each Bootstrap component is wrapped in a `contenteditable=false` island
  (`[data-bsp-island]`) with a hover toolbar; the component markup lives in `.bsprose-island-body` and
  round-trips verbatim. This is what makes components corruption-proof — you cannot break one by typing.
- **Classification on load** (`isIslandEl`): `INLINE_TAGS` → prose flow (NEVER islands); `PROSE_TAGS`
  (`p/h1–6/ul/ol/blockquote/pre/hr/figure/dl`) → editable block unless carrying a component class; everything
  else (`div/section/table/…`) → island. Getting this wrong splits inline content (links, `<br>`) into
  separate blocks — keep `INLINE_TAGS` complete.
- **Line breaks**: default is `<br>` (Enter → `insertLineBreak`; `<br><br>` on double Enter). No auto-`<p>`;
  blocks are opt-in via the format menu. `setHTML` must not wrap loose text in `<p>`.
- **Undo/redo**: an internal stack of `getHTML()` snapshots; restore via `setHTML()` (which rebuilds islands
  with fresh handlers). Native contenteditable undo is unreliable once we mutate the DOM directly.

## Selection invariants (the #1 source of bugs)
- Toolbar controls call `e.preventDefault()` on **mousedown** so focus/selection stays in the surface; the
  click handler then runs the command. Without this the selection collapses before the command runs.
- Commands snapshot the saved range before `focus()` and restore it, because focusing can fire an async
  `selectionchange` that clobbers the saved range.
- In automated tests, drive the toolbar with REAL input events (e.g. CDP / puppeteer clicks). Synthetic
  `dispatchEvent` is not "trusted", so `preventDefault` does not suppress the focus change and the selection
  collapses — making colour/inline commands appear broken when the code is actually fine.

## Colours
Text colour and background share ONE `<span>` (`text-bg-* text-*`). `_applyInline` merges the colour stack into
a single span instead of nesting, swaps the relevant group, and unwraps the span when empty — so "Remove
colour" works and any pre-existing nested colour spans get flattened on edit.

## Images
`_imgHtml` renders a `<picture>` when the image spec carries `sources` (an array of `{media, srcset, type?}`),
otherwise a plain `<img srcset sizes>`. Rationale: `<img srcset>` is a browser *hint* — DPR-driven and never
downsized once cached — so on HiDPI screens it appears to "always load the largest". `<picture>` with `media`
rules is a deterministic, viewport-driven switch re-evaluated on resize. The library stays policy-agnostic:
the host decides the breakpoints and builds `sources`; the engine just renders what it is given.

## Pluggable image sources
`image.sources[]`: built-ins `BsProse.imageUrl()` and `BsProse.imageUpload({ send | endpoint, map, … })`, plus
custom `{ id, label, open(api) }` providers that call `api.insert(spec)`. With more than one source the editor
shows a chooser. The image spec is `{ src, srcset?, sizes?, sources?, alt?, title?, width?, height?, class? }`.

## Gotchas / host integration
- Peer dependency: Bootstrap 5 CSS (always) + the JS bundle (only for live preview of interactive islands —
  accordion / carousel / tabs / video — via the data-API). The editor's own menus and dialogs need neither.
- A host page or server that strips the referrer (e.g. `Referrer-Policy: same-origin`) makes embedded
  YouTube/Vimeo players throw a configuration error ("error 153"); fixed by `referrerpolicy` on the iframe
  (applied to new embeds and healed on load).
- `{{id}}` tokens in component templates become a unique id per insert — required for components that
  reference ids (accordion / carousel / tabs).
- If the host stores media paths relative but renders the editor on a different host, convert paths to
  absolute before `setHTML`/insert and back to relative in `onChange` (the editor itself is path-agnostic).

## Extending
- New component → add it to the `components` config (an opaque HTML template; use `{{id}}` if it needs unique ids).
- New Bootstrap major → update the component templates + `COMPONENT_CLASS_RE`; the engine reads no Bootstrap
  class itself, so the core is untouched.
- New inline format → reuse `_applyInline` (with a group regex) for span-class formats, or `formatBlock` for
  block-level formats.

## Testing
Drive a real browser (e.g. `puppeteer-core` + a local Chrome): create a `window.BsProse` instance, exercise
the toolbar with trusted clicks + keyboard, and assert on `getHTML()`. Cover: the `<br>` line-break model,
inline marks, colours (merge + remove), alignment, lists, headings (replace not duplicate), links (create +
edit), typing between islands, undo/redo, component / grid / embed insert, source toggle, and clean
serialization (no scaffolding leaks).
