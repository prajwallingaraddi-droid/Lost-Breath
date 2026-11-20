import * as THREE from 'three';

export interface ProceduralTextureSet {
  concreteAlbedo: THREE.CanvasTexture;
  concreteBump: THREE.CanvasTexture;
  floorTileAlbedo: THREE.CanvasTexture;
  floorTileBump: THREE.CanvasTexture;
  floorTileRoughness: THREE.CanvasTexture;
  darkFloorTileAlbedo: THREE.CanvasTexture;
  apartmentWoodAlbedo: THREE.CanvasTexture;
  paintedWallAlbedo: THREE.CanvasTexture;
  paintedWallBump: THREE.CanvasTexture;
  paintedWallRoughness: THREE.CanvasTexture;
  ceilingTileAlbedo: THREE.CanvasTexture;
  ceilingTileBump: THREE.CanvasTexture;
  fluorescentDiffuserAlbedo: THREE.CanvasTexture;
  industrialDoorAlbedo: THREE.CanvasTexture;
  industrialDoorBump: THREE.CanvasTexture;
  brushedSteel: THREE.CanvasTexture;
  diamondPlate: THREE.CanvasTexture;
  hazardStripe: THREE.CanvasTexture;
  paperSheetAlbedo: THREE.CanvasTexture;
  cardboardAlbedo: THREE.CanvasTexture;
  lightConeAlpha: THREE.CanvasTexture;
  dispose: () => void;
}

function makeSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function configureTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = Math.min(8, Math.max(1, maxAnisotropy));
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(maxAnisotropy = 4): ProceduralTextureSet {
  const rand = makeSeededRandom(20261119);

  // --------------------------------------------------------------------------
  // 1. Precast Industrial Light-Medium Grey Concrete Facade
  // --------------------------------------------------------------------------
  const [wallCanvas, wallCtx] = makeCanvas(512);
  wallCtx.fillStyle = '#80878d';
  wallCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 42; i++) {
    const cx = rand() * 512;
    const cy = rand() * 512;
    const r = 28 + rand() * 72;
    const g = wallCtx.createRadialGradient(cx, cy, 4, cx, cy, r);
    const dark = rand() > 0.42;
    g.addColorStop(0, dark ? 'rgba(54, 60, 65, 0.24)' : 'rgba(166, 172, 178, 0.18)');
    g.addColorStop(1, 'rgba(120, 126, 132, 0)');
    wallCtx.fillStyle = g;
    wallCtx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  for (let i = 0; i < 6200; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const shade = 104 + Math.floor(rand() * 44);
    wallCtx.fillStyle = `rgba(${shade}, ${shade + 2}, ${shade + 4}, 0.22)`;
    wallCtx.fillRect(x, y, 1.5 + rand() * 2.5, 1.5 + rand() * 2.5);
  }

  wallCtx.strokeStyle = 'rgba(42, 47, 52, 0.42)';
  wallCtx.lineWidth = 2;
  for (let p = 0; p < 512; p += 128) {
    wallCtx.beginPath();
    wallCtx.moveTo(p, 0);
    wallCtx.lineTo(p, 512);
    wallCtx.stroke();
    wallCtx.beginPath();
    wallCtx.moveTo(0, p);
    wallCtx.lineTo(512, p);
    wallCtx.stroke();
  }
  for (let s = 0; s < 16; s++) {
    const sx = rand() * 512;
    const sy = rand() * 160;
    const sh = 80 + rand() * 220;
    const sg = wallCtx.createLinearGradient(sx, sy, sx, sy + sh);
    sg.addColorStop(0, 'rgba(44, 49, 54, 0.26)');
    sg.addColorStop(1, 'rgba(44, 49, 54, 0)');
    wallCtx.fillStyle = sg;
    wallCtx.fillRect(sx, sy, 3 + rand() * 7, sh);
  }

  // --------------------------------------------------------------------------
  // 2. Light Grey Architectural Concrete Walls (Strong Contrast vs Black Floor)
  //    Subtle peeling plaster, damp streaks, hairline cracks, contact AO shading
  // --------------------------------------------------------------------------
  const [paintCanvas, paintCtx] = makeCanvas(512);
  const [paintBumpCanvas, paintBumpCtx] = makeCanvas(512);
  const [paintRoughCanvas, paintRoughCtx] = makeCanvas(512);

  paintCtx.fillStyle = '#b6b6b0';
  paintCtx.fillRect(0, 0, 512, 512);

  paintBumpCtx.fillStyle = '#808080';
  paintBumpCtx.fillRect(0, 0, 512, 512);

  paintRoughCtx.fillStyle = 'rgb(212,212,212)';
  paintRoughCtx.fillRect(0, 0, 512, 512);

  // Subtle concrete mottling & weathering patches
  for (let i = 0; i < 48; i++) {
    const cx = rand() * 512;
    const cy = rand() * 512;
    const rx = 26 + rand() * 88;
    const grad = paintCtx.createRadialGradient(cx, cy, 4, cx, cy, rx);
    const isDamp = rand() > 0.4;
    if (isDamp) {
      grad.addColorStop(0, 'rgba(130, 130, 124, 0.26)');
      grad.addColorStop(0.6, 'rgba(146, 146, 140, 0.14)');
      grad.addColorStop(1, 'rgba(170, 170, 164, 0)');
    } else {
      grad.addColorStop(0, 'rgba(206, 206, 200, 0.22)');
      grad.addColorStop(1, 'rgba(182, 182, 176, 0)');
    }
    paintCtx.fillStyle = grad;
    paintCtx.fillRect(cx - rx, cy - rx, rx * 2, rx * 2);

    if (isDamp) {
      const rGrad = paintRoughCtx.createRadialGradient(cx, cy, 4, cx, cy, rx * 0.85);
      rGrad.addColorStop(0, 'rgba(165, 165, 165, 0.34)');
      rGrad.addColorStop(1, 'rgba(212, 212, 212, 0)');
      paintRoughCtx.fillStyle = rGrad;
      paintRoughCtx.fillRect(cx - rx, cy - rx, rx * 2, rx * 2);
    }
  }

  // Subtle architectural form-line seam & mild ceiling-downward water streaks
  paintCtx.strokeStyle = 'rgba(92, 98, 104, 0.22)';
  paintCtx.lineWidth = 1.5;
  for (let x = 128; x < 512; x += 256) {
    paintCtx.beginPath();
    paintCtx.moveTo(x, 0);
    paintCtx.lineTo(x, 512);
    paintCtx.stroke();
  }
  for (let i = 0; i < 22; i++) {
    const sx = rand() * 512;
    const sw = 3 + rand() * 9;
    const sh = 65 + rand() * 190;
    const sg = paintCtx.createLinearGradient(sx, 0, sx, sh);
    sg.addColorStop(0, 'rgba(84, 90, 96, 0.24)');
    sg.addColorStop(1, 'rgba(84, 90, 96, 0)');
    paintCtx.fillStyle = sg;
    paintCtx.fillRect(sx, 0, sw, sh);
  }

  // Subtle weathered concrete spalling / worn plaster patches
  for (let p = 0; p < 14; p++) {
    const px = 24 + rand() * 464;
    const py = 44 + rand() * 390;
    const flakeCount = 3 + Math.floor(rand() * 5);
    for (let f = 0; f < flakeCount; f++) {
      const fx = px + (rand() - 0.5) * 40;
      const fy = py + (rand() - 0.5) * 34;
      const rad = 5 + rand() * 14;
      const verts = 6 + Math.floor(rand() * 4);

      const drawPoly = (ctx: CanvasRenderingContext2D, offsetX = 0, offsetY = 0) => {
        ctx.beginPath();
        for (let v = 0; v < verts; v++) {
          const ang = (v / verts) * Math.PI * 2 + (rand() - 0.5) * 0.35;
          const rr = rad * (0.55 + rand() * 0.65);
          const vx = fx + offsetX + Math.cos(ang) * rr;
          const vy = fy + offsetY + Math.sin(ang) * rr;
          if (v === 0) ctx.moveTo(vx, vy);
          else ctx.lineTo(vx, vy);
        }
        ctx.closePath();
      };

      drawPoly(paintCtx, 1.4, 1.4);
      paintCtx.fillStyle = 'rgba(72, 78, 84, 0.32)';
      paintCtx.fill();

      drawPoly(paintCtx, 0, 0);
      paintCtx.fillStyle = rand() > 0.5 ? '#8e959c' : '#9aa0a6';
      paintCtx.fill();
      paintCtx.strokeStyle = 'rgba(214, 219, 224, 0.5)';
      paintCtx.lineWidth = 1.1;
      paintCtx.stroke();

      drawPoly(paintBumpCtx, 0, 0);
      paintBumpCtx.fillStyle = '#5a5a5a';
      paintBumpCtx.fill();
      paintBumpCtx.strokeStyle = '#bcbcbc';
      paintBumpCtx.lineWidth = 1.6;
      paintBumpCtx.stroke();

      drawPoly(paintRoughCtx, 0, 0);
      paintRoughCtx.fillStyle = 'rgb(242,242,242)';
      paintRoughCtx.fill();
    }
  }

  // Fine hairline concrete cracks
  for (let c = 0; c < 12; c++) {
    let cx = rand() * 512;
    let cy = rand() * 512;
    const steps = 6 + Math.floor(rand() * 9);
    const dir = (rand() - 0.5) * Math.PI;
    paintCtx.beginPath();
    paintBumpCtx.beginPath();
    paintCtx.moveTo(cx, cy);
    paintBumpCtx.moveTo(cx, cy);
    for (let s = 0; s < steps; s++) {
      cx += Math.cos(dir + (rand() - 0.5) * 0.9) * (6 + rand() * 12);
      cy += Math.sin(dir + (rand() - 0.5) * 0.9) * (6 + rand() * 12);
      paintCtx.lineTo(cx, cy);
      paintBumpCtx.lineTo(cx, cy);
    }
    paintCtx.strokeStyle = 'rgba(66, 72, 78, 0.34)';
    paintCtx.lineWidth = 0.8 + rand() * 0.8;
    paintCtx.stroke();
    paintBumpCtx.strokeStyle = '#404040';
    paintBumpCtx.lineWidth = 1.2;
    paintBumpCtx.stroke();
  }

  // Fine mineral grain
  for (let i = 0; i < 5500; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const v = 148 + Math.floor(rand() * 44);
    paintCtx.fillStyle = `rgba(${v}, ${v + 2}, ${v + 4}, 0.14)`;
    paintCtx.fillRect(x, y, 2, 2);
    const bv = 114 + Math.floor(rand() * 28);
    paintBumpCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    paintBumpCtx.fillRect(x, y, 2, 2);
  }

  // Baked Ambient Occlusion at ceiling cornice (top) & floor baseboard contact (bottom)
  const topAo = paintCtx.createLinearGradient(0, 0, 0, 84);
  topAo.addColorStop(0, 'rgba(34, 38, 44, 0.34)');
  topAo.addColorStop(1, 'rgba(34, 38, 44, 0)');
  paintCtx.fillStyle = topAo;
  paintCtx.fillRect(0, 0, 512, 84);

  const botAo = paintCtx.createLinearGradient(0, 412, 0, 512);
  botAo.addColorStop(0, 'rgba(18, 22, 26, 0)');
  botAo.addColorStop(0.65, 'rgba(18, 22, 26, 0.24)');
  botAo.addColorStop(1, 'rgba(12, 15, 18, 0.55)');
  paintCtx.fillStyle = botAo;
  paintCtx.fillRect(0, 412, 512, 100);

  // --------------------------------------------------------------------------
  // 3. Generic Concrete Bump Map
  // --------------------------------------------------------------------------
  const [bumpCanvas, bumpCtx] = makeCanvas(256);
  bumpCtx.fillStyle = '#808080';
  bumpCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4200; i++) {
    const v = 98 + Math.floor(rand() * 58);
    bumpCtx.fillStyle = `rgb(${v},${v},${v})`;
    bumpCtx.fillRect(rand() * 256, rand() * 256, 2, 2);
  }

  // --------------------------------------------------------------------------
  // 4. Premium Charcoal-Black / Dark Graphite Industrial Concrete Flooring
  //    Troweled graphite concrete with subtle slab joints, realistic scratches,
  //    minor wear, contact shadow seams, and satin specular roughness map.
  // --------------------------------------------------------------------------
  const [floorCanvas, floorCtx] = makeCanvas(512);
  const [floorBumpCanvas, floorBumpCtx] = makeCanvas(512);
  const [floorRoughCanvas, floorRoughCtx] = makeCanvas(512);

  // Base dark charcoal-black industrial concrete (#202124 target — rich troweled tone, never flat #000)
  floorCtx.fillStyle = '#24262a';
  floorCtx.fillRect(0, 0, 512, 512);
  floorBumpCtx.fillStyle = '#848484';
  floorBumpCtx.fillRect(0, 0, 512, 512);
  // Base satin industrial concrete roughness (~0.36 -> 92)
  floorRoughCtx.fillStyle = 'rgb(94,94,94)';
  floorRoughCtx.fillRect(0, 0, 512, 512);

  // Large troweled concrete slab variations (2x2 large 256px industrial slabs per tile)
  const slabSize = 256;
  for (let sy = 0; sy < 512; sy += slabSize) {
    for (let sx = 0; sx < 512; sx += slabSize) {
      const jit = Math.floor(rand() * 8) - 4;
      floorCtx.fillStyle = `rgb(${35 + jit}, ${37 + jit}, ${40 + jit})`;
      floorCtx.fillRect(sx + 2, sy + 2, slabSize - 4, slabSize - 4);

      // Subtle troweled sheen gradient across slab
      const sg = floorCtx.createLinearGradient(sx, sy, sx + slabSize, sy + slabSize);
      sg.addColorStop(0, 'rgba(72, 76, 82, 0.14)');
      sg.addColorStop(0.5, 'rgba(32, 34, 38, 0)');
      sg.addColorStop(1, 'rgba(12, 13, 15, 0.22)');
      floorCtx.fillStyle = sg;
      floorCtx.fillRect(sx + 2, sy + 2, slabSize - 4, slabSize - 4);
    }
  }

  // Organic concrete aggregate clouding & subtle polished-vs-matte wear patches
  for (let i = 0; i < 86; i++) {
    const cx = rand() * 512;
    const cy = rand() * 512;
    const rad = 16 + rand() * 64;
    const lighter = rand() > 0.48;
    const g = floorCtx.createRadialGradient(cx, cy, 2, cx, cy, rad);
    g.addColorStop(
      0,
      lighter ? 'rgba(66, 73, 82, 0.20)' : 'rgba(12, 14, 17, 0.28)'
    );
    g.addColorStop(1, 'rgba(26, 30, 35, 0)');
    floorCtx.fillStyle = g;
    floorCtx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);

    // Roughness variation: some polished smooth concrete patches (~0.24), some dusty scuffed wear (~0.66)
    const rg = floorRoughCtx.createRadialGradient(cx, cy, 2, cx, cy, rad);
    rg.addColorStop(
      0,
      lighter ? 'rgba(168, 168, 168, 0.45)' : 'rgba(62, 62, 62, 0.52)'
    );
    rg.addColorStop(1, 'rgba(96, 96, 96, 0)');
    floorRoughCtx.fillStyle = rg;
    floorRoughCtx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }

  // Fine mineral graphite speckle
  for (let i = 0; i < 7500; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const v = 22 + Math.floor(rand() * 34);
    floorCtx.fillStyle = `rgba(${v}, ${v + 3}, ${v + 6}, 0.26)`;
    floorCtx.fillRect(x, y, 1.5, 1.5);
    const bv = 112 + Math.floor(rand() * 34);
    floorBumpCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    floorBumpCtx.fillRect(x, y, 1.5, 1.5);
  }

  // Realistic surface scratches, drag marks & micro-wear streaks
  for (let s = 0; s < 85; s++) {
    const x1 = rand() * 512;
    const y1 = rand() * 512;
    const ang = rand() * Math.PI * 2;
    const len = 12 + rand() * 44;
    const x2 = x1 + Math.cos(ang) * len;
    const y2 = y1 + Math.sin(ang) * len;

    floorCtx.strokeStyle =
      rand() > 0.35 ? 'rgba(92, 100, 110, 0.20)' : 'rgba(10, 12, 15, 0.32)';
    floorCtx.lineWidth = 0.7 + rand() * 0.9;
    floorCtx.beginPath();
    floorCtx.moveTo(x1, y1);
    floorCtx.lineTo(x2, y2);
    floorCtx.stroke();

    floorBumpCtx.strokeStyle = '#585858';
    floorBumpCtx.lineWidth = 1;
    floorBumpCtx.beginPath();
    floorBumpCtx.moveTo(x1, y1);
    floorBumpCtx.lineTo(x2, y2);
    floorBumpCtx.stroke();

    floorRoughCtx.strokeStyle = 'rgba(182, 182, 182, 0.55)';
    floorRoughCtx.lineWidth = 1.4;
    floorRoughCtx.beginPath();
    floorRoughCtx.moveTo(x1, y1);
    floorRoughCtx.lineTo(x2, y2);
    floorRoughCtx.stroke();
  }

  // Crisp recessed concrete control joints (expansion seams + subtle AO bevel)
  for (let g = 0; g <= 512; g += slabSize) {
    // Soft shadow seam edge
    floorCtx.strokeStyle = 'rgba(8, 10, 12, 0.85)';
    floorCtx.lineWidth = 4;
    floorCtx.beginPath();
    floorCtx.moveTo(g, 0);
    floorCtx.lineTo(g, 512);
    floorCtx.moveTo(0, g);
    floorCtx.lineTo(512, g);
    floorCtx.stroke();

    // Subtle specular bevel catchlight right beside the seam
    floorCtx.strokeStyle = 'rgba(84, 92, 102, 0.22)';
    floorCtx.lineWidth = 1;
    floorCtx.beginPath();
    floorCtx.moveTo(g + 2.5, 0);
    floorCtx.lineTo(g + 2.5, 512);
    floorCtx.moveTo(0, g + 2.5);
    floorCtx.lineTo(512, g + 2.5);
    floorCtx.stroke();

    floorBumpCtx.strokeStyle = '#242424';
    floorBumpCtx.lineWidth = 4.5;
    floorBumpCtx.beginPath();
    floorBumpCtx.moveTo(g, 0);
    floorBumpCtx.lineTo(g, 512);
    floorBumpCtx.moveTo(0, g);
    floorBumpCtx.lineTo(512, g);
    floorBumpCtx.stroke();

    floorRoughCtx.strokeStyle = 'rgb(228,228,228)';
    floorRoughCtx.lineWidth = 5;
    floorRoughCtx.beginPath();
    floorRoughCtx.moveTo(g, 0);
    floorRoughCtx.lineTo(g, 512);
    floorRoughCtx.moveTo(0, g);
    floorRoughCtx.lineTo(512, g);
    floorRoughCtx.stroke();
  }

  // --------------------------------------------------------------------------
  // 5. Honed Basalt / Dark Graphite Corridor Center Runner Slab
  // --------------------------------------------------------------------------
  const [darkTileCanvas, darkTileCtx] = makeCanvas(256);
  darkTileCtx.fillStyle = '#14171b';
  darkTileCtx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 24; i++) {
    const cx = rand() * 256;
    const cy = rand() * 256;
    const r = 16 + rand() * 48;
    const g = darkTileCtx.createRadialGradient(cx, cy, 2, cx, cy, r);
    g.addColorStop(0, rand() > 0.5 ? 'rgba(54, 60, 68, 0.22)' : 'rgba(6, 8, 10, 0.34)');
    g.addColorStop(1, 'rgba(18, 21, 25, 0)');
    darkTileCtx.fillStyle = g;
    darkTileCtx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  for (let i = 0; i < 1400; i++) {
    const v = 16 + Math.floor(rand() * 24);
    darkTileCtx.fillStyle = `rgba(${v}, ${v + 2}, ${v + 4}, 0.25)`;
    darkTileCtx.fillRect(rand() * 256, rand() * 256, 2, 2);
  }
  // Subtle aged steel-grey machined seam border
  darkTileCtx.strokeStyle = 'rgba(84, 92, 100, 0.34)';
  darkTileCtx.lineWidth = 3;
  darkTileCtx.strokeRect(8, 8, 240, 240);
  darkTileCtx.strokeStyle = '#07090b';
  darkTileCtx.lineWidth = 4;
  darkTileCtx.strokeRect(2, 2, 252, 252);

  // --------------------------------------------------------------------------
  // 6. Off-White / Pale Industrial Grey Suspended Acoustic Ceiling Panels
  // --------------------------------------------------------------------------
  const [ceilCanvas, ceilCtx] = makeCanvas(512);
  const [ceilBumpCanvas, ceilBumpCtx] = makeCanvas(512);
  // Pale industrial grey suspended ceiling (#D0CEC5)
  ceilCtx.fillStyle = '#d6d4cb';
  ceilCtx.fillRect(0, 0, 512, 512);
  ceilBumpCtx.fillStyle = '#909090';
  ceilBumpCtx.fillRect(0, 0, 512, 512);

  const panelSize = 128;
  for (let py = 0; py < 512; py += panelSize) {
    for (let px = 0; px < 512; px += panelSize) {
      const jitter = Math.floor(rand() * 10) - 5;
      const r = 214 + jitter;
      const g = 212 + jitter;
      const b = 203 + jitter;
      ceilCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ceilCtx.fillRect(px + 4, py + 4, panelSize - 8, panelSize - 8);

      // Occasional subtle aged damp tint
      if (rand() < 0.22) {
        const sx = px + 24 + rand() * 80;
        const sy = py + 24 + rand() * 80;
        const sr = 20 + rand() * 32;
        const sg = ceilCtx.createRadialGradient(sx, sy, 2, sx, sy, sr);
        sg.addColorStop(0, 'rgba(136, 134, 126, 0.22)');
        sg.addColorStop(1, 'rgba(136, 134, 126, 0)');
        ceilCtx.fillStyle = sg;
        ceilCtx.fillRect(px + 4, py + 4, panelSize - 8, panelSize - 8);
      }
    }
  }
  for (let i = 0; i < 3800; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    ceilCtx.fillStyle = 'rgba(110, 116, 122, 0.16)';
    ceilCtx.fillRect(x, y, 1.5, 1.5);
    ceilBumpCtx.fillStyle = '#6c6c6c';
    ceilBumpCtx.fillRect(x, y, 1.5, 1.5);
  }
  // Pale slate industrial T-bar grid channels
  ceilCtx.strokeStyle = '#687078';
  ceilCtx.lineWidth = 5;
  ceilBumpCtx.strokeStyle = '#424242';
  ceilBumpCtx.lineWidth = 6;
  for (let g = 0; g <= 512; g += panelSize) {
    ceilCtx.beginPath();
    ceilCtx.moveTo(g, 0);
    ceilCtx.lineTo(g, 512);
    ceilCtx.stroke();
    ceilCtx.beginPath();
    ceilCtx.moveTo(0, g);
    ceilCtx.lineTo(512, g);
    ceilCtx.stroke();

    ceilBumpCtx.beginPath();
    ceilBumpCtx.moveTo(g, 0);
    ceilBumpCtx.lineTo(g, 512);
    ceilBumpCtx.stroke();
    ceilBumpCtx.beginPath();
    ceilBumpCtx.moveTo(0, g);
    ceilBumpCtx.lineTo(512, g);
    ceilBumpCtx.stroke();
  }

  // --------------------------------------------------------------------------
  // 7. Warm Industrial Recessed Ceiling Light Diffuser
  // --------------------------------------------------------------------------
  const [fluorCanvas, fluorCtx] = makeCanvas(256);
  const fg = fluorCtx.createLinearGradient(0, 0, 256, 0);
  fg.addColorStop(0, '#c9ae82');
  fg.addColorStop(0.18, '#fae7c8');
  fg.addColorStop(0.35, '#fff6e6');
  fg.addColorStop(0.5, '#f4ddb8');
  fg.addColorStop(0.65, '#fff6e6');
  fg.addColorStop(0.82, '#fae7c8');
  fg.addColorStop(1, '#c9ae82');
  fluorCtx.fillStyle = fg;
  fluorCtx.fillRect(0, 0, 256, 256);

  for (let x = 0; x < 256; x += 8) {
    fluorCtx.fillStyle = 'rgba(155, 126, 86, 0.14)';
    fluorCtx.fillRect(x, 0, 2, 256);
  }
  for (let i = 0; i < 140; i++) {
    const dx = rand() * 256;
    const dy = rand() < 0.5 ? rand() * 30 : 226 + rand() * 30;
    fluorCtx.fillStyle = 'rgba(66, 56, 44, 0.22)';
    fluorCtx.fillRect(dx, dy, 2 + rand() * 3, 2 + rand() * 2);
  }
  fluorCtx.strokeStyle = '#3b4046';
  fluorCtx.lineWidth = 8;
  fluorCtx.strokeRect(4, 4, 248, 248);

  // --------------------------------------------------------------------------
  // 8. Dark Industrial Metal Apartment Door (Charcoal Steel)
  // --------------------------------------------------------------------------
  const [doorCanvas, doorCtx] = makeCanvas(256);
  const [doorBumpCanvas, doorBumpCtx] = makeCanvas(256);
  doorCtx.fillStyle = '#36383b';
  doorCtx.fillRect(0, 0, 256, 256);
  doorBumpCtx.fillStyle = '#808080';
  doorBumpCtx.fillRect(0, 0, 256, 256);

  for (let x = 0; x < 256; x += 2) {
    const delta = Math.floor(rand() * 12) - 6;
    doorCtx.fillStyle = `rgba(${56 + delta}, ${58 + delta}, ${61 + delta}, 0.44)`;
    doorCtx.fillRect(x, 0, 1.5, 256);
  }
  doorCtx.strokeStyle = 'rgba(10, 13, 16, 0.8)';
  doorCtx.lineWidth = 6;
  doorCtx.strokeRect(18, 16, 220, 224);
  doorCtx.strokeStyle = 'rgba(92, 102, 112, 0.28)';
  doorCtx.lineWidth = 2;
  doorCtx.strokeRect(22, 20, 212, 216);

  doorBumpCtx.strokeStyle = '#383838';
  doorBumpCtx.lineWidth = 6;
  doorBumpCtx.strokeRect(18, 16, 220, 224);

  const wearG = doorCtx.createRadialGradient(204, 152, 4, 204, 152, 34);
  wearG.addColorStop(0, 'rgba(92, 100, 108, 0.22)');
  wearG.addColorStop(1, 'rgba(30, 36, 42, 0)');
  doorCtx.fillStyle = wearG;
  doorCtx.fillRect(160, 110, 88, 88);

  for (let s = 0; s < 32; s++) {
    const sx = rand() * 256;
    const sy = rand() * 256;
    doorCtx.strokeStyle = 'rgba(124, 132, 140, 0.16)';
    doorCtx.lineWidth = 1;
    doorCtx.beginPath();
    doorCtx.moveTo(sx, sy);
    doorCtx.lineTo(sx + (rand() - 0.5) * 26, sy + (rand() - 0.5) * 14);
    doorCtx.stroke();
  }

  // --------------------------------------------------------------------------
  // 9. Aged Apartment Interior Wood (Furniture)
  // --------------------------------------------------------------------------
  const [woodCanvas, woodCtx] = makeCanvas(256);
  woodCtx.fillStyle = '#4e473e';
  woodCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 3) {
    const v = Math.floor(rand() * 16) - 8;
    woodCtx.fillStyle = `rgb(${74 + v}, ${68 + v}, ${59 + v})`;
    woodCtx.fillRect(0, y, 256, 2);
  }
  woodCtx.strokeStyle = 'rgba(26, 24, 21, 0.42)';
  woodCtx.lineWidth = 2;
  for (let x = 0; x < 256; x += 64) {
    woodCtx.beginPath();
    woodCtx.moveTo(x, 0);
    woodCtx.lineTo(x, 256);
    woodCtx.stroke();
  }

  // --------------------------------------------------------------------------
  // 10. Aged Brushed Steel (Fixtures, Handles, Railings)
  // --------------------------------------------------------------------------
  const [steelCanvas, steelCtx] = makeCanvas(256);
  steelCtx.fillStyle = '#8b9399';
  steelCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    const tone = 116 + Math.floor(rand() * 34);
    steelCtx.fillStyle = `rgba(${tone}, ${tone + 3}, ${tone + 6}, 0.42)`;
    steelCtx.fillRect(0, y, 256, 1);
  }

  // --------------------------------------------------------------------------
  // 11. Diamond Plate Tread
  // --------------------------------------------------------------------------
  const [diamCanvas, diamCtx] = makeCanvas(256);
  diamCtx.fillStyle = '#363c42';
  diamCtx.fillRect(0, 0, 256, 256);
  diamCtx.fillStyle = '#626b73';
  for (let y = 8; y < 256; y += 24) {
    for (let x = 8; x < 256; x += 24) {
      diamCtx.save();
      diamCtx.translate(x, y);
      diamCtx.rotate(((x + y) / 24) % 2 === 0 ? Math.PI / 4 : -Math.PI / 4);
      diamCtx.fillRect(-5, -1.5, 10, 3);
      diamCtx.restore();
    }
  }

  // --------------------------------------------------------------------------
  // 12. Weathered Emergency Caution / Hazard Stripes
  // --------------------------------------------------------------------------
  const [hazCanvas, hazCtx] = makeCanvas(256);
  hazCtx.fillStyle = '#b99326';
  hazCtx.fillRect(0, 0, 256, 256);
  hazCtx.fillStyle = '#191d20';
  for (let i = -256; i < 512; i += 48) {
    hazCtx.beginPath();
    hazCtx.moveTo(i, 0);
    hazCtx.lineTo(i + 24, 0);
    hazCtx.lineTo(i + 24 + 256, 256);
    hazCtx.lineTo(i + 256, 256);
    hazCtx.closePath();
    hazCtx.fill();
  }
  for (let i = 0; i < 900; i++) {
    hazCtx.fillStyle = 'rgba(28, 32, 34, 0.22)';
    hazCtx.fillRect(rand() * 256, rand() * 256, 2, 2);
  }

  // --------------------------------------------------------------------------
  // 13. Aged Institutional Paper / Newspaper Sheet
  // --------------------------------------------------------------------------
  const [paperCanvas, paperCtx] = makeCanvas(128);
  paperCtx.fillStyle = '#c4c2b8';
  paperCtx.fillRect(0, 0, 128, 128);
  paperCtx.strokeStyle = 'rgba(78, 74, 66, 0.45)';
  paperCtx.lineWidth = 6;
  paperCtx.strokeRect(3, 3, 122, 122);
  paperCtx.fillStyle = 'rgba(38, 40, 42, 0.65)';
  paperCtx.fillRect(14, 14, 72, 8);
  paperCtx.fillStyle = 'rgba(48, 50, 52, 0.42)';
  for (let y = 30; y < 114; y += 7) {
    paperCtx.fillRect(14, y, 44 + (y % 3) * 8, 3);
    paperCtx.fillRect(72, y, 36 - (y % 2) * 8, 3);
  }

  // --------------------------------------------------------------------------
  // 14. Worn Corrugated Cardboard Archive Box
  // --------------------------------------------------------------------------
  const [cardCanvas, cardCtx] = makeCanvas(128);
  cardCtx.fillStyle = '#5e564a';
  cardCtx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 4) {
    const shade = 82 + Math.floor(rand() * 18);
    cardCtx.fillStyle = `rgba(${shade}, ${shade - 6}, ${shade - 14}, 0.35)`;
    cardCtx.fillRect(0, y, 128, 2);
  }
  cardCtx.fillStyle = 'rgba(34, 30, 26, 0.32)';
  cardCtx.fillRect(0, 0, 128, 16);
  cardCtx.fillRect(0, 112, 128, 16);

  // --------------------------------------------------------------------------
  // 15. Smooth Vertical Gradient Alpha Map for Soft Restrained Light Cone
  // --------------------------------------------------------------------------
  const [coneAlphaCanvas, coneAlphaCtx] = makeCanvas(64);
  const cg = coneAlphaCtx.createLinearGradient(0, 0, 0, 64);
  cg.addColorStop(0.0, 'rgba(255, 255, 255, 0.78)');
  cg.addColorStop(0.28, 'rgba(255, 255, 255, 0.36)');
  cg.addColorStop(0.68, 'rgba(255, 255, 255, 0.08)');
  cg.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  coneAlphaCtx.fillStyle = '#000000';
  coneAlphaCtx.fillRect(0, 0, 64, 64);
  coneAlphaCtx.fillStyle = cg;
  coneAlphaCtx.fillRect(0, 0, 64, 64);

  const concreteAlbedo = configureTexture(wallCanvas, true, 4, 1.5, maxAnisotropy);
  const concreteBump = configureTexture(bumpCanvas, false, 4, 1.5, maxAnisotropy);
  const floorTileAlbedo = configureTexture(floorCanvas, true, 12, 12, maxAnisotropy);
  const floorTileBump = configureTexture(floorBumpCanvas, false, 12, 12, maxAnisotropy);
  const floorTileRoughness = configureTexture(floorRoughCanvas, false, 12, 12, maxAnisotropy);
  const darkFloorTileAlbedo = configureTexture(darkTileCanvas, true, 1, 1, maxAnisotropy);
  const apartmentWoodAlbedo = configureTexture(woodCanvas, true, 2, 2, maxAnisotropy);
  const paintedWallAlbedo = configureTexture(paintCanvas, true, 2, 1, maxAnisotropy);
  const paintedWallBump = configureTexture(paintBumpCanvas, false, 2, 1, maxAnisotropy);
  const paintedWallRoughness = configureTexture(paintRoughCanvas, false, 2, 1, maxAnisotropy);
  const ceilingTileAlbedo = configureTexture(ceilCanvas, true, 8, 2, maxAnisotropy);
  const ceilingTileBump = configureTexture(ceilBumpCanvas, false, 8, 2, maxAnisotropy);
  const fluorescentDiffuserAlbedo = configureTexture(fluorCanvas, true, 1, 1, maxAnisotropy);
  const industrialDoorAlbedo = configureTexture(doorCanvas, true, 1, 1, maxAnisotropy);
  const industrialDoorBump = configureTexture(doorBumpCanvas, false, 1, 1, maxAnisotropy);
  const brushedSteel = configureTexture(steelCanvas, true, 1, 1, maxAnisotropy);
  const diamondPlate = configureTexture(diamCanvas, true, 2, 2, maxAnisotropy);
  const hazardStripe = configureTexture(hazCanvas, true, 3, 1, maxAnisotropy);
  const paperSheetAlbedo = configureTexture(paperCanvas, true, 1, 1, maxAnisotropy);
  const cardboardAlbedo = configureTexture(cardCanvas, true, 1, 1, maxAnisotropy);
  const lightConeAlpha = configureTexture(coneAlphaCanvas, false, 1, 1, 1);
  lightConeAlpha.wrapS = THREE.ClampToEdgeWrapping;
  lightConeAlpha.wrapT = THREE.ClampToEdgeWrapping;

  const allTextures = [
    concreteAlbedo,
    concreteBump,
    floorTileAlbedo,
    floorTileBump,
    floorTileRoughness,
    darkFloorTileAlbedo,
    apartmentWoodAlbedo,
    paintedWallAlbedo,
    paintedWallBump,
    paintedWallRoughness,
    ceilingTileAlbedo,
    ceilingTileBump,
    fluorescentDiffuserAlbedo,
    industrialDoorAlbedo,
    industrialDoorBump,
    brushedSteel,
    diamondPlate,
    hazardStripe,
    paperSheetAlbedo,
    cardboardAlbedo,
    lightConeAlpha,
  ];

  return {
    concreteAlbedo,
    concreteBump,
    floorTileAlbedo,
    floorTileBump,
    floorTileRoughness,
    darkFloorTileAlbedo,
    apartmentWoodAlbedo,
    paintedWallAlbedo,
    paintedWallBump,
    paintedWallRoughness,
    ceilingTileAlbedo,
    ceilingTileBump,
    fluorescentDiffuserAlbedo,
    industrialDoorAlbedo,
    industrialDoorBump,
    brushedSteel,
    diamondPlate,
    hazardStripe,
    paperSheetAlbedo,
    cardboardAlbedo,
    lightConeAlpha,
    dispose: () => {
      allTextures.forEach((t) => t.dispose());
    },
  };
}
