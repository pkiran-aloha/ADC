// Small, dependency-free statistics used by the visual-analysis and modeling tools.
// Every function is pure and tolerates empty input (returning null rather than NaN).

export const sum = values => values.reduce((total, value) => total + value, 0);

export function mean(values) {
  return values.length ? sum(values) / values.length : null;
}

export function quantile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

export const median = values => quantile(values, 0.5);

export function sampleSd(values) {
  if (values.length < 2) return values.length ? 0 : null;
  const average = mean(values);
  return Math.sqrt(sum(values.map(value => (value - average) ** 2)) / (values.length - 1));
}

export function round(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

// Ordinary least squares on {x, y} points, with what a prediction interval needs.
export function linearRegression(points) {
  const n = points.length;
  if (n < 2) return null;
  const xMean = mean(points.map(point => point.x));
  const yMean = mean(points.map(point => point.y));
  const sxx = sum(points.map(point => (point.x - xMean) ** 2));
  if (sxx === 0) return null;
  const sxy = sum(points.map(point => (point.x - xMean) * (point.y - yMean)));
  const slope = sxy / sxx;
  const intercept = yMean - slope * xMean;
  const residuals = points.map(point => point.y - (intercept + slope * point.x));
  const sse = sum(residuals.map(value => value ** 2));
  const sst = sum(points.map(point => (point.y - yMean) ** 2));
  const residualSd = n > 2 ? Math.sqrt(sse / (n - 2)) : 0;
  return { slope, intercept, n, xMean, sxx, residualSd, r2: sst > 0 ? 1 - sse / sst : 1,
    predict: x => intercept + slope * x };
}

// Abramowitz & Stegun 7.1.26 (|error| < 1.5e-7).
export function normalCdf(z) {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

// Acklam's rational approximation of the inverse normal CDF.
export function normalQuantile(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - low) return -normalQuantile(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

// Cornish-Fisher expansion of Student's t quantile; accurate to ~0.01 for df >= 3.
export function tQuantile(p, df) {
  const z = normalQuantile(p);
  if (!Number.isFinite(df) || df > 200) return z;
  const g1 = (z ** 3 + z) / 4;
  const g2 = (5 * z ** 5 + 16 * z ** 3 + 3 * z) / 96;
  const g3 = (3 * z ** 7 + 19 * z ** 5 + 17 * z ** 3 - 15 * z) / 384;
  return z + g1 / df + g2 / df ** 2 + g3 / df ** 3;
}

function logChoose(n, k) {
  let value = 0;
  for (let index = 1; index <= k; index++) value += Math.log(n - k + index) - Math.log(index);
  return value;
}

// P(X >= k) for X ~ Binomial(n, p): the one-tailed test used by the dual-criterion methods.
export function binomialUpperTail(k, n, p = 0.5) {
  if (k <= 0) return 1;
  if (k > n) return 0;
  let total = 0;
  for (let value = k; value <= n; value++) {
    total += Math.exp(logChoose(n, value) + value * Math.log(p) + (n - value) * Math.log(1 - p));
  }
  return Math.min(1, total);
}

// Smallest k with P(X >= k) < alpha (Fisher, Kelley & Lomas, 2003, Table 1 uses alpha = .05).
export function binomialCriticalCount(n, alpha = 0.05, p = 0.5) {
  for (let k = 0; k <= n; k++) if (binomialUpperTail(k, n, p) < alpha) return k;
  return null;
}

export function poissonQuantile(lambda, q) {
  if (!(lambda > 0)) return 0;
  let k = 0;
  let probability = Math.exp(-lambda);
  let cumulative = probability;
  // Large means: normal approximation keeps the loop bounded.
  if (lambda > 400) return Math.max(0, Math.round(lambda + normalQuantile(q) * Math.sqrt(lambda)));
  while (cumulative < q && k < 10000) {
    k += 1;
    probability *= lambda / k;
    cumulative += probability;
  }
  return k;
}

// Solve (A) x = b for small symmetric positive-definite systems (Gaussian elimination
// with partial pivoting); returns null when the system is singular.
export function solveLinear(matrix, vector) {
  const n = vector.length;
  const a = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < n; column++) {
    let pivot = column;
    for (let row = column + 1; row < n; row++) if (Math.abs(a[row][column]) > Math.abs(a[pivot][column])) pivot = row;
    if (Math.abs(a[pivot][column]) < 1e-12) return null;
    [a[column], a[pivot]] = [a[pivot], a[column]];
    for (let row = 0; row < n; row++) {
      if (row === column) continue;
      const factor = a[row][column] / a[column][column];
      for (let index = column; index <= n; index++) a[row][index] -= factor * a[column][index];
    }
  }
  return a.map((row, index) => row[n] / row[index]);
}

export function invertMatrix(matrix) {
  const n = matrix.length;
  const columns = [];
  for (let column = 0; column < n; column++) {
    const unit = Array.from({ length: n }, (_, index) => (index === column ? 1 : 0));
    const solved = solveLinear(matrix, unit);
    if (!solved) return null;
    columns.push(solved);
  }
  return Array.from({ length: n }, (_, row) => columns.map(column => column[row]));
}

// Mann-Whitney area under the ROC curve; ties count half.
export function areaUnderCurve(scores, labels) {
  const positives = [];
  const negatives = [];
  scores.forEach((score, index) => (labels[index] ? positives : negatives).push(score));
  if (!positives.length || !negatives.length) return null;
  let wins = 0;
  for (const positive of positives) {
    for (const negative of negatives) wins += positive > negative ? 1 : positive === negative ? 0.5 : 0;
  }
  return wins / (positives.length * negatives.length);
}

export function brierScore(probabilities, labels) {
  if (!probabilities.length) return null;
  return mean(probabilities.map((probability, index) => (probability - (labels[index] ? 1 : 0)) ** 2));
}

export function dayNumber(date) {
  return Math.round(new Date(`${date.slice(0, 10)}T12:00:00Z`).getTime() / 86400000);
}

export function addDays(date, days) {
  const value = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
