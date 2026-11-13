import { pathToFileURL } from 'url';
import { CurvePoint, confusionTable, escapeHtml, percent, trainingCurveSvg } from './lab-charts';
import { Evaluation } from './lab-evaluation';
import { LabExperiment } from './lab-experiment';
import { RunSummary } from './run-history';

export interface LabReportInput {
  experiment: LabExperiment;
  evaluation: Evaluation;
  trainCounts: Record<string, number>;
  loss: CurvePoint[];
  testAccuracy: CurvePoint[];
  history: RunSummary[];
  seconds: number;
  nameOf: (code: string) => string;
}

const STYLE = `
:root{--bg:#f7f7f4;--card:#fff;--ink:#1d1f1c;--muted:#686c64;--line:#e3e4de;--accent:#2f7d4f;--loss:#c26a2e;--miss:#c0392b}
@media (prefers-color-scheme:dark){:root{--bg:#141613;--card:#1d201c;--ink:#e9eae5;--muted:#9a9e95;--line:#30342e;--accent:#5fbf85;--loss:#e59a5f;--miss:#ff7b6b}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:1040px;margin:0 auto;padding:24px 16px 64px}h1{font-size:24px;margin:0 0 4px}h2{font-size:17px;margin:32px 0 8px}
.muted{color:var(--muted)}.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;overflow-x:auto}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:16px}
.tile b{display:block;font-size:26px;font-variant-numeric:tabular-nums}.tile span{color:var(--muted);font-size:13px}
table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}td,th{padding:6px 8px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
th:first-child,td:first-child{text-align:left}.bar{display:inline-block;height:8px;border-radius:4px;background:var(--accent);vertical-align:middle;margin-right:6px}
svg{width:100%;height:auto}.grid{stroke:var(--line)}.axis{fill:var(--muted);font-size:11px}.line{fill:none;stroke-width:2}.loss{stroke:var(--loss)}.acc{stroke:var(--accent)}
.legend span{margin-right:16px}.legend i{display:inline-block;width:12px;height:3px;vertical-align:middle;margin-right:6px}
.confusion td{text-align:center;min-width:34px}.confusion td.hit{background:color-mix(in srgb,var(--accent) calc(var(--a)*100%),transparent)}
.confusion td.miss{background:color-mix(in srgb,var(--miss) calc(var(--a)*100%),transparent)}.confusion th.row{text-align:left;font-weight:normal}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}.gallery figure{margin:0}
.gallery img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;background:var(--line)}.gallery figcaption{font-size:12px;color:var(--muted)}
details{margin-top:8px}ul{padding-left:20px}`;

function tiles(input: LabReportInput): string {
  const trainTotal = Object.values(input.trainCounts).reduce((sum, n) => sum + n, 0);
  const tile = (value: string, label: string) => `<div class="card tile"><b>${value}</b><span>${label}</span></div>`;
  return `<div class="tiles">${tile(percent(input.evaluation.accuracy), 'Точність (перша відповідь)')}`
    + `${tile(percent(input.evaluation.top3Accuracy), 'Правильна в топ-3')}${tile(input.evaluation.macroF1.toFixed(3), 'Macro F1 (усі класи порівну)')}`
    + `${tile(String(trainTotal), 'Фото для навчання')}${tile(String(input.evaluation.total), 'Фото для перевірки')}`
    + `${tile(`${Math.round(input.seconds)} с`, 'Тривалість запуску')}</div>`;
}

