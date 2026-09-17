function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Relación de contraste WCAG 2.x entre dos colores #RRGGBB.
export function contrastRatio(hexA: string, hexB: string): number {
  const [light, dark] = [relativeLuminance(hexA), relativeLuminance(hexB)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}
