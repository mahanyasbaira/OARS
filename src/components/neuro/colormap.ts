/**
 * Hot colormap: maps a normalized value [0, 1] to an orange-red heatmap
 * matching the TRIBE v2 paper figures (gray → orange → red → white).
 */
export function hotColormap(t: number): [number, number, number] {
  const v = Math.max(0, Math.min(1, t))
  // Gray base → orange → red → bright
  let r: number, g: number, b: number
  if (v < 0.33) {
    const s = v / 0.33
    r = 0.2 + s * 0.8
    g = 0.2 + s * 0.3
    b = 0.2 - s * 0.1
  } else if (v < 0.66) {
    const s = (v - 0.33) / 0.33
    r = 1.0
    g = 0.5 - s * 0.2
    b = 0.1 - s * 0.05
  } else {
    const s = (v - 0.66) / 0.34
    r = 1.0
    g = 0.3 + s * 0.7
    b = 0.05 + s * 0.95
  }
  return [r, g, b]
}

/** Convert activation array to per-vertex color array (Float32Array) for BufferGeometry. */
export function activationsToColors(
  activations: number[],
  nVertices: number,
): Float32Array {
  const colors = new Float32Array(nVertices * 3)
  const min = Math.min(...activations)
  const max = Math.max(...activations)
  const range = max - min || 1

  for (let i = 0; i < nVertices; i++) {
    const raw = activations[i] ?? 0
    const t = (raw - min) / range
    const [r, g, b] = hotColormap(t)
    colors[i * 3]     = r
    colors[i * 3 + 1] = g
    colors[i * 3 + 2] = b
  }
  return colors
}

/** ROI color palette — one color per region, used in charts. */
export const ROI_COLORS: Record<string, string> = {
  visual_early:     '#f97316',
  visual_ventral:   '#fb923c',
  visual_dorsal:    '#fdba74',
  visual_mt:        '#fde68a',
  multisensory_tpj: '#a78bfa',
  auditory_early:   '#60a5fa',
  auditory_assoc:   '#93c5fd',
  inferior_frontal: '#34d399',
  vwfa:             '#6ee7b7',
  hippocampus:      '#f472b6',
  amygdala:         '#ef4444',
  thalamus:         '#a3a3a3',
  caudate:          '#fbbf24',
  putamen:          '#d97706',
  pallidum:         '#92400e',
  nucleus_accumbens:'#ec4899',
  lateral_ventricle:'#6b7280',
}

export const ROI_LABELS: Record<string, string> = {
  visual_early:     'Visual Early (V1–V3)',
  visual_ventral:   'Visual Ventral (FFA/PPA)',
  visual_dorsal:    'Visual Dorsal (IPS)',
  visual_mt:        'Visual MT (Motion)',
  multisensory_tpj: 'Multisensory / TPJ',
  auditory_early:   'Auditory Early (A1)',
  auditory_assoc:   'Auditory Assoc (STS)',
  inferior_frontal: "Inferior Frontal / Broca's",
  vwfa:             'VWFA (Reading)',
  hippocampus:      'Hippocampus',
  amygdala:         'Amygdala',
  thalamus:         'Thalamus',
  caudate:          'Caudate',
  putamen:          'Putamen',
  pallidum:         'Pallidum',
  nucleus_accumbens:'Nucleus Accumbens',
  lateral_ventricle:'Lateral Ventricle',
}
