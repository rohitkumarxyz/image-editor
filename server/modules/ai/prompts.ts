export function editPrompt(oldText: string, newText: string, color?: string, fontHint?: string): string {
  const task = oldText
    ? `Replace the text "${oldText}" in the transparent mask area with the text "${newText}".`
    : `Write the text "${newText}" in the transparent mask area, matching the nearby lettering.`
  return [
    task,
    'Match the original lettering exactly: same font and letter shapes, weight, size, colour, letter spacing, baseline angle, stroke texture and edge softness.',
    'Copy the style of the old text inside the mask only. Nearby text outside the mask may use a different font or colour; do not take its style.',
    ...(color ? [`The old text colour is about ${color}; keep the new text that colour.`] : []),
    ...(fontHint
      ? [`The old lettering looks like the font "${fontHint}". Keep exactly that type style; never switch between sans-serif, serif and script styles.`]
      : []),
    'Keep the same letter height as the old text, start at the same position and follow the same baseline. The new text must fit completely inside the masked area.',
    'If the new text is longer than the old text, use the extra space in the mask; keep the same letter size and do not squeeze the letters.',
    'Rebuild the background behind the new text so it is seamless with its surroundings.',
    'Do not change anything outside the masked area. No extra text, no borders, no new objects.',
  ].join(' ')
}

export function detectPrompt(width: number, height: number): string {
  return [
    'Find every piece of readable text in this image, including decorative, handwritten, brush, script, tilted, curved and very small text.',
    'Return one entry per word, with the exact characters as written.',
    `For each word give a tight bounding box in pixel coordinates of this image (${width} wide, ${height} tall):`,
    'x0,y0 is the top-left and x1,y1 the bottom-right, covering all of the word ink including ascenders, descenders and slanted strokes.',
    'Ignore textures, plants or shapes that only look like letters.',
  ].join(' ')
}
