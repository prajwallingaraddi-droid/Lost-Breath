import * as THREE from 'three';

export interface PlayerSurvivorMaterials {
  tunicMat: THREE.MeshStandardMaterial;
  tunicDoubleMat: THREE.MeshStandardMaterial;
  trousersMat: THREE.MeshStandardMaterial;
  beltLeatherMat: THREE.MeshStandardMaterial;
  bootLeatherMat: THREE.MeshStandardMaterial;
  bootSoleMat: THREE.MeshStandardMaterial;
  skinMat: THREE.MeshStandardMaterial;
  headMat: THREE.MeshStandardMaterial;
  hairMat: THREE.MeshStandardMaterial;
  shadowMat: THREE.MeshBasicMaterial;
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
 * Generates realistic weathered cream / flax linen tunic albedo + bump textures
 * matching the player character reference image:
 * - Warm off-white / cream linen weave with subtle vertical slub threads & patina
 * - Centered front V-notch neckline seam at u = 0.75 (for LatheGeometry rotated +PI/2)
 * - Subtle stitched hem border and natural waist gathering creases
 */
function createLinenTunicTextures(): {
  map: THREE.CanvasTexture | null;
  bumpMap: THREE.CanvasTexture | null;
} {
  const res = makeCanvas(512, 512);
  const bRes = makeCanvas(512, 512);
  if (!res || !bRes) return { map: null, bumpMap: null };

  const [canvas, ctx] = res;
  const [bCanvas, bCtx] = bRes;

  // Base warm cream/oatmeal linen gradient matching reference
  const baseGrad = ctx.createLinearGradient(0, 0, 0, 512);
  baseGrad.addColorStop(0, '#ddd0ab');
  baseGrad.addColorStop(0.5, '#cbb98e');
  baseGrad.addColorStop(0.82, '#bda87c');
  baseGrad.addColorStop(1, '#a99368');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, 512, 512);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 512, 512);

  // Woven linen warp & weft threads (authentic textile micro-texture)
  for (let x = 0; x < 512; x += 3) {
    const shade = (x * 17) % 5 === 0 ? 'rgba(92,76,48,0.12)' : 'rgba(255,248,228,0.09)';
    ctx.fillStyle = shade;
    ctx.fillRect(x, 0, 1.5, 512);

    bCtx.fillStyle = x % 6 === 0 ? '#909090' : '#747474';
    bCtx.fillRect(x, 0, 1.5, 512);
  }
  for (let y = 0; y < 512; y += 3) {
    const shade = (y * 13) % 7 === 0 ? 'rgba(84,68,42,0.11)' : 'rgba(250,242,216,0.07)';
    ctx.fillStyle = shade;
    ctx.fillRect(0, y, 512, 1.4);

    bCtx.fillStyle = y % 6 === 0 ? '#8c8c8c' : '#767676';
    bCtx.fillRect(0, y, 512, 1.2);
  }

  // Subtle organic fabric patina / weathering mottling (matching reference linen cloth)
  for (let i = 0; i < 160; i++) {
    const rx = ((i * 97) % 512);
    const ry = ((i * 61 + 29) % 512);
    const rad = 18 + (i % 26);
    const mGrad = ctx.createRadialGradient(rx, ry, 2, rx, ry, rad);
    if (i % 2 === 0) {
      mGrad.addColorStop(0, 'rgba(112, 92, 58, 0.12)');
      mGrad.addColorStop(1, 'rgba(112, 92, 58, 0)');
    } else {
      mGrad.addColorStop(0, 'rgba(246, 236, 206, 0.1)');
      mGrad.addColorStop(1, 'rgba(246, 236, 206, 0)');
    }
    ctx.fillStyle = mGrad;
    ctx.beginPath();
    ctx.arc(rx, ry, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Vertical drape shadows gathering near waist (y ~ 310..420)
  for (let k = 0; k < 18; k++) {
    const fx = (k / 18) * 512 + 12;
    const fGrad = ctx.createLinearGradient(fx - 10, 0, fx + 10, 0);
    fGrad.addColorStop(0, 'rgba(72, 56, 34, 0)');
    fGrad.addColorStop(0.5, 'rgba(72, 56, 34, 0.18)');
    fGrad.addColorStop(1, 'rgba(72, 56, 34, 0)');
    ctx.fillStyle = fGrad;
    ctx.fillRect(fx - 10, 260, 20, 240);

    bCtx.fillStyle = 'rgba(54, 54, 54, 0.35)';
    bCtx.fillRect(fx - 3, 265, 6, 235);
  }

  // Front V-notch neckline cutout + natural chest skin reveal (centered at u = 0.75 -> x = 384)
  const fx = 384;
  ctx.fillStyle = '#cf9e7d';
  ctx.beginPath();
  ctx.moveTo(fx - 32, 0);
  ctx.lineTo(fx + 32, 0);
  ctx.lineTo(fx + 14, 42);
  ctx.lineTo(fx, 108);
  ctx.lineTo(fx - 14, 42);
  ctx.closePath();
  ctx.fill();

  // Collarbone shadow inside V-notch
  const neckShadow = ctx.createLinearGradient(fx, 0, fx, 108);
  neckShadow.addColorStop(0, 'rgba(130, 84, 58, 0.25)');
  neckShadow.addColorStop(1, 'rgba(92, 54, 34, 0.45)');
  ctx.fillStyle = neckShadow;
  ctx.beginPath();
  ctx.moveTo(fx - 14, 42);
  ctx.lineTo(fx + 14, 42);
  ctx.lineTo(fx, 108);
  ctx.closePath();
  ctx.fill();

  // Stitched neckline trim around the V-slit
  ctx.strokeStyle = '#6f5a38';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(fx - 34, 2);
  ctx.lineTo(fx - 14, 44);
  ctx.lineTo(fx, 110);
  ctx.lineTo(fx + 14, 44);
  ctx.lineTo(fx + 34, 2);
  ctx.stroke();

  // Subtle stitched bottom hem border
  ctx.strokeStyle = 'rgba(96, 78, 48, 0.55)';
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 496);
  ctx.lineTo(512, 496);
  ctx.stroke();
  ctx.setLineDash([]);

  return {
    map: finalizeTexture(canvas, true),
    bumpMap: finalizeTexture(bCanvas, false),
  };
}

