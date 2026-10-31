// Oxfords PNG decoder. Zero dependencies (node:zlib). Enough for browser screenshots:
// 8-bit greyscale, grey + alpha, RGB and RGBA, non-interlaced, all five row filters.
// Returns { width, height, data } where data is RGBA bytes, row by row, top to bottom.

import { inflateSync } from 'node:zlib';

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 }; // colour type -> bytes per pixel at 8 bits

export function decodePng(buf) {
  if (!SIGNATURE.every((b, i) => buf[i] === b)) throw new Error('not a PNG');
  let pos = 8, width = 0, height = 0, depth = 0, type = -1, interlace = 0;
  const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const kind = buf.toString('latin1', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      depth = body[8]; type = body[9]; interlace = body[12];
    } else if (kind === 'IDAT') idat.push(body);
    else if (kind === 'IEND') break;
    pos += 12 + len; // length, type, body, crc
  }
  const ch = CHANNELS[type];
  if (depth !== 8 || !ch || interlace)
    throw new Error(`unsupported PNG: depth ${depth}, colour type ${type}, interlace ${interlace}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * ch;
  if (raw.length < (stride + 1) * height) throw new Error('PNG data is short');
  const px = Buffer.alloc(stride * height);

  // Undo the filter on each row. a = byte to the left, b = byte above, c = above-left.
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1, dst = y * stride, up = dst - stride;
    const above = x => (y ? px[up + x] : 0);
    switch (filter) {
      case 0: raw.copy(px, dst, src, src + stride); break;
      case 1: for (let x = 0; x < stride; x++) px[dst + x] = raw[src + x] + (x >= ch ? px[dst + x - ch] : 0); break;
      case 2: for (let x = 0; x < stride; x++) px[dst + x] = raw[src + x] + above(x); break;
      case 3:
        for (let x = 0; x < stride; x++)
          px[dst + x] = raw[src + x] + (((x >= ch ? px[dst + x - ch] : 0) + above(x)) >> 1);
        break;
      case 4:
        for (let x = 0; x < stride; x++) {
          const a = x >= ch ? px[dst + x - ch] : 0, b = above(x), c = x >= ch ? above(x - ch) : 0;
          const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          px[dst + x] = raw[src + x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
        }
        break;
      default: throw new Error(`bad PNG filter ${filter} on row ${y}`);
    }
  }
  // Buffer stores bytes mod 256, which is exactly the wrap-around the filters need.

  if (ch === 4) return { width, height, data: px };
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0, j = 0; j < out.length; i += ch, j += 4) {
    if (ch === 3) { out[j] = px[i]; out[j + 1] = px[i + 1]; out[j + 2] = px[i + 2]; out[j + 3] = 255; }
    else { out[j] = out[j + 1] = out[j + 2] = px[i]; out[j + 3] = ch === 2 ? px[i + 1] : 255; }
  }
  return { width, height, data: out };
}
