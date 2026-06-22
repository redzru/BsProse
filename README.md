# BsProse

A tiny (~1 file, no build step, no dependencies) **WYSIWYG content editor for Bootstrap 5 sites**.

It is built to do one thing that mainstream editors get wrong: **let you write rich prose *and* drop in
native Bootstrap components (alerts, cards, accordions, grids, carousels…) that survive editing without
being silently mangled.**

```js
const ed = BsProse.create('#editor', {
  value: document.querySelector('#body').value,
  image: { sources: [ BsProse.imageUrl() ] },
  onChange: html => { document.querySelector('#body').value = html; }
});
```

---

## Table of contents

1. [Why it exists](#1-why-it-exists)
2. [Core concept: the DOM is the document](#2-core-concept-the-dom-is-the-document)
3. [Requirements & install](#3-requirements--install)
4. [Quick start](#4-quick-start)
5. [Configuration reference](#5-configuration-reference)
6. [Instance API](#6-instance-api)
7. [Images: the pluggable source system](#7-images-the-pluggable-source-system)
8. [Components: the catalog](#8-components-the-catalog)
9. [Block islands explained](#9-block-islands-explained)
10. [Serialization & cleanup rules](#10-serialization--cleanup-rules)
11. [Rendering the output on your public site](#11-rendering-the-output-on-your-public-site)
12. [Integration recipes](#12-integration-recipes)
13. [The PHP upload plugin](#13-the-php-upload-plugin)
14. [Forward-compatibility with new Bootstrap versions](#14-forward-compatibility-with-new-bootstrap-versions)
15. [Browser support, accessibility, limitations](#15-browser-support-accessibility-limitations)
16. [FAQ](#16-faq)

---

## 1. Why it exists

Classic rich-text editors (Quill, TinyMCE, CKEditor…) keep their **own document model** (Quill calls it a
*Delta*). When you edit, the editor serializes that model to HTML; when it loads HTML, it re-parses it back
**through a registry of known formats**. Anything the registry doesn't recognize is dropped.

For a plain blog that is fine. For a **Bootstrap marketing/docs site** it is fatal: the moment you toggle
between visual and HTML modes — or simply reload a draft — your `.alert`, `.card`, `.accordion`, `.row`/`.col`
layout, `.list-group`, `.btn-group`, `<section>` bands, etc. are **stripped or flattened**, because they are
not "formats" the editor knows about. Authors learn to never touch the visual mode, which defeats the point.

BsProse removes the model entirely.

## 2. Core concept: the DOM is the document

There is **no intermediate model**. The editable area *is* the document:

* **Prose** (headings, paragraphs, lists, links, bold/italic/underline, text/background colours, alignment,
  inline images) is edited natively inside a single `contenteditable` surface.
* **Line breaks, not paragraph soup.** The default block format is **Text**: pressing <kbd>Enter</kbd> inserts a
  `<br>` (press twice for `<br><br>`), and content is *not* wrapped in `<p>`. You opt into paragraphs/headings
  via the format menu. Inside a list <kbd>Enter</kbd> makes the next item; inside a code block it inserts a newline.
* **Bootstrap components** live as **block islands** — `contenteditable="false"` wrappers around the raw
  component markup. You move / edit-as-HTML / delete them as a unit. Because nothing ever re-parses them
  through a format registry, they round-trip **byte-for-byte**, no matter how deeply nested.
* A global **HTML-source toggle** swaps the whole document between the visual surface and a raw `<textarea>`.
  Switching is loss-free in both directions because it's just `innerHTML ⇄ text`.

The only transform that ever runs is a small, conservative **cleanup on save** (see §10) — it strips editor
scaffolding and obvious junk, and never touches markup it doesn't recognize.

## 3. Requirements & install

* **Bootstrap 5 CSS** must be on the page — it is what makes components and the toolbar look right.
* **Bootstrap 5 JS bundle** (`bootstrap.bundle.min.js`) is *optional but recommended*: it powers the live
  preview of interactive components inside islands (accordion expand, carousel slide, tabs) via Bootstrap's
  data-API. The editor's own toolbar/menus/dialogs do **not** need it.
* No other dependencies. No bundler. No icon font (icons are inline SVG).

```html
<link rel="stylesheet" href="/path/to/bootstrap.min.css">
<!-- your editable mount point -->
<div id="editor"></div>
<!-- a hidden field you persist -->
<textarea id="body" hidden></textarea>

<script src="/path/to/bootstrap.bundle.min.js"></script>
<script src="/path/to/bsprose.js"></script>
```

`bsprose.js` injects ~30 lines of CSS once (id `bsprose-css`) using Bootstrap CSS variables, so it follows
the active theme (including dark mode). You don't ship a separate stylesheet.

## 4. Quick start

```html
<div id="editor"></div>
<textarea id="body" hidden></textarea>

<script src="/lib/bootstrap/js/bootstrap.bundle.min.js"></script>
<script src="/lib/bsprose/bsprose.js"></script>
<script>
  const field = document.getElementById('body');
  const ed = BsProse.create('#editor', {
    value: field.value,                       // initial HTML
    placeholder: 'Write your page…',
    image: { sources: [ BsProse.imageUrl() ] },
    onChange(html) { field.value = html; }    // keep your hidden field in sync
  });
</script>
```

That's a complete editor: format menu, bold/italic/underline, text & background colours, alignment/float,
links, lists, the full Bootstrap component palette, a grid builder, video embed, "insert image by URL", and
an HTML-source toggle.

## 5. Configuration reference

`BsProse.create(host, options)` — `host` is a CSS selector or an element. Options:

| Option         | Type                       | Default                     | Meaning |
|----------------|----------------------------|-----------------------------|---------|
| `value`        | `string`                   | `''`                        | Initial HTML loaded into the editor. |
| `onChange`     | `(html) => void`           | —                           | Called (debounced ~120ms) whenever content changes. `html` is the cleaned output. |
| `placeholder`  | `string`                   | `'Start writing…'`          | Shown when the surface is empty. |
| `toolbar`      | `string[]`                 | see below                   | Ordered list of toolbar tokens. `'|'` is a separator. |
| `components`   | `Component[]`              | `BsProse.components`        | The insert-component palette. `[]` hides the button. See §8. |
| `image`        | `{ sources: Source[] }`    | `undefined`                 | Image insertion sources. Omitted/empty hides the image button. See §7. |
| `grid`         | `boolean`                  | `true`                      | Show the grid builder (insert) + the per-island "Edit grid" tool. See §8. |
| `embed`        | `boolean`                  | `true`                      | Show the "Embed video" button (responsive `ratio` iframe). |
| `toolbarSize`  | `'sm' \| 'md' \| 'lg'`     | `'md'`                      | Toolbar control size. |
| `historyLimit` | `number`                   | `120`                       | Max undo/redo snapshots kept. |
| `sourceToggle` | `boolean`                  | `true`                      | Show the HTML-source toggle (always pinned to the far right, labelled **HTML**). |

**Default toolbar tokens:**
```
['format','|','bold','italic','underline','color','bgcolor','|','align','link','|','bullet','number','|','image','embed','component','grid','|','clean']
```
Available tokens:
- `format` — text style dropdown: **Text** (default — `<br>` line breaks) / Paragraph / Heading / Subheading / Small heading / Quote / Code block.
- `bold`, `italic`, `underline` — inline marks (tag-based `<b>/<i>/<u>`).
- `color` — text colour swatches (`text-primary` … `text-muted`) + remove.
- `bgcolor` — background colour swatches (`text-bg-primary` … `text-bg-dark`) + remove.
- `align` — alignment & float dropdown: text align (`text-start/center/end/justify`, applied to the block) and float (`float-start/end/none`, applied to the selected image or component).
- `link` — link dialog (URL, optional colour `link-*`, open-in-new-tab, multi-select `rel`). Clicking it while
  the caret is inside an existing link **edits** that link (its attributes prefill the dialog) instead of nesting a new one.
- `bullet`, `number` — lists.
- `image` — image sources (see §7).
- `embed` — embed a video by URL into a responsive `ratio` box.
- `component` — Bootstrap component palette (see §8).
- `grid` — visual grid builder (see §8).
- `clean` — remove inline formatting.
- `|` — separator.

The HTML-source toggle is **not** a positional token — when `sourceToggle` is on it is always rendered last,
pinned right, labelled **HTML**. Tokens whose feature is unconfigured (e.g. `image` with no sources, or
`grid`/`embed`/`component` disabled) are skipped automatically. Reorder or trim the array to taste — e.g. a
minimal toolbar:
```js
toolbar: ['format','bold','italic','color','link','bullet','number','|','image']
```

## 6. Instance API

The object returned by `BsProse.create(...)`:

| Method                     | Returns   | Description |
|----------------------------|-----------|-------------|
| `getHTML()`                | `string`  | The cleaned, serialized HTML (same value passed to `onChange`). |
| `setHTML(html)`            | `void`    | Replace the document. Re-parses top-level blocks into prose / islands. |
| `focus()`                  | `void`    | Focus the editing surface. |
| `isSourceMode()`           | `boolean` | Whether the raw HTML view is active. |
| `setSourceMode(on)`        | `void`    | Programmatically switch between visual and source. |
| `insertComponent(html)`    | `void`    | Insert a component island from a raw HTML template (supports `{{id}}` tokens). |
| `insertImage(spec)`        | `void`    | Insert a responsive `<img>` from an [image spec](#image-spec). |
| `undo()` / `redo()`        | `void`    | Step through the editor's own history (also bound to Ctrl/Cmd+Z and Ctrl/Cmd+Y / Shift+Z). |
| `on(event, fn)`            | `this`    | Subscribe. Currently the only event is `'change'`. |
| `destroy()`                | `void`    | Tear down and empty the host element. |

```js
ed.on('change', html => save(html));
ed.setHTML('<h2>New</h2><div class="alert alert-info">Hi</div>');
const out = ed.getHTML();
```

## 7. Images: the pluggable source system

Image insertion is **fully decoupled** from the toolbar. You declare an array of *sources*; the editor's
"image" button opens them. With one source it opens directly; with several it shows a small chooser first.

```js
image: {
  sources: [
    BsProse.imageUrl(),                                  // 1. type a URL
    BsProse.imageUpload({ endpoint: '/lib/bsprose/upload.php' }), // 2. upload a file
    {                                                    // 3. your own gallery / DAM
      id: 'gallery', label: 'Media library',
      open(api) { openMyPicker(spec => api.insert(spec)); }
    }
  ]
}
```

Use one, two, or all three. Mix and match per project.

### Built-in source factories

**`BsProse.imageUrl(cfg?)`** — a dialog asking for a URL + alt text. Zero backend. Config: `label`, `title`,
`imgClass` (default `'img-fluid'`).

**`BsProse.imageUpload(cfg)`** — a dialog with a file picker that uploads, then inserts the result.
Config:

| Field       | Default     | Meaning |
|-------------|-------------|---------|
| `endpoint`  | —           | URL to POST the file to (used by the default transport). |
| `fieldName` | `'file'`    | multipart field name. |
| `fields`    | `{}`        | extra multipart fields appended to every upload (e.g. a CSRF token). |
| `headers`   | `{}`        | extra request headers. |
| `accept`    | `'image/*'` | file input accept filter. |
| `map`       | —           | `(json) => imgSpec` to adapt your endpoint's JSON to an [image spec](#image-spec). |
| `send`      | —           | **Full transport override:** `(file) => Promise<imgSpec>`. Use your app's ajax layer (CSRF, etc.). When set, `endpoint`/`fields`/`headers`/`map` are ignored. |

```js
// Use your framework's CSRF-aware POST instead of a bare fetch:
BsProse.imageUpload({
  send: file => MyApp.post('/upload', { file }).then(r => ({ src: r.url, width: r.w, height: r.h }))
});
```

### Custom sources

A source is just `{ id, label, open(api) }`. Inside `open`, do whatever UI you want, then call
`api.insert(spec)` with an [image spec](#image-spec). This is how you wire an existing media library / DAM /
S3 browser.

### <a id="image-spec"></a>Image spec

Every source ultimately resolves an object the editor turns into a responsive `<img>`:

```ts
{
  src:    string,   // required (the default / largest)
  srcset?: string,  // e.g. "/a-480.webp 480w, /a-960.webp 960w"   (browser-optimised <img>)
  sizes?:  string,  // e.g. "(max-width: 960px) 100vw, 960px"
  sources?: Array<{ media?: string, type?: string, srcset: string, sizes?: string }>,  // → <picture>
  alt?:    string,
  width?:  number,
  height?: number,
  class?:  string   // default "img-fluid"
}
```

Produces a plain responsive image:
```html
<img src="…" srcset="…" sizes="…" width="…" height="…" loading="lazy" decoding="async" alt="…" class="img-fluid">
```

…**unless** `sources` is given, in which case it produces a `<picture>` (and the `<img>` drops `srcset`/`sizes`
and acts as the default/fallback):
```html
<picture><source media="(max-width: 575.98px)" srcset="…-480.webp"><source media="(max-width: 1199.98px)" srcset="…-960.webp"><img src="…-1440.webp" …></picture>
```

> **`<img srcset>` vs `<picture media>`.** `<img srcset sizes>` is a *hint* — the browser picks a candidate by
> the rendered size **× device-pixel-ratio**, and once it has loaded a larger file it won't downsize when the
> window shrinks. On a HiDPI/Retina screen that means a content image in a ~720px column legitimately loads the
> largest variant. `<picture>` with `media` rules is a *hard, viewport-driven* switch, re-evaluated on resize
> (narrower window → smaller file), ignoring DPR — which is usually what an author expects. Pass `sources` to
> get that behaviour; pass only `srcset` for the DPR-aware default.

> **Path tip.** If your stored paths are site-relative but the editor runs on a different host (e.g. an admin
> panel previewing a public CDN), convert paths to **absolute** in your source/`map` (so previews load) and
> back to **relative** in `onChange` before persisting. The editor itself is path-agnostic — it inserts and
> serializes exactly what you give it.

## 8. Components: the catalog

The component palette is a plain array. The default catalog (`BsProse.components`) covers the Bootstrap
elements that make sense as **page content**:

| Group     | Items |
|-----------|-------|
| Content   | Alert, Callout, Card, Accordion, List group, Table |
| Layout    | Card grid · 3, Hero / CTA band |
| Inline    | Buttons, Button group, Badges |
| Advanced  | Carousel, Tabs, Progress |

Each component is:
```ts
{ id: string, group: string, label: string, html: string }
```
`html` is an **opaque template**. Any `{{id}}` token in it is replaced with a unique id on every insert, so
two accordions / carousels / tab sets never collide. The engine never inspects the classes — it just inserts
the markup as an island.

**Customize:** pass your own array (replace or extend the default).

```js
components: [
  ...BsProse.components,                         // keep the defaults
  { id: 'pricing', group: 'Marketing', label: 'Pricing table', html: '<div class="row …">…</div>' }
]
```

### Grid builder (`grid` token)

Plain `row`/`col` grids have a dedicated visual builder instead of a fixed template, so columns aren't an
opaque blob. The **grid** toolbar button opens it to *create* a grid; selecting a grid island reveals an
**Edit grid** tool that reopens the builder *pre-filled* from the existing markup. You set:

- **breakpoint** at which columns line up (always / ≥sm … ≥xxl → `col` vs `col-md-*`),
- **gutter** (`g-0` … `g-5`) and **vertical alignment** (`align-items-*`),
- per column: **width** (equal / auto / 1–12), **content** (HTML), plus add / remove / reorder.

It outputs ordinary `<div class="row …"><div class="col-…">…</div></div>` as an island. Disable with `grid: false`.

### Video embed (`embed` token)

The **embed** button asks for a video URL + aspect ratio (1:1 / 4:3 / 16:9 / 21:9) + a title, and inserts a
responsive `<div class="ratio ratio-16x9"><iframe …></div>` island. YouTube (watch / `youtu.be` / `embed` /
`shorts` / `live`) and Vimeo links are converted to their embed URLs automatically; any other URL is used as
the iframe `src` verbatim. The iframe carries `referrerpolicy="strict-origin-when-cross-origin"` so the player
still receives a referrer when the host page/server strips it (e.g. a `Referrer-Policy: same-origin` response
header — otherwise YouTube fails with a "configuration error", *error 153*). Any iframe loaded **without** a
`referrerpolicy` (e.g. a video embedded before this was added) is healed with the same attribute on load.
Disable the button with `embed: false`.

### What is *not* an island: colours, alignment, links

Text colour (`text-*`), background colour (`text-bg-*`), alignment (`text-*`) and links are **inline prose
formatting**, applied to the current selection/block — not components. To recolour a Bootstrap *component*
(e.g. switch an alert from `alert-info` to `alert-danger`, or a button variant), select the island and use its
**Edit HTML** tool, or — for grids — **Edit grid**.

> Why these and not *all* Bootstrap components? Navigation/overlay/stateful widgets (navbar, breadcrumb,
> pagination, modal, toast, offcanvas, dropdown, spinner, placeholder, scrollspy) are page *chrome* or runtime
> states, not article content. Tooltips/popovers are excluded because they require an explicit JS init
> (`new bootstrap.Tooltip(...)`) that a static content page usually doesn't run. Add any of them yourself if
> your site does support them.

## 9. Block islands explained

When `setHTML` loads content, each **top-level** node is classified:

* **Inline flow** — text nodes and inline elements (`a, br, span, strong, em, b, i, u, img, code, sub, sup,
  small, …`) stay in the prose flow and are edited natively. They are **never** islands, so a sentence with an
  inline `<a>` link, or several consecutive `<br>`, stays a single continuous run.
* **Block prose** — `p, h1–h6, ul, ol, blockquote, pre, hr, figure, dl` *without* a Bootstrap-component class →
  editable block.
* **Island** — every other (block) element (`div`, `section`, `table`, …) **or** a prose tag carrying a
  component class (e.g. `<ul class="list-group">`) → wrapped in a `contenteditable="false"` island.

An island shows a hover toolbar: **move up**, **move down**, **edit HTML** (opens the raw markup of just that
block in a dialog), **delete** — plus **edit grid** when its root is a `.row` (opens the §8 grid builder). The
component's own interactive behavior (accordion, carousel, tabs, video) works live in the editor if the
Bootstrap JS bundle is present.

This is the key durability guarantee: **you cannot accidentally corrupt a component by typing**, and the
serializer passes island markup through untouched.

**Caret gaps.** Two adjacent islands (or an island at the very start/end) would leave nowhere to click to type
between them. The editor keeps an empty editable paragraph in those gaps — a pure editing affordance that
`getHTML` drops and `setHTML` re-creates, so you can always place the caret and write between sections; once
you type there, the text is kept.

## 10. Serialization & cleanup rules

`getHTML()` (and `onChange`) returns clean output. In **visual mode** it:

1. Unwraps every island back to its original component HTML (the island wrapper + toolbar are discarded).
2. Removes editor-only attributes everywhere: `contenteditable`, `spellcheck`, any `data-bsp*`, legacy `data-list`.
3. Unwraps attribute-less `<span>` left behind when a colour is removed.
4. Drops empty paragraphs and Quill-style `<p><br></p>` noise (paragraphs containing media are kept).
5. Normalizes whitespace lightly (collapses `&nbsp;` runs, trims). Content that is only `<br>`/whitespace
   serializes to an empty string.

**Line breaks:** the default is soft `<br>` (and `<br><br>`) at the surface level — content is **not** wrapped
in `<p>` unless you choose the Paragraph format, and loose text is loaded back the same way (no auto-`<p>`).
Lists come out as semantic `<ul>/<ol>` with plain `<li>` (no `data-*`). Bold/italic/underline use tag-based
marks (`<b>/<i>/<u>`), not inline styles (the editor sets `styleWithCSS=false`). Text colour and background
share **one** `<span>` — applying both yields `<span class="text-bg-primary text-success">` (never nested
spans); "Remove colour" strips just that group and unwraps the span when no colour class remains (any
pre-existing nested colour spans are flattened on the next colour edit). Alignment is a `text-…` class on the
block (choosing alignment on bare text wraps that line in a `<p>` first, since alignment needs a block).

In **source mode**, `getHTML()` returns the textarea contents verbatim (trimmed) — your hand-written markup is
the source of truth, nothing is reinterpreted.

> The cleanup is deliberately conservative. It strips scaffolding and obvious junk, and otherwise leaves your
> markup alone — including any class, attribute, or nesting it doesn't understand.

## 11. Rendering the output on your public site

The output is ordinary, trusted HTML. Render it raw inside a container and load Bootstrap:

```html
<link rel="stylesheet" href="/bootstrap.min.css">
<div class="your-prose">
  <?= $bodyHtml ?>   <!-- echo it unescaped; it's authored by trusted admins -->
</div>
<script src="/bootstrap.bundle.min.js"></script>  <!-- for accordion/carousel/tabs -->
```

Because the markup is just HTML + Bootstrap classes (no inline `<script>`), it is safe through HTML/JS
minifiers that protect `<pre>/<textarea>/<script>/<style>` and collapse inter-tag whitespace.

If your content can contain untrusted input, sanitize server-side before output — BsProse does not sanitize
on behalf of untrusted authors.

## 12. Integration recipes

### Plain site, URL images only
```js
BsProse.create('#editor', {
  value: field.value,
  image: { sources: [ BsProse.imageUrl() ] },
  onChange: h => field.value = h
});
```

### With the bundled PHP uploader
```js
BsProse.create('#editor', {
  image: { sources: [
    BsProse.imageUrl(),
    BsProse.imageUpload({ endpoint: '/lib/bsprose/upload.php' })
  ]},
  onChange: h => field.value = h
});
```

### With a CSRF-aware ajax layer + an existing media library (the REDZ.BUILD setup)
```js
const toAbs = h => h.split('/assets/media/').join(MEDIA_BASE + '/assets/media/');
const toRel = h => h.split(MEDIA_BASE + '/assets/media/').join('/assets/media/');

const gallery = { id:'gallery', label:'Media library', open(api){
  openMediaPickModal(m => api.insert({                    // m = a picked library item
    src: toAbs(m.src), srcset: toAbs(m.srcset), sizes: m.sizes,
    alt: m.alt, width: m.width, height: m.height, class:'img-fluid rounded'
  }));
}};

const upload = BsProse.imageUpload({
  send: file => RZ.post('/site/ajax.Media.php', { ACTION:'upload', file })
    .then(r => r.ok ? { src:toAbs(r.src), srcset:toAbs(r.srcset), sizes:r.sizes,
                        width:r.width, height:r.height, alt:r.alt, class:'img-fluid rounded' }
                    : { error:r.error });
});

const ed = BsProse.create('#editor', {
  value: toAbs(field.value),
  image: { sources: [ gallery, upload, BsProse.imageUrl() ] },
  onChange: h => field.value = toRel(h)        // store relative paths
});
```

## 13. The PHP upload plugin

`upload.php` (next to `bsprose.js`) is a **framework-free reference endpoint** for `BsProse.imageUpload`.
It validates a multipart file, stores it, and returns JSON:

```json
{ "ok": true, "src": "/uploads/ab12.jpg", "width": 1200, "height": 800, "class": "img-fluid" }
```

Set `$CONFIG['responsive'] = true` to emit resized **WebP variants** via GD and return a `srcset`/`sizes`
ready for responsive `<img>`.

⚠️ **It ships with NO authentication.** Add your auth/CSRF check in the marked block before exposing it, or
point `imageUpload` at your own protected endpoint via `send`. (On REDZ.BUILD the admin editor uses the
CSRF-guarded `/site/ajax.Media.php` instead, and this file is kept only as a portable example.)

Config block (top of the file): `dir`, `url`, `field`, `max_bytes`, `allowed`, `responsive`, `widths`,
`quality`.

## 14. Forward-compatibility with new Bootstrap versions

The engine **never reads a Bootstrap class**. Components are opaque HTML templates supplied via config, and
islands are preserved verbatim. So adapting to a new major Bootstrap is just:

1. Update the `components` templates to the new markup.
2. Update the `COMPONENT_CLASS_RE` in `bsprose.js` only if a component's wrapper class name changed (it's the
   regex used to recognize component blocks on load).
3. Swap the Bootstrap CSS/JS on the page.

No editor-core changes. Existing stored content keeps working because unknown markup always round-trips.

## 15. Browser support, accessibility, limitations

* **Browsers:** current Chrome, Firefox, Safari, Edge. Uses `contenteditable` + `document.execCommand` for
  inline formatting. `execCommand` is deprecated-but-universally-functional; the *output* is guaranteed clean
  by our own serializer regardless of what `execCommand` emits.
* **Accessibility:** toolbar buttons have `aria-label`/`title`; the surface is a standard editable region.
* **Limitations / by design:**
  * Editing the *text/markup inside* a component is done via its island's **Edit HTML** dialog (or **Edit
    grid** for `.row`s), not inline — this is the trade-off that makes components corruption-proof.
  * Colours, alignment and link styling apply to **prose** selections; to restyle a component's colour, edit
    the island.
  * Choosing an alignment on bare "Text" content wraps that line in a `<p>` (alignment needs a block element).
  * Line breaks default to `<br>`; press <kbd>Enter</kbd> in the Paragraph format and you still get a `<br>`
    inside that paragraph — separate paragraphs are made by formatting each block, not by hitting Enter.
  * Undo/redo is a snapshot history (Ctrl/Cmd+Z, Ctrl/Cmd+Y or Shift+Z), capped at `historyLimit` steps; it
    restores content but does not restore the exact caret position. In HTML-source mode the `<textarea>`'s
    native undo applies instead.
  * Not a sanitizer for untrusted input — intended for trusted authors/admins.
  * One editor instance per host element.

## 16. FAQ

**Does it depend on jQuery / React / a bundler?** No. Plain ES5-compatible vanilla JS, one global `BsProse`.

**Can I use it without the Bootstrap JS bundle?** Yes — the editor works fully. You only lose *live* preview
of interactive components (accordion / carousel / tabs / video) inside the editor; they still render and work
on your public page if it loads the bundle. (The toolbar's own menus/dialogs never need the bundle.)

**How do I localize the UI?** Reorder/trim `toolbar`, and pass your own `components` with translated `label`s.
Dialog button text for image sources comes from each source's `label`/`title` config.

**Why are my pasted styles gone?** Paste is sanitized to clean prose (structural tags only, attributes
stripped except `href`). Use the component palette or HTML-source mode for rich Bootstrap markup.

**It inserted my component but the accordion won't open in the editor.** Load `bootstrap.bundle.min.js` on the
page — the accordion uses Bootstrap's data-API.

---

MIT licensed. Self-contained. Copy `bsprose.js` (and optionally `upload.php`) into any Bootstrap project.