/**
 * Generates dark brown ribbed woven trousers texture matching the reference image.
 */
function createDarkBrownTrousersTextures(): {
  map: THREE.CanvasTexture | null;
  bumpMap: THREE.CanvasTexture | null;
} {
  const res = makeCanvas(256, 256);
  const bRes = makeCanvas(256, 256);
  if (!res || !bRes) return { map: null, bumpMap: null };

  const [canvas, ctx] = res;
  const [bCanvas, bCtx] = bRes;

  const base = ctx.createLinearGradient(0, 0, 0, 256);
  base.addColorStop(0, '#513723');
  base.addColorStop(0.55, '#462f1d');
  base.addColorStop(1, '#392516');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);

  // Fine vertical corduroy / heavy twill weave ribs (visible in reference trousers)
  for (let x = 0; x < 256; x += 4) {
    ctx.fillStyle = 'rgba(24, 14, 8, 0.24)';
    ctx.fillRect(x, 0, 1.6, 256);
    ctx.fillStyle = 'rgba(116, 82, 52, 0.14)';
    ctx.fillRect(x + 2, 0, 1.4, 256);

    bCtx.fillStyle = '#626262';
    bCtx.fillRect(x, 0, 1.8, 256);
    bCtx.fillStyle = '#9c9c9c';
    bCtx.fillRect(x + 2, 0, 1.8, 256);
  }

  // Subtle knee / thigh fold creases
  for (let y = 24; y < 240; y += 34) {
    ctx.strokeStyle = 'rgba(22, 12, 6, 0.22)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.quadraticCurveTo(128, y + (y % 68 === 0 ? 5 : -5), 256, y);
    ctx.stroke();
  }

  // Bottom hem stitching
  ctx.strokeStyle = 'rgba(128, 92, 62, 0.42)';
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, 246);
  ctx.lineTo(256, 246);
  ctx.stroke();

  return {
    map: finalizeTexture(canvas, true),
    bumpMap: finalizeTexture(bCanvas, false),
  };
}

/**
 * Generates grained brown leather texture for waist belt and lace-up survivor boots.
 */
function createBrownLeatherTexture(baseHex: string, highlightHex: string): THREE.CanvasTexture | null {
  const res = makeCanvas(256, 256);
  if (!res) return null;
  const [canvas, ctx] = res;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 750; i++) {
    const x = (i * 53) % 256;
    const y = (i * 97 + 17) % 256;
    const w = 3 + (i % 9);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(18, 9, 4, 0.22)' : highlightHex;
    ctx.fillRect(x, y, w, 1.8);
  }

  // Saddle-stitched leather edge
  ctx.strokeStyle = 'rgba(180, 140, 96, 0.42)';
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.8;
  ctx.strokeRect(10, 10, 236, 236);

  return finalizeTexture(canvas, true);
}

