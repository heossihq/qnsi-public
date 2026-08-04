#!/usr/bin/env node
/**
 * Generates the marketplace icon (media/icon.png, 128×128) - a real, reproducible asset:
 * a navy tile with a teal security shield and a white keyhole (QNSI = quantum-safe security).
 * Draws at 2× and box-downsamples for anti-aliasing, writes a 24-bit BMP, then converts to PNG
 * with the macOS `sips` tool (avoids a heavy raster dependency). Re-run: `node scripts/gen-icon.mjs`.
 */
import { execFileSync } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const N = 128;
const SS = 3; // supersample factor
const BG = [11, 18, 32]; // navy
const SHIELD = [45, 212, 191]; // teal
const KEY = [11, 18, 32]; // keyhole punched back to bg color (reads as cut-out)

const cx = 64;
const top = 22;
const shoulder = 70;
const tip = 109;
const halfW = 38;

function inShield(x, y) {
	if (y < top || y > tip) return false;
	let hw;
	if (y <= shoulder) {
		hw = halfW;
		// round the two top corners
		const cornerR = 12;
		if (y < top + cornerR) {
			const dy = top + cornerR - y;
			const edge = halfW - cornerR;
			const dx = Math.abs(x - cx) - edge;
			if (dx > 0 && dx * dx + dy * dy > cornerR * cornerR) return false;
		}
	} else {
		hw = (halfW * (tip - y)) / (tip - shoulder);
	}
	return Math.abs(x - cx) <= hw;
}

function inKeyhole(x, y) {
	const kcx = 64;
	const kcy = 56;
	const r = 12;
	if ((x - kcx) ** 2 + (y - kcy) ** 2 <= r * r) return true; // bow
	// blade (tapered stem)
	const sTop = 56;
	const sBot = 84;
	if (y >= sTop && y <= sBot) {
		const hw = 4 + (6 * (y - sTop)) / (sBot - sTop);
		return Math.abs(x - kcx) <= hw;
	}
	return false;
}

function colorAt(x, y) {
	if (inShield(x, y)) {
		return inKeyhole(x, y) ? KEY : SHIELD;
	}
	return BG;
}

// Supersampled render → box downsample to N×N RGB.
const rgb = new Uint8Array(N * N * 3);
for (let py = 0; py < N; py++) {
	for (let px = 0; px < N; px++) {
		let r = 0;
		let g = 0;
		let b = 0;
		for (let sy = 0; sy < SS; sy++) {
			for (let sx = 0; sx < SS; sx++) {
				const c = colorAt(px + (sx + 0.5) / SS, py + (sy + 0.5) / SS);
				r += c[0];
				g += c[1];
				b += c[2];
			}
		}
		const n = SS * SS;
		const i = (py * N + px) * 3;
		rgb[i] = Math.round(r / n);
		rgb[i + 1] = Math.round(g / n);
		rgb[i + 2] = Math.round(b / n);
	}
}

// 24-bit BMP (bottom-up, BGR, 4-byte row padding).
const rowSize = Math.ceil((N * 3) / 4) * 4;
const pixelArraySize = rowSize * N;
const fileSize = 54 + pixelArraySize;
const bmp = Buffer.alloc(fileSize);
bmp.write("BM", 0, "ascii");
bmp.writeUInt32LE(fileSize, 2);
bmp.writeUInt32LE(54, 10); // pixel data offset
bmp.writeUInt32LE(40, 14); // DIB header size
bmp.writeInt32LE(N, 18);
bmp.writeInt32LE(N, 22);
bmp.writeUInt16LE(1, 26); // planes
bmp.writeUInt16LE(24, 28); // bpp
bmp.writeUInt32LE(pixelArraySize, 34);
for (let py = 0; py < N; py++) {
	const srcRow = N - 1 - py; // bottom-up
	let off = 54 + py * rowSize;
	for (let px = 0; px < N; px++) {
		const i = (srcRow * N + px) * 3;
		bmp[off++] = rgb[i + 2]; // B
		bmp[off++] = rgb[i + 1]; // G
		bmp[off++] = rgb[i]; // R
	}
}

const here = fileURLToPath(new URL(".", import.meta.url));
const bmpPath = `${here}../media/icon.bmp`;
const pngPath = `${here}../media/icon.png`;
writeFileSync(bmpPath, bmp);
execFileSync("sips", ["-s", "format", "png", bmpPath, "--out", pngPath], { stdio: "ignore" });
unlinkSync(bmpPath);
console.log(`wrote ${pngPath} (128x128 PNG)`);
