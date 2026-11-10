const SIZE_PX = 480;
const FONT_SIZE_PX = 22;
const BACKGROUND_COLOR = '#e8efe4';
const TEXT_COLOR = '#4b5d43';

const escapeXml = (text: string): string => text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Generated stand-in for a reference photo until a licensed one is uploaded. */
export function renderPlaceholderSvg(caption: string): string {
  const half = SIZE_PX / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE_PX}" height="${SIZE_PX}" viewBox="0 0 ${SIZE_PX} ${SIZE_PX}">`
    + `<rect width="100%" height="100%" fill="${BACKGROUND_COLOR}"/><text x="${half}" y="${half}" text-anchor="middle" font-family="sans-serif" font-size="${FONT_SIZE_PX}" fill="${TEXT_COLOR}">${escapeXml(caption)}</text></svg>`;
}