/**
 * Generates natural human skin texture for forearms, hands, neck, and calves.
 */
function createHumanSkinTexture(): THREE.CanvasTexture | null {
  const res = makeCanvas(256, 256);
  if (!res) return null;
  const [canvas, ctx] = res;

  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#d8aa8b');
  g.addColorStop(0.5, '#cfa080');
  g.addColorStop(1, '#c08f6f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle realistic skin warmth & fine texture
  for (let i = 0; i < 900; i++) {
    const x = (i * 41) % 256;
    const y = (i * 73 + 11) % 256;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(148, 86, 62, 0.06)' : 'rgba(255, 224, 202, 0.06)';
    ctx.fillRect(x, y, 2, 2);
  }

  // Subtle natural forearm shading
  ctx.strokeStyle = 'rgba(128, 76, 58, 0.12)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(40 + i * 54, 22);
    ctx.bezierCurveTo(32 + i * 54, 96, 48 + i * 54, 168, 38 + i * 54, 236);
    ctx.stroke();
  }

  return finalizeTexture(canvas, true);
}

/**
 * Generates realistic adult male survivor face texture matching the attached reference image,
 * with natural warm skin tone, dark brown eyes, trimmed beard/stubble, and short brown hairline.
 * Mapped to SphereGeometry rotated -PI/2 around Y so u = 0.5 faces +Z.
 */
