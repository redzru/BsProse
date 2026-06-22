<?php
/**
 * BsProse — generic drop-in image upload endpoint (companion to bsprose.js `BsProse.imageUpload`).
 * ----------------------------------------------------------------------------------------------
 * Framework-free. Accepts a multipart file, validates it, stores it under a public directory, and
 * returns JSON the editor can insert: { "ok": true, "src": "/path.jpg", "width": 800, "height": 600 }
 * With $CONFIG['responsive'] = true it also emits resized WebP variants via GD and returns a `srcset`.
 *
 * On error: { "ok": false, "error": "too_large" } (HTTP 200; the JS reads `ok`/`error`)
 *
 * THIS FILE HAS NO AUTH. It is a portable reference you copy into a project and adapt. Before using it
 * on a real site, add your own authentication + CSRF check in the marked block below — otherwise anyone
 * can upload. On REDZ.BUILD the admin editor does NOT use this file; it posts to /site/ajax.Media.php
 * (CSRF-guarded, writes to the media library). Keep this plugin for other projects / standalone use.
 *
 * @version 1.0.0
 * @license MIT
 */

declare(strict_types=1);

// ─────────────────────────────── configuration ───────────────────────────────
// Edit these for your project. Paths are filesystem (dir) + public URL prefix (url).
$CONFIG = [
	'dir'        => __DIR__ . '/uploads',   // filesystem directory to write into (must be writable)
	'url'        => '/uploads',             // public URL prefix that maps to `dir`
	'field'      => 'file',                 // multipart field name (matches imageUpload fieldName)
	'max_bytes'  => 15 * 1024 * 1024,       // hard size limit
	'allowed'    => ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'],
	'responsive' => false,                  // true → generate WebP variants + srcset (needs GD with WebP)
	'widths'     => [480, 960, 1440],       // variant widths when responsive (never upscaled)
	'quality'    => 82,
];

// ─────────────────────────────── plumbing ───────────────────────────────
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

/** Emit a JSON response and stop. */
function bsp_out(array $data): never {
	echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
	exit;
}

// ───────────────── AUTH / CSRF — ADD YOUR OWN CHECK HERE ─────────────────
// Example:
//   session_start();
//   if (($_POST['csrf'] ?? '') !== ($_SESSION['csrf'] ?? '~')) { bsp_out(['ok' => false, 'error' => 'csrf']); }
//   if (empty($_SESSION['user'])) { bsp_out(['ok' => false, 'error' => 'auth']); }
// ─────────────────────────────────────────────────────────────────────────

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
	bsp_out(['ok' => false, 'error' => 'method_not_allowed']);
}

$file = $_FILES[$CONFIG['field']] ?? null;
if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file((string)$file['tmp_name'])) {
	bsp_out(['ok' => false, 'error' => 'no_file']);
}
if ((int)$file['size'] > $CONFIG['max_bytes']) {
	bsp_out(['ok' => false, 'error' => 'too_large']);
}

$info = @getimagesize((string)$file['tmp_name']);
if ($info === false) {
	bsp_out(['ok' => false, 'error' => 'not_image']);
}
$mime = (string)($info['mime'] ?? '');
if (!isset($CONFIG['allowed'][$mime])) {
	bsp_out(['ok' => false, 'error' => 'bad_type']);
}

$dir = rtrim($CONFIG['dir'], '/');
if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
	bsp_out(['ok' => false, 'error' => 'no_dir']);
}

$ext  = $CONFIG['allowed'][$mime];
$base = substr((string)sha1_file((string)$file['tmp_name']), 0, 16);

// ─────────────── simple path: store the original as-is ───────────────
if ($CONFIG['responsive'] === false) {
	$name = $base . '.' . $ext;
	if (!@move_uploaded_file((string)$file['tmp_name'], $dir . '/' . $name)) {
		bsp_out(['ok' => false, 'error' => 'write_failed']);
	}
	bsp_out([
		'ok'     => true,
		'src'    => $CONFIG['url'] . '/' . $name,
		'width'  => (int)($info[0] ?? 0),
		'height' => (int)($info[1] ?? 0),
		'class'  => 'img-fluid',
	]);
}

// ─────────────── responsive path: GD-resized WebP variants + srcset ───────────────
if (!function_exists('imagewebp') || !function_exists('imagecreatetruecolor')) {
	bsp_out(['ok' => false, 'error' => 'gd_missing']);
}

$srcW = (int)($info[0] ?? 0);
$srcH = (int)($info[1] ?? 0);
$src  = match ($mime) {
	'image/jpeg' => @imagecreatefromjpeg((string)$file['tmp_name']),
	'image/png'  => @imagecreatefrompng((string)$file['tmp_name']),
	'image/webp' => @imagecreatefromwebp((string)$file['tmp_name']),
	'image/gif'  => @imagecreatefromgif((string)$file['tmp_name']),
	default      => false,
};
if (!$src) {
	bsp_out(['ok' => false, 'error' => 'decode_failed']);
}

$widths = array_values(array_filter($CONFIG['widths'], static fn(int $w): bool => $srcW <= 0 || $w <= $srcW));
if ($widths === []) {
	$widths = [$srcW > 0 ? min($srcW, max($CONFIG['widths'])) : (int)end($CONFIG['widths'])];
}

$variants = [];
foreach ($widths as $w) {
	$h = $srcW > 0 ? (int)round($srcH * ($w / $srcW)) : $srcH;
	$dst = imagecreatetruecolor($w, max(1, $h));
	imagealphablending($dst, false);
	imagesavealpha($dst, true);
	imagecopyresampled($dst, $src, 0, 0, 0, 0, $w, max(1, $h), $srcW ?: $w, $srcH ?: $h);
	$name = $base . '-' . $w . '.webp';
	if (imagewebp($dst, $dir . '/' . $name, (int)$CONFIG['quality'])) {
		$variants[] = ['w' => $w, 'path' => $CONFIG['url'] . '/' . $name];
	}
}

if ($variants === []) {
	bsp_out(['ok' => false, 'error' => 'encode_failed']);
}

usort($variants, static fn(array $a, array $b): int => $a['w'] <=> $b['w']);
$largest = $variants[count($variants) - 1];
$srcset  = implode(', ', array_map(static fn(array $v): string => $v['path'] . ' ' . $v['w'] . 'w', $variants));

bsp_out([
	'ok'     => true,
	'src'    => $largest['path'],
	'srcset' => $srcset,
	'sizes'  => '(max-width: ' . $largest['w'] . 'px) 100vw, ' . $largest['w'] . 'px',
	'width'  => $largest['w'],
	'height' => $srcW > 0 ? (int)round($srcH * ($largest['w'] / $srcW)) : $srcH,
	'class'  => 'img-fluid rounded',
]);
