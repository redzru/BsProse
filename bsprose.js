// noinspection ES6ConvertVarToLetConst, JSUnusedGlobalSymbols, JSUnresolvedReference, JSDeprecatedSymbols, JSCheckFunctionSignatures, JSValidateTypes, GrazieInspection, SpellCheckingInspection, JSUnusedLocalSymbols

/*!
 * BsProse — a tiny, dependency-free WYSIWYG content editor for Bootstrap 5 sites.
 * ---------------------------------------------------------------------------
 * Why it exists: classic rich-text editors (Quill, TinyMCE, …) keep their own
 * document model and RE-PARSE the HTML through a format registry, so any markup
 * they don't recognize — Bootstrap components like .alert/.card/.accordion/.row —
 * gets silently stripped on every visual<->source round-trip.
 *
 * BsProse has NO intermediate model: the DOM *is* the document. Prose (headings,
 * paragraphs, lists, links, inline marks, colors, images) is edited natively in a
 * single contenteditable surface. Bootstrap components live as "block islands"
 * (contenteditable=false wrappers) that are moved / edited-as-HTML / deleted as a
 * unit and round-trip BYTE-FOR-BYTE. A global HTML-source toggle is the escape
 * hatch. Output is clean, semantic HTML ready to drop inside `.site-prose`.
 *
 * Line breaks: the default block is "Text" — Enter inserts a <br> (press twice for
 * <br><br>); content is NOT wrapped in <p> unless you pick the Paragraph format.
 *
 * Peer dependency: Bootstrap 5 CSS (component + toolbar rendering) and, for live
 * preview of interactive components inside islands (accordion/carousel/tabs/ratio),
 * the Bootstrap JS bundle via its data-API. The engine never reads a Bootstrap
 * class, so a future Bootstrap only means updating the `components` templates.
 *
 * No build step, no framework, one global: `window.BsProse`.
 * @version 1.2.4
 * @license MIT
 */
