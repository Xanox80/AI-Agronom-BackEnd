import { confusionTable, escapeHtml, percent, trainingCurveSvg } from './lab-charts';

describe('lab-charts', () => {
  it('draws one path for the loss and one for the accuracy', () => {
    expect(trainingCurveSvg([{ epoch: 1, value: 1 }, { epoch: 2, value: 0.5 }], [{ epoch: 2, value: 0.5 }]).match(/<path/g)).toHaveLength(2);
  });

  it('leaves out classes with no test photos from the confusion rows', () => {
    const html = confusionTable(['a', 'b'], [[1, 0], [0, 0]], (code) => code);
    expect(html.match(/<tr>/g)).toHaveLength(2);
    expect(html).toContain('1. a');
    expect(html).not.toContain('2. b');
  });

  it('formats shares and escapes markup', () => {
    expect(percent(0.9234)).toBe('92.3%');
    expect(escapeHtml('<a href="x">&')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;');
  });
});
