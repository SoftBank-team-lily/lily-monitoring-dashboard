/** Observation hints are snapped to actual pollen particles when the mask is sampled. */
export const OBSERVATION_POINTS = [
  { id: 'metrics', label: '앱 지표', number: '01', position: [-.25, .21, -.6] },
  { id: 'compare', label: '버전 비교', number: '02', position: [.25, .21, -.6] },
  { id: 'servers', label: '서버 자원', number: '03', position: [-.26, -.18, -.58] },
  { id: 'logs', label: '최근 로그', number: '04', position: [.26, -.18, -.58] },
  { id: 'trends', label: '지표 추이', number: '05', position: [.32, -.42, -.5] },
  { id: 'traffic', label: '거점과 트래픽', number: '06', position: [-.32, -.42, -.5] },
] as const;
export type PanelId = typeof OBSERVATION_POINTS[number]['id'];
export const FLOWER_SCALE = 1.45;
export interface FlowerMask { width: number; height: number; data: Uint8ClampedArray | Uint8Array; }
export interface FlowerParticles {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  phases: Float32Array;
  alphas: Float32Array;
  attachments: Record<PanelId, [number, number, number]>;
}

// lily-frontend/src/lib/three/flower/config.ts and src/app/globals.css.
const PALETTE = { stamen: [.72, .82, .45], pollen: [.93, .66, .24], petal: [.9, .33, .5], edge: [1, .92, .94], spot: [.62, .12, .28] };
const smooth = (a: number, b: number, value: number) => { const t = Math.min(1, Math.max(0, (value - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);

/** Matches lily-frontend's mask sampling, depth, palette and fully gathered bloom. */
export function buildFlowerParticles(mask: FlowerMask): FlowerParticles {
  if (mask.width !== mask.height || mask.data.length !== mask.width * mask.height * 4) throw new Error('꽃 마스크 크기가 올바르지 않습니다.');
  let seed = 41;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const positions: number[] = [], colors: number[] = [], sizes: number[] = [], phases: number[] = [], alphas: number[] = [];
  const S = mask.width, cx = 88.2 / 187 * S, cy = 79.6 / 187 * S;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const b = mask.data[(y * S + x) * 4] / 255;
    if (b < .1) continue;
    const count = Math.floor(b * 3.8 + random());
    for (let k = 0; k < count; k++) {
      const px = (x + random() - cx) / S * 3.4;
      const py = -(y + random() - cy) / S * 3.4;
      const d = Math.hypot(px, py) / 1.75;
      const pz = -.45 * (1 - smooth(0, .8, d)) + (b - .5) * .3 + (random() - .5) * .08;
      positions.push(px * FLOWER_SCALE, py * FLOWER_SCALE, pz * FLOWER_SCALE);
      // Preserve the reference generator's random sequence for the assembled state.
      for (let unused = 0; unused < 6; unused++) random();
      const rand = random(); random();
      let color: number[];
      if (d < .07) color = mix(PALETTE.stamen, PALETTE.pollen, smooth(.02, .07, d));
      else if (d < .16) color = PALETTE.pollen;
      else color = mix(PALETTE.petal, PALETTE.edge, smooth(.18, .72, d));
      if (d > .16 && random() < .035 && d < .5) color = PALETTE.spot;
      colors.push(...color.map((c) => c * (.4 + b * .85)));
      sizes.push((.55 + b * .7) * 1.12);
      phases.push(rand * Math.PI * 2);
      alphas.push((.1 + b * .55) * 1.1);
    }
  }
  if (!positions.length) throw new Error('꽃 마스크에 입자가 없습니다.');
  const attachments = {} as FlowerParticles['attachments'];
  for (const { id, position } of OBSERVATION_POINTS) {
    let nearest = Infinity, index = 0;
    for (let i = 0; i < positions.length; i += 3) {
      const distance = Math.hypot(positions[i] - position[0], positions[i + 1] - position[1], positions[i + 2] - position[2]);
      if (distance < nearest) { nearest = distance; index = i; }
    }
    attachments[id] = [positions[index], positions[index + 1], positions[index + 2]];
  }
  return { positions: new Float32Array(positions), colors: new Float32Array(colors), sizes: new Float32Array(sizes), phases: new Float32Array(phases), alphas: new Float32Array(alphas), attachments };
}

export async function loadFlowerMask(): Promise<ImageData> {
  const image = new Image();
  image.src = '/dashboard/flower-mask.png';
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width; canvas.height = image.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('꽃 마스크를 읽을 수 없습니다.');
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
