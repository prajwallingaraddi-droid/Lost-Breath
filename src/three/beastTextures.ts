import * as THREE from 'three';

export interface BeastWarriorMaterials {
  torsoMat: THREE.MeshStandardMaterial;
  skinMat: THREE.MeshStandardMaterial;
  headMat: THREE.MeshStandardMaterial;
  hairMat: THREE.MeshStandardMaterial;
  robeMat: THREE.MeshStandardMaterial;
  robeDoubleMat: THREE.MeshStandardMaterial;
  trousersMat: THREE.MeshStandardMaterial;
  leatherMat: THREE.MeshStandardMaterial;
  sashMat: THREE.MeshStandardMaterial;
  wrapMat: THREE.MeshStandardMaterial;
  metalMat: THREE.MeshStandardMaterial;
  swordBladeMat: THREE.MeshStandardMaterial;
  dispose: () => void;
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  srgb: boolean,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates realistic muscular warrior torso albedo + bump maps.
 * Oriented for a Lathe/Cylinder rotated +PI/2 around Y:
 * - u = 0.75 -> Front (+Z): pectorals, sternum groove, scar, 6-pack abs, obliques
 * - u = 0.25 -> Back (-Z): trapezius, lats, spine furrow, dark tribal upper-back & shoulder tattoos
 * - u = 0.0 / 1.0 -> Left side (+X) tucked cleanly under maroon robe
 */
function createTorsoTextures(): {
  map: THREE.CanvasTexture | null;
  bumpMap: THREE.CanvasTexture | null;
} {
  const res = makeCanvas(512, 512);
  const bumpRes = makeCanvas(512, 512);
  if (!res || !bumpRes) return { map: null, bumpMap: null };

  const [canvas, ctx] = res;
  const [bCanvas, bCtx] = bumpRes;

  // Base weathered warm-olive warrior skin
  const baseGrad = ctx.createLinearGradient(0, 0, 0, 512);
  baseGrad.addColorStop(0, '#c08f6c');
  baseGrad.addColorStop(0.45, '#b68360');
  baseGrad.addColorStop(1, '#9d6d4d');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, 512, 512);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 512, 512);

  // Subtle natural skin grain
  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(85,48,28,0.06)' : 'rgba(235,195,165,0.05)';
    ctx.fillRect(x, y, 2, 2);
  }

  // --- FRONT TORSO MUSCULATURE (centered at u = 0.75 -> x = 384) ---
  const fx = 384;

  // Pectorals (highlights + deep underside shadow)
  for (const side of [-1, 1]) {
    const px = fx + side * 44;
    const pecGrad = ctx.createRadialGradient(px, 148, 8, px, 162, 58);
    pecGrad.addColorStop(0, 'rgba(226, 178, 142, 0.42)');
    pecGrad.addColorStop(0.65, 'rgba(176, 120, 86, 0.14)');
    pecGrad.addColorStop(1, 'rgba(72, 38, 22, 0.56)');
    ctx.fillStyle = pecGrad;
    ctx.beginPath();
    ctx.ellipse(px, 158, 46, 34, side * -0.14, 0, Math.PI * 2);
    ctx.fill();

    const bPec = bCtx.createRadialGradient(px, 150, 6, px, 158, 52);
    bPec.addColorStop(0, '#dcdcdc');
    bPec.addColorStop(0.8, '#959595');
    bPec.addColorStop(1, '#484848');
    bCtx.fillStyle = bPec;
    bCtx.beginPath();
    bCtx.ellipse(px, 158, 44, 32, side * -0.14, 0, Math.PI * 2);
    bCtx.fill();
  }

  // Sternum & linea alba vertical furrow
  const centerLine = ctx.createLinearGradient(fx - 10, 0, fx + 10, 0);
  centerLine.addColorStop(0, 'rgba(72,38,22,0)');
  centerLine.addColorStop(0.5, 'rgba(65,33,18,0.48)');
  centerLine.addColorStop(1, 'rgba(72,38,22,0)');
  ctx.fillStyle = centerLine;
  ctx.fillRect(fx - 10, 120, 20, 320);

  // 6-pack abdominal segments
  const abRows = [228, 282, 336, 392];
  abRows.forEach((ay, idx) => {
    const w = idx === 3 ? 24 : 27;
    const h = idx === 3 ? 26 : 22;
    for (const side of [-1, 1]) {
      const ax = fx + side * 24;
      const abGrad = ctx.createRadialGradient(ax, ay - 4, 4, ax, ay, w + 8);
      abGrad.addColorStop(0, 'rgba(222, 173, 138, 0.4)');
      abGrad.addColorStop(0.7, 'rgba(155, 102, 70, 0.16)');
      abGrad.addColorStop(1, 'rgba(68, 34, 18, 0.45)');
      ctx.fillStyle = abGrad;
      ctx.beginPath();
      ctx.ellipse(ax, ay, w, h, 0, 0, Math.PI * 2);
      ctx.fill();

      const bAb = bCtx.createRadialGradient(ax, ay - 3, 4, ax, ay, w + 4);
      bAb.addColorStop(0, '#d2d2d2');
      bAb.addColorStop(1, '#585858');
      bCtx.fillStyle = bAb;
      bCtx.beginPath();
      bCtx.ellipse(ax, ay, w - 2, h - 2, 0, 0, Math.PI * 2);
      bCtx.fill();
    }
  });

  // Oblique / serratus rib shadows on front flanks
  for (const side of [-1, 1]) {
    ctx.strokeStyle = 'rgba(74, 38, 22, 0.34)';
    ctx.lineWidth = 5;
    for (let r = 0; r < 3; r++) {
      ctx.beginPath();
      ctx.moveTo(fx + side * 56, 215 + r * 30);
      ctx.quadraticCurveTo(fx + side * 78, 232 + r * 30, fx + side * 88, 255 + r * 28);
      ctx.stroke();
    }
  }

  // Subtle chest scar on his right pectoral (matching reference)
  ctx.strokeStyle = 'rgba(224, 178, 152, 0.55)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(fx - 64, 128);
  ctx.quadraticCurveTo(fx - 46, 138, fx - 28, 122);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(96, 46, 28, 0.38)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(fx - 64, 130);
  ctx.quadraticCurveTo(fx - 46, 140, fx - 28, 124);
  ctx.stroke();

  // --- BACK TORSO MUSCULATURE & DARK TRIBAL TATTOOS (centered at u = 0.25 -> x = 128) ---
  const bx = 128;

  // Spine furrow + shoulder blade definition
  const spineGrad = ctx.createLinearGradient(bx - 14, 0, bx + 14, 0);
  spineGrad.addColorStop(0, 'rgba(68,34,18,0)');
  spineGrad.addColorStop(0.5, 'rgba(56,26,14,0.52)');
  spineGrad.addColorStop(1, 'rgba(68,34,18,0)');
  ctx.fillStyle = spineGrad;
  ctx.fillRect(bx - 14, 65, 28, 375);

  for (const side of [-1, 1]) {
    const sx = bx + side * 48;
    const latGrad = ctx.createRadialGradient(sx, 160, 10, sx, 175, 65);
    latGrad.addColorStop(0, 'rgba(218, 168, 132, 0.34)');
    latGrad.addColorStop(1, 'rgba(70, 36, 20, 0.38)');
    ctx.fillStyle = latGrad;
    ctx.beginPath();
    ctx.ellipse(sx, 175, 44, 72, side * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle dark tribal tattoos across upper back & shoulders (symmetric flame/hooked warrior ink)
  ctx.save();
  ctx.strokeStyle = 'rgba(28, 22, 20, 0.62)';
  ctx.fillStyle = 'rgba(30, 24, 22, 0.56)';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(bx + side * 10, 62);
    ctx.scale(side, 1);

    // Main sweeping upper-back tribal curve onto shoulder blade
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.bezierCurveTo(22, 18, 34, 42, 26, 78);
    ctx.bezierCurveTo(20, 96, 32, 118, 52, 128);
    ctx.stroke();

    // Inner barbed flame/scroll motifs
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(18, 24);
    ctx.quadraticCurveTo(46, 14, 58, 38);
    ctx.quadraticCurveTo(48, 48, 30, 52);
    ctx.stroke();

    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(28, 58);
    ctx.quadraticCurveTo(64, 54, 76, 82);
    ctx.quadraticCurveTo(56, 84, 40, 86);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(26, 92);
    ctx.quadraticCurveTo(52, 98, 62, 118);
    ctx.stroke();

    ctx.restore();
  }
  ctx.restore();

  return {
    map: finalizeTexture(canvas, true),
    bumpMap: finalizeTexture(bCanvas, false),
  };
}

