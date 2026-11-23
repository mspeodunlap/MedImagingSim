// Original mixed-radix DFT. Supports the encoded 64/96/128 matrices plus arbitrary
// oversampling line counts; prime leaf sizes use the direct DFT definition.
const roots = new Map();
function transform(input, inverse = false) {
  const n = input.length / 2;
  if (n === 1) return input.slice();
  let radix = 2;
  while (radix < n && n % radix) radix++;
  const size = n / radix, parts = [];
  if (radix < n) for (let j = 0; j < radix; j++) {
    const part = new Float64Array(size * 2);
    for (let i = 0; i < size; i++) { part[2 * i] = input[2 * (i * radix + j)]; part[2 * i + 1] = input[2 * (i * radix + j) + 1]; }
    parts.push(transform(part, inverse));
  }
  if (!roots.has(n)) roots.set(n, Array.from({ length: n }, (_, k) => [Math.cos(2 * Math.PI * k / n), Math.sin(2 * Math.PI * k / n)]));
  const twiddle = roots.get(n), output = new Float64Array(n * 2), sign = inverse ? 1 : -1;
  for (let k = 0; k < n; k++) for (let j = 0; j < radix; j++) {
    const [cos, positiveSin] = twiddle[(j * k) % n], sin = sign * positiveSin;
    const source = radix === n ? input : parts[j], at = radix === n ? 2 * j : 2 * (k % size);
    output[2 * k] += source[at] * cos - source[at + 1] * sin;
    output[2 * k + 1] += source[at] * sin + source[at + 1] * cos;
  }
  return output;
}

export function echoWeight(k, n, train, spacing, t2) {
  // Each echo fills a symmetric band over successive shots; the first echo
  // samples central k-space at effective TE. Outer bands decay for longer.
  const echo = Math.min(train - 1, Math.floor(2 * Math.min(k, n - k) * train / n));
  return Math.exp(-echo * spacing / t2);
}

export function filterPhase(pixels, rows, columns, horizontal, train, spacing, t2) {
  const n = horizontal ? columns : rows, lines = horizontal ? rows : columns;
  const weights = Array.from({ length: n }, (_, k) => echoWeight(k, n, train, spacing, t2));
  for (let line = 0; line < lines; line++) {
    const indices = Array.from({ length: n }, (_, k) => horizontal ? line * columns + k : k * columns + line);
    const data = new Float64Array(n * 2);
    indices.forEach((at, k) => { data[2 * k] = pixels[at]; });
    const spectrum = transform(data);
    weights.forEach((weight, k) => { spectrum[2 * k] *= weight; spectrum[2 * k + 1] *= weight; });
    const result = transform(spectrum, true);
    indices.forEach((at, k) => { pixels[at] = result[2 * k] / n; });
  }
}
