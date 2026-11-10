import { renderPlaceholderSvg } from './placeholder-image.renderer';

describe('renderPlaceholderSvg', () => {
  it('embeds the caption in an svg document', () => {
    expect(renderPlaceholderSvg('Rust')).toMatch(/^<svg[^>]*>.*>Rust<\/text><\/svg>$/);
  });

  it('escapes markup in the caption', () => {
    expect(renderPlaceholderSvg('<b>&')).toContain('&#60;b&#62;&#38;');
  });
});