function classTable(input: LabReportInput): string {
  const rows = [...input.evaluation.perClass].sort((a, b) => a.f1 - b.f1).map((s) => `<tr><td>${escapeHtml(input.nameOf(s.code))}</td>`
    + `<td>${input.trainCounts[s.code] ?? 0}</td><td>${s.support}</td><td>${percent(s.precision)}</td>`
    + `<td><span class="bar" style="width:${Math.round(s.recall * 80)}px"></span>${percent(s.recall)}</td><td>${s.f1.toFixed(3)}</td></tr>`).join('');
  return `<table><thead><tr><th>Клас (найслабші зверху)</th><th>Навч.</th><th>Перев.</th><th>Точність</th><th>Повнота</th><th>F1</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function historyTable(history: RunSummary[]): string {
  const rows = [...history].reverse().map((run) => `<tr><td>${escapeHtml(run.finishedAt.slice(0, 16).replace('T', ' '))}</td>`
    + `<td>${escapeHtml(run.name)}</td><td>${escapeHtml(run.embedderModel)} (${run.embedderDtype})</td><td>${run.classes}</td>`
    + `<td>${run.trainPhotos}</td><td>${percent(run.accuracy)}</td><td>${percent(run.top3Accuracy)}</td><td>${run.macroF1.toFixed(3)}</td></tr>`).join('');
  return `<table><thead><tr><th>Коли</th><th>Експеримент</th><th>Модель</th><th>Класів</th><th>Навч.</th><th>Точність</th><th>Топ-3</th><th>F1</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function mistakesGallery(input: LabReportInput): string {
  if (!input.evaluation.mistakes.length) return '<p class="muted">Помилок немає.</p>';
  return `<div class="gallery">${input.evaluation.mistakes.map((m) => `<figure><img src="${pathToFileURL(m.file).href}" alt="">`
    + `<figcaption>Насправді: <b>${escapeHtml(input.nameOf(m.actual))}</b><br>Модель: ${escapeHtml(input.nameOf(m.predicted))} (${percent(m.confidence)})`
    + `<br>${escapeHtml(m.source)}</figcaption></figure>`).join('')}</div>`;
}

const HOW_TO_READ = `<details class="card"><summary><b>Як читати цей звіт</b></summary><ul>
<li><b>Навчання</b>: модель-основа перетворює кожне фото на вектор ознак (числа, що описують вигляд). Поверх них вчиться класифікатор: які ознаки означають яку хворобу.</li>
<li><b>Перевірка</b>: частина фото відкладена і не бере участі в навчанні. Усі цифри рахуються саме на них, тобто так модель поведеться на нових фото.</li>
<li><b>Крива навчання</b>: помилка (оранжева) має падати, точність на перевірці (зелена) рости. Якщо зелена почала падати, а оранжева далі падає — модель «зазубрює» навчальні фото (перенавчання).</li>
<li><b>Точність</b> — частка фото, де класифікатор правильно назвав хворобу. <b>Повнота</b> — частка фото цієї хвороби, які модель знайшла. Низька повнота = хворобу часто пропускає.</li>
<li><b>Таблиця плутанини</b>: рядок — що було насправді, стовпчик — що відповіла модель. Діагональ (зелена) — влучання, червоні клітинки — з чим плутає.</li>
<li><b>Що покращує результат</b>: більше польових фото слабких класів, сильніша модель-основа, фото з різних джерел.</li></ul></details>`;

/** Self-contained HTML page for one lab run; photos are linked from disk, not embedded. */
export function renderLabReport(input: LabReportInput): string {
  const { experiment, evaluation } = input;
  return `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Лабораторія: ${escapeHtml(experiment.name)}</title><style>${STYLE}</style></head><body><main>
<h1>Тренування: ${escapeHtml(experiment.name)}</h1>
<div class="muted">${escapeHtml(experiment.embedder.model)} (${experiment.embedder.dtype}) · ${evaluation.classes.length} класів · ${experiment.training.epochs} епох · ${new Date().toLocaleString('uk-UA')}</div>
${tiles(input)}
<h2>Як модель вчилась</h2><div class="card"><div class="legend muted"><span><i style="background:var(--loss)"></i>Помилка на навчальних фото (ліва шкала)</span><span><i style="background:var(--accent)"></i>Точність на перевірочних фото (права шкала)</span></div>
${trainingCurveSvg(input.loss, input.testAccuracy)}</div>
<h2>Результат по кожному класу</h2><div class="card">${classTable(input)}</div>
<h2>З чим модель плутає</h2><div class="card">${confusionTable(evaluation.classes, evaluation.confusion, input.nameOf)}</div>
<h2>По джерелах даних</h2><div class="card"><table><thead><tr><th>Датасет</th><th>Фото</th><th>Точність</th></tr></thead><tbody>
${evaluation.perSource.map((s) => `<tr><td>${escapeHtml(s.source)}</td><td>${s.total}</td><td>${percent(s.accuracy)}</td></tr>`).join('')}</tbody></table></div>
<h2>Усі запуски</h2><div class="card">${historyTable(input.history)}</div>
<h2>Найвпевненіші помилки</h2>${mistakesGallery(input)}
<h2>Довідка</h2>${HOW_TO_READ}
</main></body></html>`;
}
