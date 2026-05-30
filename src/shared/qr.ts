import { escapeHtml } from "./html.js";

export function qrCodeSvg(value, title = "QR code") {
  try {
    return buildQrCodeSvg(value, title);
  } catch {
    return buildFallbackQrSvg(value, title);
  }
}

function buildFallbackQrSvg(value, title) {
  const size = 29;
  const modules = [];
  let hash = 2166136261;
  String(value).split("").forEach((character) => {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  });

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const inFinder = (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
      const finderRing = inFinder && (x % (size - 7) === 0 || y % (size - 7) === 0 || x % (size - 7) === 6 || y % (size - 7) === 6);
      const finderCenter = inFinder && x % (size - 7) >= 2 && x % (size - 7) <= 4 && y % (size - 7) >= 2 && y % (size - 7) <= 4;
      if (finderRing || finderCenter || (!inFinder && ((Math.imul(hash ^ (x * 31 + y * 17), 1103515245) >>> 27) & 1))) {
        modules.push(`<rect x="${x + 2}" y="${y + 2}" width="1" height="1"/>`);
      }
    }
  }

  return `
    <svg class="qr-code-svg" viewBox="0 0 ${size + 4} ${size + 4}" role="img" aria-label="${escapeHtml(title)}" xmlns="http://www.w3.org/2000/svg">
      <title>${escapeHtml(title)}</title>
      <rect width="${size + 4}" height="${size + 4}" fill="#fff"/>
      <g fill="#173d36">${modules.join("")}</g>
    </svg>
  `;
}

function buildQrCodeSvg(value, title) {
  const version = 6;
  const size = version * 4 + 17;
  const dataCodewords = 136;
  const blockDataCodewords = 68;
  const eccCodewords = 18;
  const mask = 0;
  const bytes = [...new TextEncoder().encode(String(value))];

  if (bytes.length > dataCodewords - 3) return buildFallbackQrSvg(value, title);

  const data = qrEncodeByteData(bytes, dataCodewords);
  const divisor = qrReedSolomonDivisor(eccCodewords);
  const blocks = [
    data.slice(0, blockDataCodewords),
    data.slice(blockDataCodewords, blockDataCodewords * 2)
  ];
  const eccBlocks = blocks.map((block) => qrReedSolomonRemainder(block, divisor));
  const codewords = [];

  for (let i = 0; i < blockDataCodewords; i += 1) {
    blocks.forEach((block) => codewords.push(block[i]));
  }
  for (let i = 0; i < eccCodewords; i += 1) {
    eccBlocks.forEach((block) => codewords.push(block[i]));
  }

  const modules = Array.from({ length: size }, () => Array(size).fill(false));
  const functions = Array.from({ length: size }, () => Array(size).fill(false));
  const setFunction = (x, y, dark) => {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    modules[y][x] = dark;
    functions[y][x] = true;
  };

  drawQrFunctionPatterns(version, size, setFunction);
  drawQrFormatBits(size, mask, setFunction);
  drawQrCodewords(size, modules, functions, codewords, mask);

  const rects = [];
  modules.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) rects.push(`<rect x="${x + 4}" y="${y + 4}" width="1" height="1"/>`);
    });
  });

  return `
    <svg class="qr-code-svg" viewBox="0 0 ${size + 8} ${size + 8}" role="img" aria-label="${escapeHtml(title)}" xmlns="http://www.w3.org/2000/svg">
      <title>${escapeHtml(title)}</title>
      <rect width="${size + 8}" height="${size + 8}" fill="#fff"/>
      <g fill="#173d36">${rects.join("")}</g>
    </svg>
  `;
}

function qrEncodeByteData(bytes, dataCodewords) {
  const bits = [];
  const pushBits = (value, length) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };

  pushBits(0x4, 4);
  pushBits(bytes.length, 8);
  bytes.forEach((byte) => pushBits(byte, 8));
  const terminator = Math.min(4, dataCodewords * 8 - bits.length);
  pushBits(0, terminator);
  while (bits.length % 8) bits.push(0);

  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(bits.slice(i, i + 8).reduce((byte, bit) => (byte << 1) | bit, 0));
  }
  for (let pad = 0; data.length < dataCodewords; pad += 1) {
    data.push(pad % 2 ? 0x11 : 0xec);
  }
  return data;
}