/**
 * Generates weathered olive-tan skin for muscular right arm, hands, neck.
 */
function createSkinTexture(): THREE.CanvasTexture | null {
  const res = makeCanvas(256, 256);
  if (!res) return null;
  const [canvas, ctx] = res;

  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#be8d6a');
  g.addColorStop(0.5, '#b17e5b');
  g.addColorStop(1, '#9c6c4b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle bicep/forearm shading & veins
  ctx.strokeStyle = 'rgba(72, 42, 26, 0.2)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(32 + i * 38, 20);
    ctx.bezierCurveTo(24 + i * 38, 96, 44 + i * 38, 172, 30 + i * 38, 236);
    ctx.stroke();
  }
  return finalizeTexture(canvas, true);
}

/**
 * Generates stern, intimidating adult male warrior face texture.
 * Mapped for a SphereGeometry rotated -PI/2 around Y so u = 0.5 faces +Z!
 */
function createFaceTexture(): THREE.CanvasTexture | null {
  const res = makeCanvas(512, 256);
  if (!res) return null;
  const [canvas, ctx] = res;

  // Base facial skin tone
  ctx.fillStyle = '#b98664';
  ctx.fillRect(0, 0, 512, 256);

  // Dark hair sides & back of skull (wrapping u < 0.28 and u > 0.72, plus top crown)
  ctx.fillStyle = '#1d1918';
  ctx.fillRect(0, 0, 512, 58);
  ctx.fillRect(0, 0, 152, 256);
  ctx.fillRect(360, 0, 152, 256);

  // Sideburns tapering down temples
  ctx.beginPath();
  ctx.moveTo(150, 56);
  ctx.lineTo(176, 86);
  ctx.lineTo(166, 155);
  ctx.lineTo(148, 155);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(362, 56);
  ctx.lineTo(336, 86);
  ctx.lineTo(346, 155);
  ctx.lineTo(364, 155);
  ctx.closePath();
  ctx.fill();

  const cx = 256;

  // Cheekbone & jawline shadows
  for (const side of [-1, 1]) {
    const cg = ctx.createRadialGradient(cx + side * 44, 148, 6, cx + side * 48, 155, 42);
    cg.addColorStop(0, 'rgba(64, 34, 20, 0.36)');
    cg.addColorStop(1, 'rgba(64, 34, 20, 0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(cx + side * 48, 155, 42, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle jaw stubble
  const stubbleGrad = ctx.createLinearGradient(0, 150, 0, 232);
  stubbleGrad.addColorStop(0, 'rgba(34, 26, 22, 0)');
  stubbleGrad.addColorStop(0.5, 'rgba(34, 26, 22, 0.24)');
  stubbleGrad.addColorStop(1, 'rgba(34, 26, 22, 0.34)');
  ctx.fillStyle = stubbleGrad;
  ctx.fillRect(172, 150, 168, 84);

  // Forehead scowl crease & furrowed brow shadows
  ctx.strokeStyle = 'rgba(72, 38, 22, 0.55)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - 8, 86);
  ctx.lineTo(cx - 5, 103);
  ctx.moveTo(cx + 8, 86);
  ctx.lineTo(cx + 5, 103);
  ctx.stroke();

  // Deep realistic eye sockets
  for (const side of [-1, 1]) {
    const ex = cx + side * 28;
    const ey = 112;

    const socket = ctx.createRadialGradient(ex, ey, 3, ex, ey, 22);
    socket.addColorStop(0, 'rgba(42, 22, 14, 0.65)');
    socket.addColorStop(1, 'rgba(42, 22, 14, 0)');
    ctx.fillStyle = socket;
    ctx.beginPath();
    ctx.ellipse(ex, ey, 22, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Realistic sclera & sharp dark human iris (NO glowing lights)
    ctx.fillStyle = '#ddd2c6';
    ctx.beginPath();
    ctx.ellipse(ex, ey + 2, 11, 5.2, side * -0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#251712';
    ctx.beginPath();
    ctx.arc(ex, ey + 2, 4.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#090707';
    ctx.beginPath();
    ctx.arc(ex, ey + 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Tiny natural specular dot
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    ctx.arc(ex - 1.5, ey + 0.5, 1.0, 0, Math.PI * 2);
    ctx.fill();

    // Fierce lowered heavy dark eyebrows
    ctx.strokeStyle = '#181412';
    ctx.lineWidth = 6.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex - side * 14, ey - 7);
    ctx.quadraticCurveTo(ex + side * 2, ey - 13, ex + side * 16, ey - 10);
    ctx.stroke();
  }

  // Nose bridge highlight & nostrils shadow
  ctx.fillStyle = 'rgba(232, 186, 150, 0.32)';
  ctx.fillRect(cx - 5, 108, 10, 36);
  ctx.fillStyle = 'rgba(54, 26, 16, 0.58)';
  ctx.beginPath();
  ctx.ellipse(cx - 8, 147, 5, 3, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 8, 147, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Serious, clenched stern warrior mouth
  ctx.strokeStyle = '#4a241a';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(cx - 20, 174);
  ctx.quadraticCurveTo(cx, 170, cx + 20, 174);
  ctx.stroke();

  ctx.fillStyle = 'rgba(82, 40, 30, 0.45)';
  ctx.beginPath();
  ctx.ellipse(cx, 177, 17, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  return finalizeTexture(canvas, true);
}

/**
 * Generates dark textured traditional maroon/crimson robe cloth.
 */
function createRobeTexture(): THREE.CanvasTexture | null {
  const res = makeCanvas(256, 256);
  if (!res) return null;
  const [canvas, ctx] = res;

  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#5a1e20');
  g.addColorStop(0.6, '#481518');
  g.addColorStop(1, '#310d10');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  // Heavy woven fabric cross-threads & vertical drapery shadows
  for (let x = 0; x < 256; x += 4) {
    ctx.fillStyle = x % 16 === 0 ? 'rgba(18, 4, 6, 0.25)' : 'rgba(130, 48, 48, 0.1)';
    ctx.fillRect(x, 0, 2, 256);
  }
  for (let y = 0; y < 256; y += 6) {
    ctx.fillStyle = 'rgba(20, 6, 8, 0.14)';
    ctx.fillRect(0, y, 256, 1.5);
  }
  // Subtle weathered hem grime at bottom
  const grime = ctx.createLinearGradient(0, 195, 0, 256);
  grime.addColorStop(0, 'rgba(18,12,10,0)');
  grime.addColorStop(1, 'rgba(18,12,10,0.48)');
  ctx.fillStyle = grime;
  ctx.fillRect(0, 195, 256, 61);

  return finalizeTexture(canvas, true, 1, 1);
}

/**
 * Generates dark charcoal loose combat trousers woven texture.
 */
function createTrousersTexture(): THREE.CanvasTexture | null {
  const res = makeCanvas(256, 256);
  if (!res) return null;
  const [canvas, ctx] = res;

  ctx.fillStyle = '#24272c';
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 8) {
    ctx.strokeStyle = y % 16 === 0 ? 'rgba(10,12,14,0.42)' : 'rgba(72,78,86,0.22)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.quadraticCurveTo(128, y + (y % 16 === 0 ? 7 : -6), 256, y);
    ctx.stroke();
  }
  return finalizeTexture(canvas, true);
}

/**
 * Generates weathered dark brown oiled leather texture (belts, chest plate, shin guards, boots).
 */
function createLeatherTexture(): THREE.CanvasTexture | null {
  const res = makeCanvas(256, 256);
  if (!res) return null;
  const [canvas, ctx] = res;

  ctx.fillStyle = '#3b2417';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(20,10,5,0.22)' : 'rgba(98,64,42,0.16)';
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 8, 2);
  }
  // Stitch borders
  ctx.strokeStyle = 'rgba(145, 110, 74, 0.45)';
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, 240, 240);

  return finalizeTexture(canvas, true);
}

/**
 * Generates tan/ochre woven waist sash & front tasset cloth texture.
 */
function createSashTexture(): THREE.CanvasTexture | null {
  const res = makeCanvas(256, 256);
  if (!res) return null;
  const [canvas, ctx] = res;

  const g = ctx.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, '#70582c');
  g.addColorStop(0.5, '#8e733b');
  g.addColorStop(1, '#634d24');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  for (let x = 0; x < 256; x += 6) {
    ctx.fillStyle = 'rgba(32,24,10,0.16)';
    ctx.fillRect(x, 0, 2, 256);
  }
  return finalizeTexture(canvas, true);
}

/**
 * Generates off-white cloth wrist/hand wrap gauze texture.
 */
function createWrapTexture(): THREE.CanvasTexture | null {
  const res = makeCanvas(128, 128);
  if (!res) return null;
  const [canvas, ctx] = res;

  ctx.fillStyle = '#c4baa4';
  ctx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 16) {
    ctx.fillStyle = 'rgba(65,55,42,0.34)';
    ctx.fillRect(0, y, 128, 3);
    ctx.fillStyle = 'rgba(235,228,212,0.28)';
    ctx.fillRect(0, y + 3, 128, 3);
  }
  return finalizeTexture(canvas, true);
}

/**
 * Generates forged dark steel broadsword blade texture with honed beveled silver edge.
 */
function createSwordBladeTexture(): THREE.CanvasTexture | null {
  const res = makeCanvas(256, 256);
  if (!res) return null;
  const [canvas, ctx] = res;

  // Spine (u near 0..0.55) dark forged iron -> Beveled cutting edge (0.65..1.0) bright steel
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, '#2a3038');
  g.addColorStop(0.55, '#3b424c');
  g.addColorStop(0.68, '#7f8996');
  g.addColorStop(0.92, '#b8c1cc');
  g.addColorStop(1.0, '#dce3ec');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle fuller groove & forge scratches
  ctx.fillStyle = 'rgba(18, 22, 26, 0.55)';
  ctx.fillRect(68, 14, 18, 210);
  for (let i = 0; i < 45; i++) {
    const y = Math.random() * 256;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(155, y);
    ctx.lineTo(252, y - 6 + Math.random() * 12);
    ctx.stroke();
  }
  return finalizeTexture(canvas, true);
}