(function (global) {
	'use strict';

	/* ───────────────────────── self-contained styles ─────────────────────────
	   Intentionally minimal — everything visual leans on Bootstrap utility classes.
	   Injected once; uses Bootstrap CSS variables so it follows the active theme. */
	var CSS = [
		'.bsprose{border:1px solid var(--bs-border-color);border-radius:var(--bs-border-radius)}',
		'.bsprose-tb{display:flex;flex-wrap:wrap;align-items:center;gap:.25rem;padding:.375rem;border-bottom:1px solid var(--bs-border-color);background:var(--bs-tertiary-bg);border-radius:var(--bs-border-radius) var(--bs-border-radius) 0 0}',
		'.bsprose-tb-sm .btn{--bs-btn-padding-y:.12rem;--bs-btn-padding-x:.4rem;--bs-btn-font-size:.78rem;line-height:1.1}',
		'.bsprose-tb-md .btn{--bs-btn-padding-y:.28rem;--bs-btn-padding-x:.58rem;--bs-btn-font-size:.9rem;line-height:1.15}',
		'.bsprose-tb-lg .btn{--bs-btn-padding-y:.45rem;--bs-btn-padding-x:.8rem;--bs-btn-font-size:1.05rem;line-height:1.2}',
		'.bsprose-sep{width:1px;align-self:stretch;background:var(--bs-border-color);margin:.1rem .15rem}',
		'.bsprose-src-btn{margin-left:auto}',
		'.bsprose-surface{position:relative;min-height:18rem;max-height:36rem;overflow:auto;padding:.75rem 1rem;outline:none}',
		'.bsprose-surface:focus-within{box-shadow:inset 0 0 0 .15rem rgba(var(--bs-primary-rgb),.15)}',
		'.bsprose-surface[data-empty]::before{content:attr(data-ph);color:var(--bs-secondary-color);pointer-events:none;position:absolute}',
		'.bsprose-island{position:relative;margin:.5rem 0;border-radius:var(--bs-border-radius)}',
		'.bsprose-island::after{content:"";position:absolute;inset:-.25rem;border:1px dashed transparent;border-radius:inherit;pointer-events:none}',
		'.bsprose-island:hover::after,.bsprose-island.bsprose-sel::after{border-color:rgba(var(--bs-primary-rgb),.6)}',
		'.bsprose-island-tools{position:absolute;top:-.85rem;right:.25rem;z-index:3;display:flex;gap:.15rem;opacity:0;transition:opacity .1s}',
		'.bsprose-island:hover .bsprose-island-tools,.bsprose-island.bsprose-sel .bsprose-island-tools{opacity:1}',
		'.bsprose-island-tools .btn{--bs-btn-padding-y:.05rem;--bs-btn-padding-x:.3rem;--bs-btn-font-size:.75rem;box-shadow:var(--bs-box-shadow-sm)}',
		'.bsprose-island-body{padding:.1rem}',
		'.bsprose-source{display:block;width:100%;min-height:18rem;max-height:36rem;border:0;border-radius:0 0 var(--bs-border-radius) var(--bs-border-radius);padding:.75rem 1rem;font-family:var(--bs-font-monospace);font-size:.85rem;resize:vertical;outline:none}',
		'.bsprose-menu{position:absolute;z-index:1080;max-height:60vh;overflow:auto;min-width:12rem}',
		'.bsprose-swatches{display:grid;grid-template-columns:repeat(5,1fr);gap:.3rem;padding:.5rem}',
		'.bsprose-swatch{width:1.6rem;height:1.6rem;border-radius:.25rem;border:1px solid var(--bs-border-color);cursor:pointer;padding:0}',
		'.bsprose-ov{position:fixed;inset:0;z-index:1090;background:rgba(0,0,0,.35);display:flex;align-items:flex-start;justify-content:center;padding:6vh 1rem 1rem}',
		'.bsprose-ov .card{max-width:38rem;width:100%;box-shadow:var(--bs-box-shadow-lg)}',
		'.bsprose-ov .card-body{max-height:72vh;overflow:auto}'
	].join('');

	function injectCss() {
		if (document.getElementById('bsprose-css')) { return; }
		var s = document.createElement('style');
		s.id = 'bsprose-css';
		s.textContent = CSS;
		document.head.appendChild(s);
	}

	/* ───────────────────────── small SVG icon set ─────────────────────────
	   Inline so there is NO icon-font dependency (works on any Bootstrap site). */
	function svg(p) { return '<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' + p + '</svg>'; }
	var ICON = {
		bold: svg('<path d="M4 2h4.5a3 3 0 0 1 .9 5.86A3.2 3.2 0 0 1 8.7 14H4zm2 2v3h2.2a1.5 1.5 0 0 0 0-3zm0 5v3h2.7a1.5 1.5 0 0 0 0-3z"/>'),
		italic: svg('<path d="M6 2h6v2h-1.9l-2.2 8H10v2H4v-2h1.9l2.2-8H6z"/>'),
		underline: svg('<path d="M4 2v5a4 4 0 0 0 8 0V2h-2v5a2 2 0 1 1-4 0V2zm-1 11h10v2H3z"/>'),
		color: svg('<path d="M4.6 11 7.2 3h1.6l2.6 8h-1.7l-.6-2H6.9l-.6 2zm2.7-3.4h1.9L8.3 4.6z"/><rect x="3" y="13" width="10" height="2" rx=".4"/>'),
		bg: svg('<path d="M2.5 2h11a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5m1.9 9.5h7.2L9.5 5h-1.4l-1.2 3.7H6.2l-1.8 2.8z" fill-opacity=".55"/>'),
		link: svg('<path d="M6.6 9.4a2 2 0 0 0 2.8 0l2-2a2 2 0 1 0-2.8-2.8l-1 1 1.1 1.1 1-1a.5.5 0 0 1 .7.7l-2 2a.5.5 0 0 1-.7 0zm2.8-2.8a2 2 0 0 0-2.8 0l-2 2a2 2 0 1 0 2.8 2.8l1-1L6.3 9.3l-1 1a.5.5 0 1 1-.7-.7l2-2a.5.5 0 0 1 .7 0z"/>'),
		align: svg('<path d="M2 3h12v1.6H2zM2 6.5h8v1.6H2zM2 10h12v1.6H2zM2 13.5h8v1.6H2z"/>'),
		ul: svg('<path d="M2.5 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2m0 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2m0 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2M6 2.5h8v1.5H6zm0 4h8V8H6zm0 4h8v1.5H6z"/>'),
		ol: svg('<path d="M6 2.5h8v1.5H6zm0 4h8V8H6zm0 4h8v1.5H6zM2.2 3.2h.6V2h-.4l-.7.3.1.5.4-.2zM1.7 8h1.4v-.6h-.7l.7-.7v-.6H1.7v.6h.7l-.7.7zm-.1 4.6h1.6V12H2.4l.5-.5c.2-.2.3-.4.3-.6 0-.4-.3-.7-.8-.7-.4 0-.7.2-.8.6l.5.2c0-.2.1-.3.3-.3s.2.1.2.2-.1.2-.2.4l-.8.8z"/>'),
		img: svg('<path d="M2 3h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1m0 1v6l3-3 2 2 3-3 3 3V4zm2 1.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2"/>'),
		video: svg('<path d="M2 3h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1m4.5 2.7v4.6l4-2.3z"/>'),
		grid: svg('<path d="M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z"/>'),
		plus: svg('<path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1zm5.25 2v2.25H5v1.5h2.25V11h1.5V8.75H11v-1.5H8.75V5z"/>'),
		clear: svg('<path d="M7 3h7v1.5H9.8l-1 7H12V13H4l-.8-1.5L3 5l1-2zm.6 1.5L7 11.5h1.3l1-7z"/>'),
		up: svg('<path d="M8 4 3 9l1 1 4-4 4 4 1-1z"/>'),
		down: svg('<path d="M8 12 3 7l1-1 4 4 4-4 1 1z"/>'),
		edit: svg('<path d="M11.5 2 14 4.5 6.5 12 3 13l1-3.5zM10 5l1 1-4.5 4.5-1-1z"/>'),
		trash: svg('<path d="M6 2h4l.5 1H14v1.5H2V3h3.5zM3.5 5h9l-.7 9H4.2z"/>')
	};

	/* ───────────────────────── helpers ───────────────────────── */
	function esc(s) {
		return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
		});
	}
	function elm(tag, cls, html) {
		var e = document.createElement(tag);
		if (cls) { e.className = cls; }
		if (html != null) { e.innerHTML = html; }
		return e;
	}
	function uid() { return 'bsp' + (uid._n = (uid._n || 0) + 1) + Math.floor(Math.random() * 1e6).toString(36); }
	function classList(el) { return (el.getAttribute('class') || '').split(/\s+/).filter(Boolean); }
	function setClasses(el, arr) { if (arr.length) { el.setAttribute('class', arr.join(' ')); } else { el.removeAttribute('class'); } }

	// Classification of a top-level node when loading HTML:
	//  • INLINE_TAGS (a/br/span/strong/img/…) → stay in the prose flow, NEVER an island. Otherwise loose
	//    inline content like "text <a>link</a> text", or consecutive <br>, would each become its own block.
	//  • PROSE_TAGS (p/h2/ul/…) → editable block prose — UNLESS they carry a Bootstrap component class
	//    (e.g. <ul class="list-group">), which makes them a component island.
	//  • everything else (div/section/table/…) → a component island.
	var PROSE_TAGS = { P: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, UL: 1, OL: 1, BLOCKQUOTE: 1, PRE: 1, HR: 1, FIGURE: 1, DL: 1 };
	var INLINE_TAGS = { A: 1, BR: 1, SPAN: 1, STRONG: 1, B: 1, EM: 1, I: 1, U: 1, S: 1, SMALL: 1, MARK: 1, SUB: 1, SUP: 1, CODE: 1, KBD: 1, ABBR: 1, CITE: 1, Q: 1, TIME: 1, IMG: 1, WBR: 1, BDI: 1, BDO: 1, DEL: 1, INS: 1, SAMP: 1, VAR: 1, DFN: 1, DATA: 1, RUBY: 1, PICTURE: 1 };
	var COMPONENT_CLASS_RE = /(^|\s)(alert|card|accordion|list-group|btn-group|carousel|row|col(-|\b)|progress|nav-tabs|nav-pills|tab-content|table-responsive|ratio|navbar|breadcrumb|pagination)(\s|$|-)/;

	function isIslandEl(el) {
		if (el.nodeType !== 1) { return false; }
		if (INLINE_TAGS[el.tagName]) { return false; }                            // inline flow → prose
		if (PROSE_TAGS[el.tagName]) { return COMPONENT_CLASS_RE.test(el.getAttribute('class') || ''); }
		return true;                                                              // block non-prose → island
	}

	/* ── utility class catalogs (Bootstrap 5.3) ── */
	var TEXT_COLORS = [['text-primary', 'Primary'], ['text-secondary', 'Secondary'], ['text-success', 'Success'], ['text-danger', 'Danger'], ['text-warning', 'Warning'], ['text-info', 'Info'], ['text-light', 'Light'], ['text-dark', 'Dark'], ['text-body', 'Body'], ['text-muted', 'Muted']];
	var BG_COLORS = [['text-bg-primary', 'Primary'], ['text-bg-secondary', 'Secondary'], ['text-bg-success', 'Success'], ['text-bg-danger', 'Danger'], ['text-bg-warning', 'Warning'], ['text-bg-info', 'Info'], ['text-bg-light', 'Light'], ['text-bg-dark', 'Dark']];
	var LINK_COLORS = [['', 'Default'], ['link-primary', 'Primary'], ['link-secondary', 'Secondary'], ['link-success', 'Success'], ['link-danger', 'Danger'], ['link-warning', 'Warning'], ['link-info', 'Info'], ['link-light', 'Light'], ['link-dark', 'Dark'], ['link-body-emphasis', 'Body emphasis']];
	var REL_OPTS = [['noopener', 'noopener'], ['noreferrer', 'noreferrer'], ['nofollow', 'nofollow'], ['sponsored', 'sponsored'], ['ugc', 'ugc'], ['external', 'external']];
	var ALIGN_OPTS = [['text-start', 'Align left'], ['text-center', 'Align center'], ['text-end', 'Align right'], ['text-justify', 'Justify']];
	var FLOAT_OPTS = [['float-start', 'Float left'], ['float-end', 'Float right'], ['float-none', 'No float']];
	var RATIOS = [['ratio-1x1', '1:1 (square)'], ['ratio-4x3', '4:3'], ['ratio-16x9', '16:9 (widescreen)'], ['ratio-21x9', '21:9 (cinematic)']];
	var COLOR_RE = /^text-(primary|secondary|success|danger|warning|info|light|dark|body|muted)$/;
	var BG_RE = /^text-bg-/;
	var ALIGN_RE = /^text-(start|center|end|justify)$/;
	var FLOAT_RE = /^float-/;

	function semVar(suf) {
		return { primary: '--bs-primary', secondary: '--bs-secondary', success: '--bs-success', danger: '--bs-danger', warning: '--bs-warning', info: '--bs-info', light: '--bs-light', dark: '--bs-dark', body: '--bs-body-color', muted: '--bs-secondary-color' }[suf] || '--bs-secondary';
	}
	function colorPreview(cls) {
		if (!cls) { return 'transparent'; }
		var m = cls.match(/(?:text-bg-|text-)([a-z-]+)/);
		return 'var(' + semVar(m ? m[1] : 'secondary') + ')';
	}

	/* ───────────────────────── default Bootstrap component catalog ─────────────────────────
	   Opaque HTML templates. `{{id}}` tokens are replaced with a unique id on every insert
	   (so two accordions/carousels never collide). Override or extend via opts.components. */
	var DEFAULT_COMPONENTS = [
		{ id: 'alert', group: 'Content', label: 'Alert', html: '<div class="alert alert-info" role="alert">A short informational message.</div>' },
		{ id: 'callout', group: 'Content', label: 'Callout', html: '<div class="alert alert-warning d-flex gap-2" role="alert"><span>&#9888;</span><div><strong>Heads up.</strong> Something worth noting.</div></div>' },
		{ id: 'card', group: 'Content', label: 'Card', html: '<div class="card"><div class="card-body"><h3 class="card-title h5">Card title</h3><p class="card-text">Card body text.</p><a href="#" class="btn btn-primary btn-sm">Action</a></div></div>' },
		{ id: 'accordion', group: 'Content', label: 'Accordion', html: '<div class="accordion" id="{{id}}">\n  <div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#{{id}}a">Question one</button></h2><div id="{{id}}a" class="accordion-collapse collapse" data-bs-parent="#{{id}}"><div class="accordion-body">Answer one.</div></div></div>\n  <div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#{{id}}b">Question two</button></h2><div id="{{id}}b" class="accordion-collapse collapse" data-bs-parent="#{{id}}"><div class="accordion-body">Answer two.</div></div></div>\n</div>' },
		{ id: 'listgroup', group: 'Content', label: 'List group', html: '<ul class="list-group">\n  <li class="list-group-item">First item</li>\n  <li class="list-group-item">Second item</li>\n  <li class="list-group-item">Third item</li>\n</ul>' },
		{ id: 'table', group: 'Content', label: 'Table', html: '<div class="table-responsive"><table class="table table-striped"><thead><tr><th>Column</th><th>Column</th></tr></thead><tbody><tr><td>Cell</td><td>Cell</td></tr><tr><td>Cell</td><td>Cell</td></tr></tbody></table></div>' },
		{ id: 'hero', group: 'Layout', label: 'Hero / CTA band', html: '<section class="py-5 text-center bg-body-tertiary rounded">\n  <div class="container"><h2 class="fw-bold">Headline</h2><p class="lead text-secondary">Supporting subheading.</p><a class="btn btn-primary btn-lg" href="#">Get started</a></div>\n</section>' },
		{ id: 'cards3', group: 'Layout', label: 'Card grid · 3', html: '<div class="row row-cols-1 row-cols-md-3 g-4">\n  <div class="col"><div class="card h-100"><div class="card-body"><h3 class="card-title h6">One</h3><p class="card-text">Text.</p></div></div></div>\n  <div class="col"><div class="card h-100"><div class="card-body"><h3 class="card-title h6">Two</h3><p class="card-text">Text.</p></div></div></div>\n  <div class="col"><div class="card h-100"><div class="card-body"><h3 class="card-title h6">Three</h3><p class="card-text">Text.</p></div></div></div>\n</div>' },
		{ id: 'btns', group: 'Inline', label: 'Buttons', html: '<p><a class="btn btn-primary" href="#">Primary</a> <a class="btn btn-outline-secondary" href="#">Secondary</a></p>' },
		{ id: 'btngroup', group: 'Inline', label: 'Button group', html: '<div class="btn-group" role="group"><a href="#" class="btn btn-outline-primary">One</a><a href="#" class="btn btn-outline-primary">Two</a><a href="#" class="btn btn-outline-primary">Three</a></div>' },
		{ id: 'badges', group: 'Inline', label: 'Badges', html: '<p><span class="badge text-bg-primary">Primary</span> <span class="badge text-bg-success">Success</span> <span class="badge text-bg-secondary">Secondary</span></p>' },
		{ id: 'carousel', group: 'Advanced', label: 'Carousel', html: '<div id="{{id}}" class="carousel slide" data-bs-ride="carousel"><div class="carousel-inner">\n  <div class="carousel-item active"><div class="ratio ratio-21x9 bg-body-secondary d-flex align-items-center justify-content-center"><span class="text-secondary">Slide 1 — replace with an image</span></div></div>\n  <div class="carousel-item"><div class="ratio ratio-21x9 bg-body-secondary d-flex align-items-center justify-content-center"><span class="text-secondary">Slide 2 — replace with an image</span></div></div>\n</div>\n<button class="carousel-control-prev" type="button" data-bs-target="#{{id}}" data-bs-slide="prev"><span class="carousel-control-prev-icon"></span></button>\n<button class="carousel-control-next" type="button" data-bs-target="#{{id}}" data-bs-slide="next"><span class="carousel-control-next-icon"></span></button>\n</div>' },
		{ id: 'tabs', group: 'Advanced', label: 'Tabs', html: '<ul class="nav nav-tabs" role="tablist"><li class="nav-item" role="presentation"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#{{id}}1" type="button" role="tab">Tab one</button></li><li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#{{id}}2" type="button" role="tab">Tab two</button></li></ul><div class="tab-content border border-top-0 p-3"><div class="tab-pane fade show active" id="{{id}}1" role="tabpanel"><p>First panel.</p></div><div class="tab-pane fade" id="{{id}}2" role="tabpanel"><p>Second panel.</p></div></div>' },
		{ id: 'progress', group: 'Advanced', label: 'Progress', html: '<div class="progress" role="progressbar" aria-valuenow="60" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar" style="width:60%">60%</div></div>' }
	];

	/* ───────────────────────── overlay mini-dialog ─────────────────────────
	   A self-managed modal (does NOT use bootstrap.Modal, so it can open from anywhere
	   — including inside another modal — without z-index/instance clashes). Field types:
	   text | textarea | file | select | check | checks. Styled with Bootstrap card. */
	function dialog(opts) {
		var ov = elm('div', 'bsprose-ov');
		var defs = opts.fields || [];
		var rows = defs.map(function (f) {
			var id = uid(); f._id = id;
			if (f.type === 'check') {
				return '<div class="mb-2"><div class="form-check"><input class="form-check-input" type="checkbox" id="' + id + '"' + (f.value ? ' checked' : '') + '><label class="form-check-label small" for="' + id + '">' + esc(f.label) + '</label></div></div>';
			}
			var ctrl;
			if (f.type === 'textarea') { ctrl = '<textarea class="form-control" id="' + id + '" rows="' + (f.rows || 6) + '"' + (f.mono ? ' style="font-family:var(--bs-font-monospace);font-size:.85rem"' : '') + '>' + esc(f.value || '') + '</textarea>'; }
			else if (f.type === 'file') { ctrl = '<input type="file" class="form-control" id="' + id + '"' + (f.accept ? ' accept="' + esc(f.accept) + '"' : '') + '>'; }
			else if (f.type === 'select') { ctrl = '<select class="form-select" id="' + id + '">' + (f.options || []).map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(f.value) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; }
			else if (f.type === 'checks') { ctrl = '<div class="d-flex flex-wrap gap-3" id="' + id + '">' + (f.options || []).map(function (o) { var cid = uid(); return '<div class="form-check"><input class="form-check-input" type="checkbox" value="' + esc(o[0]) + '" id="' + cid + '"' + (((f.value || []).indexOf(o[0]) >= 0) ? ' checked' : '') + '><label class="form-check-label small" for="' + cid + '">' + esc(o[1]) + '</label></div>'; }).join('') + '</div>'; }
			else { ctrl = '<input type="text" class="form-control" id="' + id + '" value="' + esc(f.value || '') + '"' + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + '>'; }
			return '<div class="mb-2"><label class="form-label small mb-1" for="' + id + '">' + esc(f.label) + '</label>' + ctrl + (f.hint ? '<div class="form-text small">' + esc(f.hint) + '</div>' : '') + '</div>';
		}).join('');
		ov.innerHTML = '<div class="card"><div class="card-header py-2 d-flex justify-content-between align-items-center">'
			+ '<span class="fw-semibold small">' + esc(opts.title || '') + '</span>'
			+ '<button type="button" class="btn-close btn-sm" data-x></button></div>'
			+ '<div class="card-body">' + (opts.body || '') + rows + '<div class="bsprose-dlg-status small text-danger"></div></div>'
			+ '<div class="card-footer d-flex justify-content-end gap-2 py-2">'
			+ '<button type="button" class="btn btn-sm btn-outline-secondary" data-cancel>' + esc(opts.cancel || 'Cancel') + '</button>'
			+ (opts.ok === false ? '' : '<button type="button" class="btn btn-sm btn-primary" data-ok>' + esc(opts.ok || 'OK') + '</button>') + '</div></div>';
		document.body.appendChild(ov);
		var status = ov.querySelector('.bsprose-dlg-status');
		function close() { ov.remove(); }
		function values() {
			var o = {};
			defs.forEach(function (f) {
				var el = document.getElementById(f._id);
				if (!el) { return; }
				if (f.type === 'checks') { o[f.name] = Array.prototype.slice.call(el.querySelectorAll('input:checked')).map(function (c) { return c.value; }); }
				else if (f.type === 'check') { o[f.name] = el.checked; }
				else { o[f.name] = el.value; o[f.name + '_el'] = el; }
			});
			return o;
		}
		var ctx = { close: close, status: function (m) { status.textContent = m || ''; }, el: ov };
		ov.addEventListener('mousedown', function (e) { if (e.target === ov) { close(); } });
		ov.querySelector('[data-x]').addEventListener('click', close);
		ov.querySelector('[data-cancel]').addEventListener('click', close);
		var okBtn = ov.querySelector('[data-ok]');
		ctx.ok = okBtn;
		if (okBtn) {
			okBtn.addEventListener('click', function () {
				var r = opts.onOk ? opts.onOk(values(), ctx) : true;
				if (r !== false) { close(); }
			});
		}
		if (opts.onReady) { opts.onReady(values(), ctx); }
		var first = ov.querySelector('input:not([type=file]),textarea,select');
		if (first) { setTimeout(function () { first.focus(); }, 30); }
		return ctx;
	}

	/* ───────────────────────── built-in image sources ───────────────────────── */
	function imageUrl(cfg) {
		cfg = cfg || {};
		return {
			id: cfg.id || 'url', label: cfg.label || 'By URL',
			open: function (api) {
				dialog({
					title: cfg.title || 'Insert image by URL',
					fields: [{ name: 'src', label: 'Image URL', placeholder: 'https://…' }, { name: 'alt', label: 'Alt text', placeholder: 'Description' }],
					ok: 'Insert',
					onOk: function (v, d) { if (!v.src.trim()) { d.status('Enter a URL.'); return false; } api.insert({ src: v.src.trim(), alt: v.alt.trim(), 'class': cfg.imgClass || 'img-fluid' }); }
				});
			}
		};
	}
	function imageUpload(cfg) {
		cfg = cfg || {};
		function defaultSend(file) {
			var fd = new FormData();
			fd.append(cfg.fieldName || 'file', file);
			Object.keys(cfg.fields || {}).forEach(function (k) { fd.append(k, cfg.fields[k]); });
			return fetch(cfg.endpoint, { method: 'POST', body: fd, credentials: 'same-origin', headers: cfg.headers || {} })
				.then(function (r) { return r.json(); }).then(function (j) { return cfg.map ? cfg.map(j) : j; });
		}
		var send = cfg.send || defaultSend;
		return {
			id: cfg.id || 'upload', label: cfg.label || 'Upload',
			open: function (api) {
				dialog({
					title: cfg.title || 'Upload an image',
					fields: [{ name: 'file', label: 'Image file', type: 'file', accept: cfg.accept || 'image/*' }, { name: 'alt', label: 'Alt text', placeholder: 'Description' }],
					ok: 'Upload & insert',
					onOk: function (v, d) {
						var f = v.file_el && v.file_el.files[0];
						if (!f) { d.status('Choose a file.'); return false; }
						d.status('Uploading…'); d.ok.disabled = true;
						Promise.resolve(send(f)).then(function (spec) {
							if (!spec || !spec.src) { d.status((spec && spec.error) || 'Upload failed.'); d.ok.disabled = false; return; }
							if (v.alt.trim() && !spec.alt) { spec.alt = v.alt.trim(); }
							if (!spec['class']) { spec['class'] = cfg.imgClass || 'img-fluid'; }
							api.insert(spec); d.close();
						}).catch(function () { d.status('Upload failed.'); d.ok.disabled = false; });
						return false;
					}
				});
			}
		};
	}

	/* ───────────────────────── the editor ───────────────────────── */
	function Editor(host, opts) {
		injectCss();
		opts = opts || {};
		this.opts = opts;
		this.host = typeof host === 'string' ? document.querySelector(host) : host;
		this.components = opts.components || DEFAULT_COMPONENTS;
		this.imageSources = (opts.image && opts.image.sources) || [];
		this.sourceToggle = opts.sourceToggle !== false;
		this.grid = opts.grid !== false;
		this.embed = opts.embed !== false;
		this.toolbarSize = opts.toolbarSize || 'md';
		this.placeholder = opts.placeholder || 'Start writing…';
		this.handlers = {};
		this.sourceMode = false;
		this.lastRange = null;
		this.history = [];
		this.histIndex = -1;
		this.histLimit = opts.historyLimit || 120;
		this._build();
		this.setHTML(opts.value || '');
		this._pushHistory();                       // seed the undo stack with the initial state
		if (opts.onChange) { this.on('change', opts.onChange); }
	}

	Editor.prototype._build = function () {
		var self = this;
		this.host.classList.add('bsprose');
		this.host.innerHTML = '';
		this.tb = elm('div', 'bsprose-tb bsprose-tb-' + (['sm', 'md', 'lg'].indexOf(this.toolbarSize) >= 0 ? this.toolbarSize : 'md'));
		this.surface = elm('div', 'bsprose-surface');
		this.surface.setAttribute('contenteditable', 'true');
		this.surface.setAttribute('data-ph', this.placeholder);
		this.source = elm('textarea', 'bsprose-source d-none');
		this.source.spellcheck = false;
		this.host.appendChild(this.tb);
		this.host.appendChild(this.surface);
		this.host.appendChild(this.source);

		// Tag-based inline marks (clean output). Paragraph separator is irrelevant — Enter is intercepted.
		try { document.execCommand('styleWithCSS', false, false); } catch (e) {}

		this._buildToolbar();

		var save = function () { self._saveRange(); };
		this.surface.addEventListener('keyup', save);
		this.surface.addEventListener('mouseup', save);
		this.surface.addEventListener('focus', save);
		document.addEventListener('selectionchange', function () {
			var s = window.getSelection();
			if (s && s.rangeCount && self.surface.contains(s.anchorNode)) { self._saveRange(); }
		});

		// Enter = <br> by default (press twice for <br><br>); new <li> inside lists; newline inside <pre>.
		this.surface.addEventListener('keydown', function (e) {
			if (self.sourceMode) { return; }
			// Own history (the browser's native undo is unreliable once we mutate the DOM directly for
			// islands / colors / grids), so Ctrl/Cmd+Z and Ctrl/Cmd+Y|Shift+Z drive our snapshot stack.
			if (e.ctrlKey || e.metaKey) {
				var k = (e.key || '').toLowerCase();
				if (k === 'z') { e.preventDefault(); if (e.shiftKey) { self.redo(); } else { self.undo(); } return; }
				if (k === 'y') { e.preventDefault(); self.redo(); return; }
			}
			if (e.key !== 'Enter' || e.isComposing) { return; }
			var ctx = self._enterContext();
			if (ctx === 'LI') { return; }            // let the browser create the next list item
			e.preventDefault();
			if (ctx === 'PRE') { document.execCommand('insertText', false, '\n'); }
			else { document.execCommand('insertLineBreak'); }
			self._afterEdit();
		});

		this.surface.addEventListener('input', function () { self._afterEdit(); });
		this.surface.addEventListener('paste', function (e) { self._onPaste(e); });
		this.surface.addEventListener('click', function (e) {
			self.surface.querySelectorAll('.bsprose-sel').forEach(function (n) { n.classList.remove('bsprose-sel'); });
			var isl = e.target.closest ? e.target.closest('.bsprose-island') : null;
			if (isl) { isl.classList.add('bsprose-sel'); }
		});
		this.source.addEventListener('input', function () { self.emit('change', self.getHTML()); });
	};

	Editor.prototype._buildToolbar = function () {
		var self = this;
		var defaultTb = ['format', '|', 'bold', 'italic', 'underline', 'color', 'bgcolor', '|', 'align', 'link', '|', 'bullet', 'number', '|', 'image', 'embed', 'component', 'grid', '|', 'clean'];
		var layout = this.opts.toolbar || defaultTb;

		function btn(icon, title, fn) {
			var b = elm('button', 'btn btn-light border', icon);
			b.type = 'button'; b.title = title; b.setAttribute('aria-label', title);
			b.addEventListener('mousedown', function (e) { e.preventDefault(); });
			b.addEventListener('click', function (e) { e.preventDefault(); fn(b); });
			return b;
		}
		function sep() { return elm('span', 'bsprose-sep'); }

		var make = {
			format: function () { return self._formatMenu(); },
			bold: function () { return btn(ICON.bold, 'Bold', function () { self._exec('bold'); }); },
			italic: function () { return btn(ICON.italic, 'Italic', function () { self._exec('italic'); }); },
			underline: function () { return btn(ICON.underline, 'Underline', function () { self._exec('underline'); }); },
			color: function () { return self._swatchMenu(ICON.color, 'Text colour', TEXT_COLORS, function (c) { self._applyInline(c, COLOR_RE); }); },
			bgcolor: function () { return self._swatchMenu(ICON.bg, 'Background colour', BG_COLORS, function (c) { self._applyInline(c, BG_RE); }); },
			align: function () { return self._alignMenu(); },
			link: function () { return btn(ICON.link, 'Link', function () { self._linkDialog(); }); },
			bullet: function () { return btn(ICON.ul, 'Bulleted list', function () { self._exec('insertUnorderedList'); }); },
			number: function () { return btn(ICON.ol, 'Numbered list', function () { self._exec('insertOrderedList'); }); },
			clean: function () { return btn(ICON.clear, 'Clear formatting', function () { self._clean(); }); },
			image: function () { return self.imageSources.length ? btn(ICON.img, 'Insert image', function (b) { self._imageMenu(b); }) : null; },
			embed: function () { return self.embed ? btn(ICON.video, 'Embed video', function () { self._embedDialog(); }) : null; },
			component: function () { return self.components.length ? self._componentMenu() : null; },
			grid: function () { return self.grid ? btn(ICON.grid, 'Insert grid', function () { self._gridDialog(null); }) : null; }
		};

		layout.forEach(function (tok) {
			if (tok === '|') { self.tb.appendChild(sep()); return; }
			if (tok === 'source') { return; } // pinned right below
			var node = make[tok] ? make[tok]() : null;
			if (node) { self.tb.appendChild(node); }
		});
		// HTML-source toggle is ALWAYS the right-most control, labeled "HTML".
		if (this.sourceToggle) {
			this.srcBtn = btn('HTML', 'HTML source', function (b) { self._toggleSource(b); });
			this.srcBtn.classList.add('bsprose-src-btn');
			this.tb.appendChild(this.srcBtn);
		}
	};

	// A lightweight dropdown (own implementation — no Bootstrap JS needed for the toolbar).
	Editor.prototype._dropdown = function (icon, title, buildMenu) {
		var wrap = elm('span', 'position-relative');
		var b = elm('button', 'btn btn-light border', icon + ' <span style="font-size:.7em">&#9662;</span>');
		b.type = 'button'; b.title = title; b.setAttribute('aria-label', title);
		var menu = elm('div', 'dropdown-menu bsprose-menu');
		buildMenu(menu, function () { menu.classList.remove('show'); });
		b.addEventListener('mousedown', function (e) { e.preventDefault(); });
		b.addEventListener('click', function (e) {
			e.preventDefault();
			var open = menu.classList.contains('show');
			document.querySelectorAll('.bsprose-menu.show').forEach(function (m) { m.classList.remove('show'); });
			if (!open) { menu.classList.add('show'); }
		});
		document.addEventListener('mousedown', function (e) { if (!wrap.contains(e.target)) { menu.classList.remove('show'); } });
		wrap.appendChild(b); wrap.appendChild(menu);
		return wrap;
	};

	Editor.prototype._menuItem = function (label, fn, close) {
		var i = elm('button', 'dropdown-item small', esc(label));
		i.type = 'button';
		i.addEventListener('mousedown', function (e) { e.preventDefault(); });
		i.addEventListener('click', function () { fn(); close(); });
		return i;
	};

	Editor.prototype._formatMenu = function () {
		var self = this;
		return this._dropdown('Text', 'Text style', function (menu, close) {
			menu.appendChild(self._menuItem('Text (line breaks)', function () { self._textBlock(); }, close));
			// formatBlock REPLACES the current block's tag, so switching e.g., H1→H2 changes it (never nests/duplicates).
			[['p', 'Paragraph'], ['h1', 'Heading 1'], ['h2', 'Heading 2'], ['h3', 'Heading 3'], ['h4', 'Heading 4'], ['h5', 'Heading 5'], ['blockquote', 'Quote'], ['pre', 'Code block']].forEach(function (it) {
				menu.appendChild(self._menuItem(it[1], function () { self._exec('formatBlock', '<' + it[0] + '>'); }, close));
			});
		});
	};

	Editor.prototype._alignMenu = function () {
		var self = this;
		return this._dropdown(ICON.align, 'Alignment & float', function (menu, close) {
			menu.appendChild(elm('h6', 'dropdown-header', 'Text alignment'));
			ALIGN_OPTS.forEach(function (o) { menu.appendChild(self._menuItem(o[1], function () { self._applyAlign(o[0]); }, close)); });
			menu.appendChild(elm('div', 'dropdown-divider'));
			menu.appendChild(elm('h6', 'dropdown-header', 'Float (image / component)'));
			FLOAT_OPTS.forEach(function (o) { menu.appendChild(self._menuItem(o[1], function () { self._applyFloat(o[0]); }, close)); });
		});
	};

	Editor.prototype._swatchMenu = function (icon, title, items, applyFn) {
		return this._dropdown(icon, title, function (menu, close) {
			menu.classList.add('p-0');
			var grid = elm('div', 'bsprose-swatches');
			items.forEach(function (it) {
				var sw = elm('button', 'bsprose-swatch'); sw.type = 'button'; sw.title = it[1];
				sw.style.background = colorPreview(it[0]);
				sw.addEventListener('mousedown', function (e) { e.preventDefault(); });
				sw.addEventListener('click', function () { applyFn(it[0]); close(); });
				grid.appendChild(sw);
			});
			menu.appendChild(grid);
			menu.appendChild(elm('div', 'dropdown-divider my-0'));
			var none = elm('button', 'dropdown-item small', 'Remove colour');
			none.type = 'button';
			none.addEventListener('mousedown', function (e) { e.preventDefault(); });
			none.addEventListener('click', function () { applyFn(''); close(); });
			menu.appendChild(none);
		});
	};

	Editor.prototype._componentMenu = function () {
		var self = this;
		return this._dropdown(ICON.plus, 'Insert component', function (menu, close) {
			var lastGroup = '';
			self.components.forEach(function (c) {
				if ((c.group || '') !== lastGroup) { menu.appendChild(elm('h6', 'dropdown-header', esc(c.group || ''))); lastGroup = c.group || ''; }
				menu.appendChild(self._menuItem(c.label, function () { self.insertComponent(c.html); }, close));
			});
		});
	};

	Editor.prototype._imageMenu = function () {
		var self = this;
		var api = { insert: function (spec) { self.insertImage(spec); } };
		this._saveRange();
		if (this.imageSources.length === 1) { this.imageSources[0].open(api); return; }
		var d = dialog({
			title: 'Insert image',
			body: '<div class="d-grid gap-2">' + this.imageSources.map(function (s, i) { return '<button type="button" class="btn btn-outline-primary" data-src="' + i + '">' + esc(s.label) + '</button>'; }).join('') + '</div>',
			ok: false, cancel: 'Close'
		});
		d.el.querySelectorAll('[data-src]').forEach(function (b) {
			b.addEventListener('click', function () { d.close(); self.imageSources[parseInt(b.dataset.src, 10)].open(api); });
		});
	};

	/* ── selection / commands ── */
	Editor.prototype._saveRange = function () {
		var s = window.getSelection();
		if (s && s.rangeCount && this.surface.contains(s.anchorNode)) { this.lastRange = s.getRangeAt(0).cloneRange(); }
	};
	Editor.prototype._restoreRange = function () {
		if (!this.lastRange) { return; }
		var s = window.getSelection();
		s.removeAllRanges();
		s.addRange(this.lastRange);
	};
	Editor.prototype._exec = function (cmd, val) {
		if (this.sourceMode) { return; }
		this.surface.focus();
		this._restoreRange();
		try { document.execCommand(cmd, false, val); } catch (e) {}
		this._saveRange();
		this._commit();
	};
	Editor.prototype._clean = function () {
		if (this.sourceMode) { return; }
		this.surface.focus();
		this._restoreRange();
		try { document.execCommand('removeFormat'); } catch (e) {}
		try { document.execCommand('unlink'); } catch (e2) {}
		this._commit();
	};

	// The nearest meaningful block context for the caret (LI / PRE / else null).
	Editor.prototype._enterContext = function () {
		var s = window.getSelection();
		var n = s && s.rangeCount ? s.anchorNode : null;
		while (n && n !== this.surface) {
			if (n.nodeType === 1) { if (n.tagName === 'LI') { return 'LI'; } if (n.tagName === 'PRE') { return 'PRE'; } }
			n = n.parentNode;
		}
		return null;
	};

	// Direct child of the surface that contains the caret (element or text node).
	Editor.prototype._currentTopBlock = function () {
		var s = window.getSelection();
		var n = s && s.rangeCount ? s.anchorNode : null;
		while (n && n.parentNode !== this.surface) { n = n.parentNode; }
		return n && n.parentNode === this.surface ? n : null;
	};

	// "Text" format — unwrap the current block element back to inline text + <br> at surface level.
	Editor.prototype._textBlock = function () {
		this.surface.focus();
		this._restoreRange();
		var b = this._currentTopBlock();
		if (b && b.nodeType === 1 && b.parentNode === this.surface && !b.hasAttribute('data-bsp-island') && PROSE_TAGS[b.tagName]) {
			var f = document.createDocumentFragment();
			while (b.firstChild) { f.appendChild(b.firstChild); }
			f.appendChild(document.createElement('br'));
			this.surface.replaceChild(f, b);
		}
		this._commit();
	};

	/* ── colors (inline), alignment (block), float (element) ── */
	// Apply (or, with cls='', remove) a text-color / background class to the selection. Text color AND
	// background live in the SAME <span class> — never nested spans. If the selection already sits in a span
	// stack, those spans are merged into one and the relevant group class is swapped/removed; an empty span
	// (last color removed) is unwrapped. cls='' just removes the group → makes "Remove colour" work.
	Editor.prototype._applyInline = function (cls, groupRe) {
		if (this.sourceMode) { return; }
		this.surface.focus();
		this._restoreRange();
		var sel = window.getSelection();
		if (!sel.rangeCount) { return; }
		var range = sel.getRangeAt(0);
		if (range.collapsed) { return; }
		var selText = range.toString();

		// Spans that EXACTLY wrap the selected text form a "stack" — flatten them into one to avoid nesting.
		var chain = [];
		var node = range.commonAncestorContainer;
		var sp = node.nodeType === 1 ? node : node.parentNode;
		sp = sp && sp.closest ? sp.closest('span') : null;
		while (sp && this.surface.contains(sp) && sp.textContent === selText) {
			chain.push(sp);
			sp = sp.parentNode && sp.parentNode.closest ? sp.parentNode.closest('span') : null;
		}

		if (chain.length) {
			var outer = chain[chain.length - 1];
			var merged = [];
			chain.forEach(function (s) { classList(s).forEach(function (c) { if (merged.indexOf(c) < 0) { merged.push(c); } }); });
			chain.slice(0, -1).forEach(function (s) { while (s.firstChild) { s.parentNode.insertBefore(s.firstChild, s); } s.remove(); });
			merged = merged.filter(function (c) { return !groupRe.test(c); });
			if (cls) { merged.push(cls); }
			setClasses(outer, merged);
			var rr = document.createRange();
			if (!outer.getAttribute('class')) {                    // no classes left → unwrap the span
				var f = document.createDocumentFragment(), a = outer.firstChild, b = outer.lastChild;
				while (outer.firstChild) { f.appendChild(outer.firstChild); }
				outer.parentNode.replaceChild(f, outer);
				if (a) { rr.setStartBefore(a); rr.setEndAfter(b); sel.removeAllRanges(); sel.addRange(rr); }
			} else {
				rr.selectNodeContents(outer); sel.removeAllRanges(); sel.addRange(rr);
			}
			this._saveRange();
			this._commit();
			return;
		}

		// General case (plain text / partial selection): extract, flatten any color-only spans inside
		// (carrying their classes over), then wrap the result in ONE span with the merged class set.
		var frag = range.extractContents();
		var keep = [];
		Array.prototype.slice.call(frag.querySelectorAll('span')).forEach(function (s) {
			var c = classList(s), col = c.filter(function (x) { return COLOR_RE.test(x) || BG_RE.test(x); });
			if (col.length && col.length === c.length) { // color-only span → unwrap, keep its classes
				col.forEach(function (x) { if (keep.indexOf(x) < 0) { keep.push(x); } });
				while (s.firstChild) { s.parentNode.insertBefore(s.firstChild, s); }
				s.remove();
			}
		});
		var fcls = keep.filter(function (c) { return !groupRe.test(c); });
		if (cls) { fcls.push(cls); }
		var out = fcls.length ? document.createElement('span') : frag;
		var marker = fcls.length ? out : frag.lastChild;
		if (fcls.length) { out.className = fcls.join(' '); out.appendChild(frag); }
		range.insertNode(out);
		var nr = document.createRange();
		if (fcls.length) { nr.selectNodeContents(out); sel.removeAllRanges(); sel.addRange(nr); }
		else if (marker) { nr.selectNode(marker); sel.removeAllRanges(); sel.addRange(nr); }
		this._saveRange();
		this._commit();
	};

	// Alignment needs a block; bare "Text" content is wrapped into a <p> first.
	Editor.prototype._applyAlign = function (cls) {
		if (this.sourceMode) { return; }
		this.surface.focus();
		this._restoreRange();
		var b = this._currentTopBlock();
		if (!b || b.nodeType !== 1 || !PROSE_TAGS[b.tagName] || b.hasAttribute('data-bsp-island')) {
			try { document.execCommand('formatBlock', false, '<p>'); } catch (e) {}
			b = this._currentTopBlock();
		}
		if (b && b.nodeType === 1 && !b.hasAttribute('data-bsp-island')) {
			setClasses(b, classList(b).filter(function (c) { return !ALIGN_RE.test(c); }).concat(cls && cls !== 'none' ? [cls] : []));
		}
		this._commit();
	};

	// Float applies to the selected image, else the selected component island root, else current block element.
	Editor.prototype._applyFloat = function (cls) {
		if (this.sourceMode) { return; }
		var t = this._floatTarget();
		if (!t) { return; }
		setClasses(t, classList(t).filter(function (c) { return !FLOAT_RE.test(c); }).concat(cls && cls !== 'float-none' ? [cls] : []));
		this._commit();
	};
	Editor.prototype._floatTarget = function () {
		var isl = this.surface.querySelector('.bsprose-island.bsprose-sel');
		if (isl) { var body = isl.querySelector('.bsprose-island-body'); return body && body.firstElementChild; }
		var s = window.getSelection();
		var n = s && s.rangeCount ? s.anchorNode : null;
		if (n) {
			var el = n.nodeType === 1 ? n : n.parentNode;
			var img = el && el.closest ? el.closest('img') : null;
			if (img) { return img; }
		}
		var b = this._currentTopBlock();
		return b && b.nodeType === 1 ? b : null;
	};

	/* ── link dialog (colour + target + rel; create OR edit an existing link) ── */
	// The <a> is built/updated directly (not via execCommand) so target / rel / color are reliably applied,
	// and an existing link under the caret is detected → its attributes prefill the dialog and are updated
	// in place instead of nesting a new anchor inside it.
	Editor.prototype._linkDialog = function () {
		var self = this;
		this._saveRange();
		var existing = this._anchorAtSelection();
		var sel = window.getSelection();
		var hasSel = sel && sel.rangeCount && !sel.getRangeAt(0).collapsed;
		var cur = existing ? {
			href: existing.getAttribute('href') || '',
			text: existing.textContent || '',
			color: classList(existing).filter(function (c) { return /^link-/.test(c); })[0] || '',
			blank: existing.getAttribute('target') === '_blank',
			rel: (existing.getAttribute('rel') || '').split(/\s+/).filter(Boolean)
		} : { href: '', text: '', color: '', blank: false, rel: [] };
		var showText = !!existing || !hasSel;            // editing, or inserting with no selection → ask for text
		var fields = [{ name: 'href', label: 'URL', placeholder: 'https://…', value: cur.href }];
		if (showText) { fields.push({ name: 'text', label: 'Text', placeholder: 'Link text', value: cur.text }); }
		fields.push({ name: 'color', label: 'Link colour', type: 'select', options: LINK_COLORS, value: cur.color });
		fields.push({ name: 'blank', label: 'Open in a new tab (target="_blank")', type: 'check', value: cur.blank });
		fields.push({ name: 'rel', label: 'rel attributes', type: 'checks', options: REL_OPTS, value: cur.rel });
		dialog({
			title: existing ? 'Edit link' : 'Insert link', fields: fields, ok: existing ? 'Apply' : 'Insert',
			onOk: function (v, d) {
				var href = v.href.trim();
				if (!href) { d.status('Enter a URL.'); return false; }
				var rel = (v.rel || []).slice();
				if (v.blank && rel.indexOf('noopener') < 0) { rel.push('noopener'); }

				function style(a) {
					a.setAttribute('href', href);
					if (v.blank) { a.setAttribute('target', '_blank'); } else { a.removeAttribute('target'); }
					if (rel.length) { a.setAttribute('rel', rel.join(' ')); } else { a.removeAttribute('rel'); }
					setClasses(a, classList(a).filter(function (c) { return !/^link-/.test(c); }).concat(v.color ? [v.color] : []));
				}

				if (existing) {
					style(existing);
					if (showText && v.text.trim() && v.text !== existing.textContent) { existing.textContent = v.text.trim(); }
				} else {
					self.surface.focus();
					self._restoreRange();
					var a = document.createElement('a');
					style(a);
					var range = window.getSelection().rangeCount ? window.getSelection().getRangeAt(0) : null;
					if (hasSel && range && !range.collapsed) { a.appendChild(range.extractContents()); range.insertNode(a); }
					else { a.textContent = v.text.trim() || href; if (range) { range.insertNode(a); } else { self.surface.appendChild(a); } }
				}
				self._commit();
			}
		});
	};
	// The <a> the caret/selection refers to (within the surface), or null. Robust to: a collapsed caret
	// inside the link, a partial selection inside it, AND a whole-link selection whose range boundaries sit
	// on the parent element (commonAncestor is the parent, so closest('a') on it alone would miss the link).
	Editor.prototype._anchorAtSelection = function () {
		var self = this;
		var r = this.lastRange;
		if (!r) { var s = window.getSelection(); if (s && s.rangeCount) { r = s.getRangeAt(0); } }
		if (!r) { return null; }
		function closestA(node) {
			var el = node ? (node.nodeType === 1 ? node : node.parentNode) : null;
			return el && el.closest ? el.closest('a') : null;
		}
		var a = closestA(r.commonAncestorContainer) || closestA(r.startContainer) || closestA(r.endContainer);
		if (!a && r.commonAncestorContainer && r.commonAncestorContainer.nodeType === 1) {
			// selection wraps the <a> at element level → scan the selected child range
			var kids = Array.prototype.slice.call(r.commonAncestorContainer.childNodes).slice(r.startOffset, r.endOffset);
			for (var i = 0; i < kids.length && !a; i++) {
				if (kids[i].nodeType !== 1) { continue; }
				if (kids[i].tagName === 'A') { a = kids[i]; }
				else if (kids[i].querySelector) { a = kids[i].querySelector('a'); }
			}
		}
		return a && this.surface.contains(a) ? a : null;
	};

	/* ── components / images / islands ── */
	Editor.prototype.insertComponent = function (html) {
		var island = this._makeIsland(String(html).replace(/\{\{id\}\}/g, uid()));
		this._insertBlock(island);
		this._commit();
	};
	Editor.prototype.insertImage = function (spec) {
		if (this.sourceMode) { return; }
		this.surface.focus();
		this._restoreRange();
		try { document.execCommand('insertHTML', false, this._imgHtml(spec)); } catch (e) {}
		this._commit();
	};
	// Build an image. With `s.sources` (an array of {media, srcset, type}) the result is a <picture> whose
	// <source media> rules switch deterministically by viewport (what authors expect — narrower window loads a
	// smaller file, re-evaluated on resize), with the plain <img> as the largest/default fallback. Without
	// `sources` it's a normal responsive <img srcset sizes> (browser-optimised, DPR-aware).
	Editor.prototype._imgHtml = function (s) {
		function a(k, v) { return v != null && v !== '' ? ' ' + k + '="' + esc(v) + '"' : ''; }
		var hasPic = s.sources && s.sources.length;
		var img = '<img src="' + esc(s.src) + '"' + (hasPic ? '' : a('srcset', s.srcset) + a('sizes', s.sizes))
			+ a('width', s.width) + a('height', s.height)
			+ ' loading="lazy" decoding="async" alt="' + esc(s.alt || '') + '" class="' + esc(s['class'] || 'img-fluid') + '">';
		if (!hasPic) { return img; }
		var srcs = s.sources.map(function (so) { return '<source' + a('media', so.media) + a('type', so.type) + a('srcset', so.srcset) + a('sizes', so.sizes) + '>'; }).join('');
		return '<picture>' + srcs + img + '</picture>';
	};

	Editor.prototype._makeIsland = function (innerHtml) {
		var self = this;
		var isl = elm('div', 'bsprose-island');
		isl.setAttribute('contenteditable', 'false');
		isl.setAttribute('data-bsp-island', '1');
		var tools = elm('div', 'bsprose-island-tools');
		function t(icon, title, fn) {
			var b = elm('button', 'btn btn-light border', icon);
			b.type = 'button'; b.title = title; b.setAttribute('aria-label', title);
			b.addEventListener('mousedown', function (e) { e.preventDefault(); });
			b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); fn(); });
			return b;
		}
		tools.appendChild(t(ICON.up, 'Move up', function () { self._moveIsland(isl, -1); }));
		tools.appendChild(t(ICON.down, 'Move down', function () { self._moveIsland(isl, 1); }));
		var body = elm('div', 'bsprose-island-body', innerHtml);
		// Heal embeds authored before referrerpolicy support: a missing policy makes YouTube/Vimeo throw a
		// "configuration error" whenever the host page sends no referrer (e.g., Referrer-Policy: same-origin).
		body.querySelectorAll('iframe:not([referrerpolicy])').forEach(function (f) { f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin'); });
		// A grid island (root .row) gets a visual grid editor in addition to raw Edit HTML.
		if (this.grid && body.firstElementChild && /(^|\s)row(\s|$)/.test(body.firstElementChild.className || '')) {
			tools.appendChild(t(ICON.grid, 'Edit grid', function () { self._gridDialog(isl); }));
		}
		tools.appendChild(t(ICON.edit, 'Edit HTML', function () { self._editIsland(isl); }));
		tools.appendChild(t(ICON.trash, 'Delete', function () { self._deleteIsland(isl); }));
		isl.appendChild(tools);
		isl.appendChild(body);
		return isl;
	};
	Editor.prototype._moveIsland = function (isl, dir) {
		var sib = dir < 0 ? isl.previousElementSibling : isl.nextElementSibling;
		if (!sib) { return; }
		if (dir < 0) { isl.parentNode.insertBefore(isl, sib); } else { isl.parentNode.insertBefore(sib, isl); }
		this._commit();
	};
	Editor.prototype._editIsland = function (isl) {
		var self = this;
		var body = isl.querySelector('.bsprose-island-body');
		dialog({
			title: 'Edit component HTML',
			fields: [{ name: 'html', label: 'Raw HTML', type: 'textarea', rows: 12, mono: true, value: body.innerHTML.trim() }],
			ok: 'Apply',
			onOk: function (v) { body.innerHTML = v.html; self._commit(); }
		});
	};
	Editor.prototype._deleteIsland = function (isl) {
		if (!window.confirm('Delete this component?')) { return; }
		isl.remove();
		if (!this.surface.firstChild) { this.surface.appendChild(document.createElement('br')); }
		this._commit();
	};

	Editor.prototype._insertBlock = function (node) {
		this.surface.focus();
		this._restoreRange();
		var ref = this._currentTopBlock();
		if (ref && ref.parentNode === this.surface) { this.surface.insertBefore(node, ref.nextSibling); }
		else { this.surface.appendChild(node); }
		var p = elm('p', null, '<br>');
		this.surface.insertBefore(p, node.nextSibling);
		this._placeCaret(p);
		this.updateEmpty();
	};
	Editor.prototype._placeCaret = function (el) {
		var r = document.createRange();
		r.selectNodeContents(el); r.collapse(true);
		var s = window.getSelection();
		s.removeAllRanges(); s.addRange(r);
		this._saveRange();
	};

	/* ── grid builder (create + edit; develop B1) ── */
	Editor.prototype._gridDialog = function (island) {
		var self = this;
		var state = island ? this._parseGrid(island) : { bp: 'md', gutter: 'g-4', valign: '', cols: [{ w: '6', html: '<p>Column</p>' }, { w: '6', html: '<p>Column</p>' }] };
		this._saveRange();

		function colClass(w) {
			var pre = state.bp === 'none' ? 'col' : 'col-' + state.bp;
			if (w === '' || w == null) { return pre; }
			if (w === 'auto') { return pre + '-auto'; }
			return pre + '-' + w;
		}
		function widthOpts(sel) {
			var out = '<option value=""' + (sel === '' ? ' selected' : '') + '>Equal width</option><option value="auto"' + (sel === 'auto' ? ' selected' : '') + '>Auto</option>';
			for (var n = 1; n <= 12; n++) { out += '<option value="' + n + '"' + (String(sel) === String(n) ? ' selected' : '') + '>' + n + ' / 12</option>'; }
			return out;
		}
		var bpOpts = [['none', 'Always (all sizes)'], ['sm', '≥ sm'], ['md', '≥ md'], ['lg', '≥ lg'], ['xl', '≥ xl'], ['xxl', '≥ xxl']];
		var gutterOpts = [['', 'None'], ['g-1', 'g-1'], ['g-2', 'g-2'], ['g-3', 'g-3'], ['g-4', 'g-4'], ['g-5', 'g-5']];
		var valignOpts = [['', 'Default'], ['start', 'Top'], ['center', 'Middle'], ['end', 'Bottom']];
		function selHtml(opts, val) { return opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); }

		var d = dialog({
			title: island ? 'Edit grid' : 'Insert grid',
			body: '<div class="row g-2 mb-3">'
				+ '<div class="col-4"><label class="form-label small mb-1">Breakpoint</label><select class="form-select form-select-sm" data-bp>' + selHtml(bpOpts, state.bp) + '</select></div>'
				+ '<div class="col-4"><label class="form-label small mb-1">Gutter</label><select class="form-select form-select-sm" data-gutter>' + selHtml(gutterOpts, state.gutter) + '</select></div>'
				+ '<div class="col-4"><label class="form-label small mb-1">Vertical align</label><select class="form-select form-select-sm" data-valign>' + selHtml(valignOpts, state.valign) + '</select></div>'
				+ '</div><div class="bsprose-grid-cols"></div>'
				+ '<button type="button" class="btn btn-sm btn-outline-primary" data-add>+ Add column</button>',
			ok: island ? 'Apply' : 'Insert',
			onOk: function () {
				sync();
				var rowCls = 'row' + (state.gutter ? ' ' + state.gutter : '') + (state.valign ? ' align-items-' + state.valign : '');
				var html = '<div class="' + rowCls + '">' + state.cols.map(function (c) { return '<div class="' + colClass(c.w) + '">' + c.html + '</div>'; }).join('') + '</div>';
				if (island) { island.querySelector('.bsprose-island-body').innerHTML = html; self._commit(); }
				else { self.insertComponent(html); }
			}
		});

		var box = d.el.querySelector('.bsprose-grid-cols');
		function sync() {
			Array.prototype.slice.call(box.children).forEach(function (row, i) {
				if (!state.cols[i]) { return; }
				state.cols[i].w = row.querySelector('[data-w]').value;
				state.cols[i].html = row.querySelector('[data-html]').value;
			});
		}
		function render() {
			box.innerHTML = '';
			state.cols.forEach(function (c, i) {
				var row = elm('div', 'border rounded p-2 mb-2');
				row.innerHTML = '<div class="d-flex align-items-center gap-2 mb-1">'
					+ '<span class="small fw-semibold">Column ' + (i + 1) + '</span>'
					+ '<select class="form-select form-select-sm w-auto" data-w>' + widthOpts(c.w) + '</select>'
					+ '<div class="btn-group btn-group-sm ms-auto">'
					+ '<button type="button" class="btn btn-outline-secondary" data-up' + (i === 0 ? ' disabled' : '') + '>&uarr;</button>'
					+ '<button type="button" class="btn btn-outline-secondary" data-down' + (i === state.cols.length - 1 ? ' disabled' : '') + '>&darr;</button>'
					+ '<button type="button" class="btn btn-outline-danger" data-del' + (state.cols.length <= 1 ? ' disabled' : '') + '>&times;</button>'
					+ '</div></div>'
					+ '<textarea class="form-control form-control-sm" rows="3" data-html style="font-family:var(--bs-font-monospace);font-size:.8rem"></textarea>';
				row.querySelector('[data-html]').value = c.html;
				row.querySelector('[data-up]').addEventListener('click', function () { sync(); var t = state.cols[i - 1]; state.cols[i - 1] = state.cols[i]; state.cols[i] = t; render(); });
				row.querySelector('[data-down]').addEventListener('click', function () { sync(); var t = state.cols[i + 1]; state.cols[i + 1] = state.cols[i]; state.cols[i] = t; render(); });
				row.querySelector('[data-del]').addEventListener('click', function () { sync(); state.cols.splice(i, 1); render(); });
				box.appendChild(row);
			});
		}
		d.el.querySelector('[data-bp]').addEventListener('change', function () { state.bp = this.value; });
		d.el.querySelector('[data-gutter]').addEventListener('change', function () { state.gutter = this.value; });
		d.el.querySelector('[data-valign]').addEventListener('change', function () { state.valign = this.value; });
		d.el.querySelector('[data-add]').addEventListener('click', function () { sync(); state.cols.push({ w: '', html: '<p>Column</p>' }); render(); });
		render();
	};
	Editor.prototype._parseGrid = function (island) {
		var st = { bp: 'md', gutter: '', valign: '', cols: [] };
		var root = island.querySelector('.bsprose-island-body').firstElementChild;
		if (!root) { st.cols.push({ w: '', html: '' }); return st; }
		var rc = root.className || '';
		var g = rc.match(/\bg-([0-5])\b/); if (g) { st.gutter = 'g-' + g[1]; }
		var v = rc.match(/\balign-items-(start|center|end)\b/); if (v) { st.valign = v[1]; }
		var bpSet = false;
		Array.prototype.slice.call(root.children).forEach(function (col) {
			var m = (col.className || '').match(/\bcol(?:-(sm|md|lg|xl|xxl))?(?:-(\d+|auto))?\b/);
			if (!bpSet && m) { st.bp = m[1] || 'none'; bpSet = true; }
			st.cols.push({ w: m && m[2] ? m[2] : '', html: col.innerHTML });
		});
		if (!st.cols.length) { st.cols.push({ w: '', html: '' }); }
		return st;
	};

	/* ── embed video by URL into a responsive ratio box ── */
	Editor.prototype._embedDialog = function () {
		var self = this;
		this._saveRange();
		dialog({
			title: 'Embed video',
			fields: [
				{ name: 'url', label: 'Video URL', placeholder: 'YouTube / Vimeo / iframe src', hint: 'YouTube & Vimeo watch links are converted automatically.' },
				{ name: 'ratio', label: 'Aspect ratio', type: 'select', options: RATIOS, value: 'ratio-16x9' },
				{ name: 'title', label: 'Title (accessibility)', placeholder: 'Video title' }
			],
			ok: 'Insert',
			onOk: function (v, d) {
				var src = self._embedUrl(v.url.trim());
				if (!src) { d.status('Enter a video URL.'); return false; }
				// referrerpolicy on the iframe ITSELF sets the referrer for the player's own load — without it,
				// pages/servers that strip the Referer header make YouTube fail with "configuration error" (153).
				var html = '<div class="ratio ' + esc(v.ratio) + '"><iframe src="' + esc(src) + '" title="' + esc(v.title.trim())
					+ '" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen'
					+ ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"></iframe></div>';
				self.insertComponent(html);
			}
		});
	};
	// Normalize common video URLs to an embeddable src. Covers YouTube watch / youtu.be / embed / shorts / live,
	// and Vimeo. Anything else is used verbatim (assumed already embeddable).
	Editor.prototype._embedUrl = function (url) {
		if (!url) { return ''; }
		var m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/);
		if (m) { return 'https://www.youtube.com/embed/' + m[1]; }
		m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
		if (m) { return 'https://player.vimeo.com/video/' + m[1]; }
		return url;
	};

	/* ── paste sanitizer: keep structural prose tags, drop attributes/styles ── */
	Editor.prototype._onPaste = function (e) {
		if (this.sourceMode) { return; }
		var cd = e.clipboardData || window.clipboardData;
		if (!cd) { return; }
		e.preventDefault();
		var html = cd.getData('text/html');
		var clean = html ? this._sanitizePaste(html) : esc(cd.getData('text/plain')).replace(/\r?\n/g, '<br>');
		this.surface.focus();
		this._restoreRange();
		try { document.execCommand('insertHTML', false, clean); } catch (err) {}
		this._commit();
	};
	Editor.prototype._sanitizePaste = function (html) {
		var ALLOW = { P: 1, BR: 1, STRONG: 1, B: 1, EM: 1, I: 1, U: 1, A: 1, UL: 1, OL: 1, LI: 1, H2: 1, H3: 1, H4: 1, BLOCKQUOTE: 1, CODE: 1, PRE: 1, SPAN: 1 };
		var tmp = elm('div', null, html);
		tmp.querySelectorAll('script,style,meta,link,noscript').forEach(function (n) { n.remove(); });
		(function walk(node) {
			Array.prototype.slice.call(node.childNodes).forEach(function (c) {
				if (c.nodeType === 1) {
					walk(c);
					if (!ALLOW[c.tagName]) { while (c.firstChild) { node.insertBefore(c.firstChild, c); } node.removeChild(c); return; }
					var keepHref = c.tagName === 'A' ? c.getAttribute('href') : null;
					Array.prototype.slice.call(c.attributes).forEach(function (at) { c.removeAttribute(at.name); });
					if (keepHref) { c.setAttribute('href', keepHref); }
					if (c.tagName === 'SPAN') { while (c.firstChild) { node.insertBefore(c.firstChild, c); } node.removeChild(c); }
				} else if (c.nodeType === 8) { node.removeChild(c); }
			});
		})(tmp);
		return tmp.innerHTML;
	};

	/* ── load / serialize ── */
	Editor.prototype.setHTML = function (html) {
		if (this.sourceMode) { this.source.value = html || ''; return; }
		var tmp = elm('div', null, html || '');
		var frag = document.createDocumentFragment();
		var self = this;
		Array.prototype.slice.call(tmp.childNodes).forEach(function (node) {
			if (node.nodeType === 3) { if (node.textContent.trim() !== '') { frag.appendChild(document.createTextNode(node.textContent)); } return; }
			if (node.nodeType !== 1) { return; }
			if (isIslandEl(node)) { frag.appendChild(self._makeIsland(node.outerHTML)); }
			else { frag.appendChild(node); }
		});
		this.surface.innerHTML = '';
		this.surface.appendChild(frag);
		if (!this.surface.firstChild) { this.surface.appendChild(document.createElement('br')); }
		this._ensureSeparators();       // so the caret can always land between / around component islands
		this.lastRange = null;          // any saved range points at the old (now-detached) DOM
		this.updateEmpty();
	};

	// Two adjacent contenteditable=false islands (or an island at the very start/end) leave nowhere for the
	// caret to go between them. Insert an empty editable paragraph in those gaps — it's a pure editing
	// affordance (empty <p>s are dropped by getHTML, and re-created on load), and once you type in it the
	// text is kept.
	Editor.prototype._ensureSeparators = function () {
		var s = this.surface;
		function isl(n) { return n && n.nodeType === 1 && n.hasAttribute('data-bsp-island'); }
		function mk() { var p = document.createElement('p'); p.appendChild(document.createElement('br')); return p; }
		if (isl(s.firstChild)) { s.insertBefore(mk(), s.firstChild); }
		if (isl(s.lastChild)) { s.appendChild(mk()); }
		var c = s.firstChild;
		while (c) {
			if (isl(c) && isl(c.nextSibling)) { s.insertBefore(mk(), c.nextSibling); }
			c = c.nextSibling;
		}
	};

	Editor.prototype.getHTML = function () {
		if (this.sourceMode) { return this.source.value.trim(); }
		var clone = this.surface.cloneNode(true);
		Array.prototype.slice.call(clone.querySelectorAll('[data-bsp-island]')).forEach(function (isl) {
			var body = isl.querySelector('.bsprose-island-body');
			var holder = elm('div', null, body ? body.innerHTML : '');
			var f = document.createDocumentFragment();
			while (holder.firstChild) { f.appendChild(holder.firstChild); }
			isl.parentNode.replaceChild(f, isl);
		});
		Array.prototype.slice.call(clone.querySelectorAll('*')).forEach(function (n) {
			n.removeAttribute('contenteditable');
			n.removeAttribute('spellcheck');
			if (n.hasAttribute('data-list')) { n.removeAttribute('data-list'); }
			Array.prototype.slice.call(n.attributes).forEach(function (a) { if (a.name.indexOf('data-bsp') === 0) { n.removeAttribute(a.name); } });
		});
		// Unwrap attribute-less spans (e.g., after a color was removed).
		Array.prototype.slice.call(clone.querySelectorAll('span')).forEach(function (s) {
			if (!s.attributes.length) { while (s.firstChild) { s.parentNode.insertBefore(s.firstChild, s); } s.remove(); }
		});
		// Drop empty paragraphs / <p><br></p> noise (paragraphs with media are kept).
		Array.prototype.slice.call(clone.querySelectorAll('p')).forEach(function (p) {
			if (p.textContent.trim() === '' && !p.querySelector('img,iframe,svg,video,audio')) { p.remove(); }
		});
		var html = this._tidy(clone.innerHTML);
		if (html.replace(/<br\s*\/?>/gi, '').trim() === '') { return ''; }   // only <br>/whitespace ⇒ empty
		return html;
	};
	Editor.prototype._tidy = function (html) {
		return html.replace(/&nbsp;/g, ' ').replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').replace(/(\r?\n){3,}/g, '\n\n').trim();
	};

	/* ── source toggle ── */
	Editor.prototype._toggleSource = function (b) {
		this.setSourceMode(!this.sourceMode);
		if (b) { b.classList.toggle('active', this.sourceMode); }
	};
	Editor.prototype.setSourceMode = function (on) {
		if (on === this.sourceMode) { return; }
		if (on) {
			this.source.value = this.getHTML();
			this.sourceMode = true;
			this.surface.classList.add('d-none');
			this.source.classList.remove('d-none');
			this._tbDisable(true);
		} else {
			this.sourceMode = false;
			this.setHTML(this.source.value);
			this.source.classList.add('d-none');
			this.surface.classList.remove('d-none');
			this._tbDisable(false);
			this._commit();                 // snapshot whatever was hand-edited in source mode
		}
	};
	Editor.prototype._tbDisable = function (off) {
		var self = this;
		this.tb.querySelectorAll('button').forEach(function (b) { if (b !== self.srcBtn) { b.disabled = off; } });
	};

	/* ── change + undo/redo history ──
	   _afterEdit = debounced (coalesces typing into one snapshot); _commit = immediate (discrete actions). */
	Editor.prototype._afterEdit = function () { this._changed(false); };
	Editor.prototype._commit = function () { this._changed(true); };
	Editor.prototype._changed = function (immediate) {
		var self = this;
		if (immediate) { this._ensureSeparators(); }   // discrete ops may have left two islands adjacent
		this.updateEmpty();
		clearTimeout(this._t);
		var run = function () { var html = self.getHTML(); self._pushHistory(html); self.emit('change', html); };
		if (immediate) { run(); } else { this._t = setTimeout(run, 150); }
	};
	Editor.prototype._pushHistory = function (html) {
		if (html == null) { html = this.getHTML(); }
		if (this.history[this.histIndex] === html) { return; }            // no-op edits don't pile up
		this.history = this.history.slice(0, this.histIndex + 1);          // drop any redo tail
		this.history.push(html);
		if (this.history.length > this.histLimit) { this.history.shift(); }
		this.histIndex = this.history.length - 1;
	};
	Editor.prototype.undo = function () {
		if (this.sourceMode) { return; }
		clearTimeout(this._t);                                 // flush any pending (debounced) edit first…
		var cur = this.getHTML();
		if (this.history[this.histIndex] !== cur) { this._pushHistory(cur); }   // …so it becomes an undoable step
		if (this.histIndex <= 0) { return; }
		this.histIndex--;
		this._restoreHistory(this.history[this.histIndex]);
	};
	Editor.prototype.redo = function () {
		if (this.sourceMode) { return; }
		clearTimeout(this._t);
		if (this.histIndex >= this.history.length - 1) { return; }
		this.histIndex++;
		this._restoreHistory(this.history[this.histIndex]);
	};
	Editor.prototype._restoreHistory = function (html) {
		clearTimeout(this._t);                 // cancel any pending snapshot so it can't clobber the redo tail
		this.setHTML(html);                    // rebuilds islands (with fresh handlers) from the snapshot
		this.emit('change', html);             // keep the host's hidden field in sync
		this.focus();
	};
	Editor.prototype.updateEmpty = function () {
		var empty = this.surface.textContent.trim() === '' && !this.surface.querySelector('img,[data-bsp-island],iframe,hr,table');
		if (empty) { this.surface.setAttribute('data-empty', '1'); } else { this.surface.removeAttribute('data-empty'); }
	};
	Editor.prototype.focus = function () { this.surface.focus(); };
	Editor.prototype.isSourceMode = function () { return this.sourceMode; };
	Editor.prototype.on = function (evt, fn) { (this.handlers[evt] = this.handlers[evt] || []).push(fn); return this; };
	Editor.prototype.emit = function (evt, arg) { (this.handlers[evt] || []).forEach(function (fn) { fn(arg); }); };
	Editor.prototype.destroy = function () { this.host.classList.remove('bsprose'); this.host.innerHTML = ''; this.handlers = {}; };

	/* ───────────────────────── public API ───────────────────────── */
	global.BsProse = {
		create: function (host, opts) { return new Editor(host, opts); },
		imageUrl: imageUrl,
		imageUpload: imageUpload,
		components: DEFAULT_COMPONENTS,
		version: '1.2.4'
	};
})(window);