function createSurvivorFaceTexture(): THREE.CanvasTexture | null {
  const res = makeCanvas(512, 256);
  if (!res) return null;
  const [canvas, ctx] = res;

  // Natural warm survivor skin base
  const skinGrad = ctx.createLinearGradient(0, 48, 0, 256);
  skinGrad.addColorStop(0, '#d7a98a');
  skinGrad.addColorStop(0.55, '#cf9d7d');
  skinGrad.addColorStop(1, '#bf8c6d');
  ctx.fillStyle = skinGrad;
  ctx.fillRect(0, 0, 512, 256);

  // Subtle realistic pore / complexion grain
  for (let i = 0; i < 1200; i++) {
    const x = (i * 67) % 512;
    const y = 40 + ((i * 43) % 200);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(130, 74, 54, 0.06)' : 'rgba(255, 224, 204, 0.05)';
    ctx.fillRect(x, y, 2, 2);
  }

  // Short brown hair covering crown, sides, and back of head
  ctx.fillStyle = '#473020';
  ctx.fillRect(0, 0, 512, 56);
  ctx.fillRect(0, 0, 148, 198);
  ctx.fillRect(364, 0, 148, 198);

  // Tapered hairline & natural sideburns along temples
  ctx.fillStyle = '#4a3222';
  ctx.beginPath();
  ctx.moveTo(146, 52);
  ctx.quadraticCurveTo(200, 44, 256, 50);
  ctx.quadraticCurveTo(312, 44, 366, 52);
  ctx.lineTo(366, 66);
  ctx.quadraticCurveTo(306, 56, 256, 62);
  ctx.quadraticCurveTo(206, 56, 146, 66);
  ctx.closePath();
  ctx.fill();

  // Left & right sideburns blending smoothly into jaw stubble
  for (const side of [-1, 1]) {
    const sx = side === -1 ? 148 : 364;
    ctx.fillStyle = 'rgba(72, 48, 32, 0.85)';
    ctx.beginPath();
    ctx.moveTo(sx, 54);
    ctx.lineTo(sx - side * 22, 86);
    ctx.lineTo(sx - side * 14, 152);
    ctx.lineTo(sx, 152);
    ctx.closePath();
    ctx.fill();
  }

  const cx = 256;

  // Natural cheekbone warmth & gentle under-cheek shading
  for (const side of [-1, 1]) {
    const cheek = ctx.createRadialGradient(cx + side * 44, 136, 4, cx + side * 46, 142, 34);
    cheek.addColorStop(0, 'rgba(196, 118, 96, 0.22)');
    cheek.addColorStop(1, 'rgba(196, 118, 96, 0)');
    ctx.fillStyle = cheek;
    ctx.beginPath();
    ctx.arc(cx + side * 46, 142, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  // Trimmed short brown beard / stubble & moustache (matching the reference portrait closely)
  const beardGrad = ctx.createRadialGradient(cx, 198, 18, cx, 194, 86);
  beardGrad.addColorStop(0, 'rgba(64, 44, 30, 0.56)');
  beardGrad.addColorStop(0.7, 'rgba(64, 44, 30, 0.36)');
  beardGrad.addColorStop(1, 'rgba(64, 44, 30, 0)');
  ctx.fillStyle = beardGrad;
  ctx.beginPath();
  ctx.ellipse(cx, 196, 78, 46, 0, 0, Math.PI * 2);
  ctx.fill();

  // Fine stubble stipple across jaw and chin
  for (let i = 0; i < 480; i++) {
    const angle = (i * 2.39996) % (Math.PI * 2);
    const rad = Math.sqrt((i % 480) / 480);
    const bx = cx + Math.cos(angle) * rad * 72;
    const by = 194 + Math.sin(angle) * rad * 38;
    if (by > 152 && by < 238) {
      ctx.fillStyle = i % 3 === 0 ? 'rgba(46, 31, 22, 0.45)' : 'rgba(84, 58, 40, 0.32)';
      ctx.fillRect(bx, by, 1.8, 1.8);
    }
  }

  // Moustache arching above upper lip (matching reference)
  ctx.strokeStyle = 'rgba(54, 36, 24, 0.72)';
  ctx.lineWidth = 6.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 24, 170);
  ctx.quadraticCurveTo(cx, 162, cx + 24, 170);
  ctx.stroke();

  // Realistic alert human eyes (natural, non-monstrous, NO glowing effect)
  for (const side of [-1, 1]) {
    const ex = cx + side * 27;
    const ey = 114;

    // Soft natural orbital shadow
    const socket = ctx.createRadialGradient(ex, ey, 3, ex, ey, 20);
    socket.addColorStop(0, 'rgba(104, 64, 46, 0.44)');
    socket.addColorStop(1, 'rgba(104, 64, 46, 0)');
    ctx.fillStyle = socket;
    ctx.beginPath();
    ctx.ellipse(ex, ey, 20, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sclera
    ctx.fillStyle = '#ece4da';
    ctx.beginPath();
    ctx.ellipse(ex, ey + 1, 10.5, 5.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Warm dark-brown iris
    ctx.fillStyle = '#472e1e';
    ctx.beginPath();
    ctx.arc(ex, ey + 1, 4.7, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = '#120c09';
    ctx.beginPath();
    ctx.arc(ex, ey + 1, 2.4, 0, Math.PI * 2);
    ctx.fill();

    // Subtle natural specular eye catchlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.beginPath();
    ctx.arc(ex - 1.6, ey - 0.5, 1.1, 0, Math.PI * 2);
    ctx.fill();

    // Upper eyelid lash line
    ctx.strokeStyle = '#332116';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.ellipse(ex, ey + 0.5, 10.8, 5.4, 0, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();

    // Natural brown eyebrows (calm/focused human survivor expression)
    ctx.strokeStyle = '#3e291b';
    ctx.lineWidth = 5.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex - side * 13, ey - 10);
    ctx.quadraticCurveTo(ex, ey - 14, ex + side * 14, ey - 9);
    ctx.stroke();
  }

  // Nose bridge highlight & subtle nostrils
  ctx.fillStyle = 'rgba(246, 208, 180, 0.32)';
  ctx.fillRect(cx - 4.5, 110, 9, 34);
  ctx.fillStyle = 'rgba(98, 56, 38, 0.5)';
  ctx.beginPath();
  ctx.ellipse(cx - 7, 148, 4.4, 2.5, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 7, 148, 4.4, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Natural closed survivor mouth beneath moustache
  ctx.fillStyle = '#a46456';
  ctx.beginPath();
  ctx.ellipse(cx, 178, 15, 3.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5c3228';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(cx - 17, 177);
  ctx.quadraticCurveTo(cx, 175.5, cx + 17, 177);
  ctx.stroke();

  return finalizeTexture(canvas, true);
}

/**
 * Generates textured short brown hair strand map.
 */
function createShortBrownHairTexture(): THREE.CanvasTexture | null {
  const res = makeCanvas(256, 256);
  if (!res) return null;
  const [canvas, ctx] = res;

  ctx.fillStyle = '#473020';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 600; i++) {
    const x = (i * 31) % 256;
    const y = (i * 47) % 256;
    ctx.strokeStyle =
      i % 3 === 0
        ? 'rgba(34, 20, 12, 0.45)'
        : i % 3 === 1
          ? 'rgba(104, 72, 48, 0.35)'
          : 'rgba(72, 46, 28, 0.38)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + ((i % 5) - 2) * 3, y + 14 + (i % 10));
    ctx.stroke();
  }
  return finalizeTexture(canvas, true, 2, 2);
}

/**
 * Generates a soft radial contact shadow disc for floor grounding.
 */
function createContactShadowTexture(): THREE.CanvasTexture | null {
  const res = makeCanvas(128, 128);
  if (!res) return null;
  const [canvas, ctx] = res;

  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(4, 6, 10, 0.65)');
  grad.addColorStop(0.55, 'rgba(4, 6, 10, 0.28)');
  grad.addColorStop(1, 'rgba(4, 6, 10, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  return finalizeTexture(canvas, true);
}

export function createPlayerSurvivorMaterials(): PlayerSurvivorMaterials {
  const { map: tunicMap, bumpMap: tunicBump } = createLinenTunicTextures();
  const { map: trousersMap, bumpMap: trousersBump } = createDarkBrownTrousersTextures();
  const beltLeatherMap = createBrownLeatherTexture('#5a3922', 'rgba(142, 98, 62, 0.24)');
  const bootLeatherMap = createBrownLeatherTexture('#3f2617', 'rgba(116, 76, 46, 0.22)');
  const skinMap = createHumanSkinTexture();
  const faceMap = createSurvivorFaceTexture();
  const hairMap = createShortBrownHairTexture();
  const shadowMap = createContactShadowTexture();

  const texturesToDispose: THREE.CanvasTexture[] = [];
  for (const tex of [
    tunicMap,
    tunicBump,
    trousersMap,
    trousersBump,
    beltLeatherMap,
    bootLeatherMap,
    skinMap,
    faceMap,
    hairMap,
    shadowMap,
  ]) {
    if (tex) texturesToDispose.push(tex);
  }

  const tunicMat = new THREE.MeshStandardMaterial({
    color: tunicMap ? '#ffffff' : '#cbb98e',
    map: tunicMap,
    bumpMap: tunicBump,
    bumpScale: 0.014,
    roughness: 0.88,
    metalness: 0.02,
  });

  const tunicDoubleMat = new THREE.MeshStandardMaterial({
    color: tunicMap ? '#ffffff' : '#cbb98e',
    map: tunicMap,
    bumpMap: tunicBump,
    bumpScale: 0.012,
    roughness: 0.88,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  const trousersMat = new THREE.MeshStandardMaterial({
    color: trousersMap ? '#ffffff' : '#462f1d',
    map: trousersMap,
    bumpMap: trousersBump,
    bumpScale: 0.014,
    roughness: 0.86,
    metalness: 0.02,
  });

  // Lower roughness on leather belt & boots (0.46) gives strong PBR contrast against matte linen (0.88)
  const beltLeatherMat = new THREE.MeshStandardMaterial({
    color: beltLeatherMap ? '#ffffff' : '#5a3922',
    map: beltLeatherMap,
    roughness: 0.48,
    metalness: 0.12,
  });

  const bootLeatherMat = new THREE.MeshStandardMaterial({
    color: bootLeatherMap ? '#ffffff' : '#3f2617',
    map: bootLeatherMap,
    roughness: 0.46,
    metalness: 0.14,
  });

  const bootSoleMat = new THREE.MeshStandardMaterial({
    color: '#22150e',
    roughness: 0.82,
    metalness: 0.06,
  });

  const skinMat = new THREE.MeshStandardMaterial({
    color: skinMap ? '#ffffff' : '#cfa080',
    map: skinMap,
    roughness: 0.62,
    metalness: 0.02,
  });

  const headMat = new THREE.MeshStandardMaterial({
    color: faceMap ? '#ffffff' : '#cf9d7d',
    map: faceMap,
    roughness: 0.6,
    metalness: 0.02,
  });

  const hairMat = new THREE.MeshStandardMaterial({
    color: hairMap ? '#ffffff' : '#473020',
    map: hairMap,
    roughness: 0.78,
    metalness: 0.04,
  });

  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowMap,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });

  const mats: THREE.Material[] = [
    tunicMat,
    tunicDoubleMat,
    trousersMat,
    beltLeatherMat,
    bootLeatherMat,
    bootSoleMat,
    skinMat,
    headMat,
    hairMat,
    shadowMat,
  ];

  return {
    tunicMat,
    tunicDoubleMat,
    trousersMat,
    beltLeatherMat,
    bootLeatherMat,
    bootSoleMat,
    skinMat,
    headMat,
    hairMat,
    shadowMat,
    dispose: () => {
      mats.forEach((m) => m.dispose());
      texturesToDispose.forEach((t) => t.dispose());
    },
  };
}