export function createBeastWarriorMaterials(): BeastWarriorMaterials {
  const { map: torsoMap, bumpMap: torsoBump } = createTorsoTextures();
  const skinMap = createSkinTexture();
  const faceMap = createFaceTexture();
  const robeMap = createRobeTexture();
  const trousersMap = createTrousersTexture();
  const leatherMap = createLeatherTexture();
  const sashMap = createSashTexture();
  const wrapMap = createWrapTexture();
  const bladeMap = createSwordBladeTexture();

  const texturesToDispose: THREE.CanvasTexture[] = [];
  for (const t of [
    torsoMap,
    torsoBump,
    skinMap,
    faceMap,
    robeMap,
    trousersMap,
    leatherMap,
    sashMap,
    wrapMap,
    bladeMap,
  ]) {
    if (t) texturesToDispose.push(t);
  }

  const torsoMat = new THREE.MeshStandardMaterial({
    color: torsoMap ? '#ffffff' : '#b88360',
    map: torsoMap,
    bumpMap: torsoBump,
    bumpScale: 0.018,
    roughness: 0.68,
    metalness: 0.04,
  });

  const skinMat = new THREE.MeshStandardMaterial({
    color: skinMap ? '#ffffff' : '#b88360',
    map: skinMap,
    roughness: 0.66,
    metalness: 0.04,
  });

  const headMat = new THREE.MeshStandardMaterial({
    color: faceMap ? '#ffffff' : '#b88360',
    map: faceMap,
    roughness: 0.65,
    metalness: 0.03,
  });

  const hairMat = new THREE.MeshStandardMaterial({
    color: '#1b1615',
    roughness: 0.78,
    metalness: 0.06,
  });

  const robeMat = new THREE.MeshStandardMaterial({
    color: robeMap ? '#ffffff' : '#4a171a',
    map: robeMap,
    roughness: 0.88,
    metalness: 0.02,
  });

  const robeDoubleMat = new THREE.MeshStandardMaterial({
    color: robeMap ? '#ffffff' : '#4a171a',
    map: robeMap,
    roughness: 0.88,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  const trousersMat = new THREE.MeshStandardMaterial({
    color: trousersMap ? '#ffffff' : '#24272c',
    map: trousersMap,
    roughness: 0.86,
    metalness: 0.03,
  });

  const leatherMat = new THREE.MeshStandardMaterial({
    color: leatherMap ? '#ffffff' : '#3b2417',
    map: leatherMap,
    roughness: 0.56,
    metalness: 0.14,
  });

  const sashMat = new THREE.MeshStandardMaterial({
    color: sashMap ? '#ffffff' : '#806632',
    map: sashMap,
    roughness: 0.84,
    metalness: 0.02,
  });

  const wrapMat = new THREE.MeshStandardMaterial({
    color: wrapMap ? '#ffffff' : '#c4baa4',
    map: wrapMap,
    roughness: 0.9,
    metalness: 0.02,
  });

  const metalMat = new THREE.MeshStandardMaterial({
    color: '#525b66',
    roughness: 0.34,
    metalness: 0.86,
  });

  const swordBladeMat = new THREE.MeshStandardMaterial({
    color: bladeMap ? '#ffffff' : '#8a94a0',
    map: bladeMap,
    roughness: 0.26,
    metalness: 0.9,
  });

  const mats = [
    torsoMat,
    skinMat,
    headMat,
    hairMat,
    robeMat,
    robeDoubleMat,
    trousersMat,
    leatherMat,
    sashMat,
    wrapMat,
    metalMat,
    swordBladeMat,
  ];

  return {
    torsoMat,
    skinMat,
    headMat,
    hairMat,
    robeMat,
    robeDoubleMat,
    trousersMat,
    leatherMat,
    sashMat,
    wrapMat,
    metalMat,
    swordBladeMat,
    dispose: () => {
      mats.forEach((m) => m.dispose());
      texturesToDispose.forEach((t) => t.dispose());
    },
  };
}