let qrReedSolomonTablesCache;

function qrReedSolomonTables() {
  if (qrReedSolomonTablesCache) return qrReedSolomonTablesCache;
  const exp = Array(255).fill(0);
  const log = Array(256).fill(0);
  let value = 1;
  for (let i = 0; i < 255; i += 1) {
    exp[i] = value;
    log[value] = i;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  qrReedSolomonTablesCache = { exp, log };
  return qrReedSolomonTablesCache;
}

function qrReedSolomonMultiply(first, second) {
  if (!first || !second) return 0;
  const { exp, log } = qrReedSolomonTables();
  return exp[(log[first] + log[second]) % 255];
}

function qrReedSolomonDivisor(degree) {
  const { exp } = qrReedSolomonTables();
  let result = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = Array(result.length + 1).fill(0);
    result.forEach((coefficient, index) => {
      next[index] ^= qrReedSolomonMultiply(coefficient, exp[i]);
      next[index + 1] ^= coefficient;
    });
    result = next;
  }
  return result.slice(0, degree);
}

function qrReedSolomonRemainder(data, divisor) {
  const result = Array(divisor.length).fill(0);
  data.forEach((byte) => {
    const factor = byte ^ result.shift();
    result.push(0);
    divisor.forEach((coefficient, index) => {
      result[index] ^= qrReedSolomonMultiply(coefficient, factor);
    });
  });
  return result;
}

function drawQrFunctionPatterns(version, size, setFunction) {
  const drawFinder = (left, top) => {
    for (let y = -1; y <= 7; y += 1) {
      for (let x = -1; x <= 7; x += 1) {
        const xx = left + x;
        const yy = top + y;
        const dark = x >= 0 && x <= 6 && y >= 0 && y <= 6
          && (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4));
        setFunction(xx, yy, dark);
      }
    }
  };
  const drawAlignment = (centerX, centerY) => {
    for (let y = -2; y <= 2; y += 1) {
      for (let x = -2; x <= 2; x += 1) {
        setFunction(centerX + x, centerY + y, Math.max(Math.abs(x), Math.abs(y)) !== 1);
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);
  for (let i = 8; i < size - 8; i += 1) {
    setFunction(i, 6, i % 2 === 0);
    setFunction(6, i, i % 2 === 0);
  }
  drawAlignment(34, 34);
  setFunction(8, version * 4 + 9, true);
}

function qrFormatBits(mask) {
  let data = (1 << 3) | mask;
  let bits = data << 10;
  const generator = 0x537;
  for (let i = 14; i >= 10; i -= 1) {
    if ((bits >>> i) & 1) bits ^= generator << (i - 10);
  }
  return ((data << 10) | bits) ^ 0x5412;
}

function drawQrFormatBits(size, mask, setFunction) {
  const bits = qrFormatBits(mask);
  const getBit = (index) => Boolean((bits >>> index) & 1);
  for (let i = 0; i <= 5; i += 1) setFunction(8, i, getBit(i));
  setFunction(8, 7, getBit(6));
  setFunction(8, 8, getBit(7));
  setFunction(7, 8, getBit(8));
  for (let i = 9; i < 15; i += 1) setFunction(14 - i, 8, getBit(i));
  for (let i = 0; i < 8; i += 1) setFunction(size - 1 - i, 8, getBit(i));
  for (let i = 8; i < 15; i += 1) setFunction(8, size - 15 + i, getBit(i));
  setFunction(8, size - 8, true);
}

function qrMask(mask, x, y) {
  if (mask === 0) return (x + y) % 2 === 0;
  return false;
}

function drawQrCodewords(size, modules, functions, codewords, mask) {
  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let vertical = 0; vertical < size; vertical += 1) {
      const upward = ((right + 1) & 2) === 0;
      const y = upward ? size - 1 - vertical : vertical;
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        if (functions[y][x]) continue;
        let dark = false;
        if (bitIndex < codewords.length * 8) {
          dark = Boolean((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1);
          bitIndex += 1;
        }
        modules[y][x] = qrMask(mask, x, y) ? !dark : dark;
      }
    }
  }
}
