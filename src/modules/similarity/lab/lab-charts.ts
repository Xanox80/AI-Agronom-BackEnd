export interface CurvePoint {
  epoch: number;
  value: number;
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

const WIDTH = 640;
const HEIGHT = 220;
const PAD = { left: 44, right: 44, top: 12, bottom: 28 };

function path(points: CurvePoint[], lastEpoch: number, top: number): string {
  const x = (epoch: number) => PAD.left + ((WIDTH - PAD.left - PAD.right) * epoch) / lastEpoch;
  const y = (value: number) => PAD.top + (HEIGHT - PAD.top - PAD.bottom) * (1 - value / top);
  return points.map((p, i) => `${i ? 'L' : 'M'}${x(p.epoch).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
}

/** Training loss (left axis, its own scale) and test accuracy (right axis, 0-100%) against the epoch. */
export function trainingCurveSvg(loss: CurvePoint[], accuracy: CurvePoint[]): string {
  const lastEpoch = Math.max(1, ...loss.map((p) => p.epoch));
  const maxLoss = Math.max(1e-9, ...loss.map((p) => p.value));
  const bottom = HEIGHT - PAD.bottom;
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const y = PAD.top + (bottom - PAD.top) * (1 - f);
    return `<line x1="${PAD.left}" x2="${WIDTH - PAD.right}" y1="${y}" y2="${y}" class="grid"/>`
      + `<text x="${PAD.left - 6}" y="${y + 4}" text-anchor="end" class="axis">${(maxLoss * f).toFixed(2)}</text>`
      + `<text x="${WIDTH - PAD.right + 6}" y="${y + 4}" class="axis">${Math.round(f * 100)}%</text>`;
  }).join('');
  const ticks = [0, 0.5, 1].map((f) => {
    const epoch = Math.round(lastEpoch * f);
    return `<text x="${PAD.left + (WIDTH - PAD.left - PAD.right) * f}" y="${HEIGHT - 8}" text-anchor="middle" class="axis">${epoch}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Крива навчання">${grid}${ticks}`
    + `<path d="${path(loss, lastEpoch, maxLoss)}" class="line loss"/>`
    + `<path d="${path(accuracy, lastEpoch, 1)}" class="line acc"/></svg>`;
}

/** Rows are the true class, columns the answer; cell shade is the share of that row. */
export function confusionTable(classes: string[], confusion: number[][], nameOf: (code: string) => string): string {
  const head = classes.map((code, c) => `<th title="${escapeHtml(nameOf(code))}">${c + 1}</th>`).join('');
  const body = classes.map((code, r) => {
    const total = confusion[r].reduce((sum, n) => sum + n, 0);
    if (!total) return '';
    const cells = confusion[r].map((n, c) => {
      const shade = n / total;
      const kind = r === c ? 'hit' : 'miss';
      return `<td class="${n ? kind : ''}" style="--a:${shade.toFixed(3)}">${n || ''}</td>`;
    }).join('');
    return `<tr><th class="row">${r + 1}. ${escapeHtml(nameOf(code))}</th>${cells}</tr>`;
  }).join('');
  return `<table class="confusion"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table>`;
}
