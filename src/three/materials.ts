import * as THREE from 'three';
import { ProceduralTextureSet } from './proceduralTextures';

export interface IndustrialMaterialLibrary {
  concreteWall: THREE.MeshStandardMaterial;
  concreteExterior: THREE.MeshStandardMaterial;
  paintedWall: THREE.MeshStandardMaterial;
  concreteFloor: THREE.MeshStandardMaterial;
  corridorDeck: THREE.MeshStandardMaterial;
  darkAccentTile: THREE.MeshStandardMaterial;
  apartmentWood: THREE.MeshStandardMaterial;
  cabinetWood: THREE.MeshStandardMaterial;
  apartmentDoor: THREE.MeshStandardMaterial;
  structuralSteel: THREE.MeshStandardMaterial;
  brushedSteel: THREE.MeshStandardMaterial;
  railingSteel: THREE.MeshStandardMaterial;
  brassTrim: THREE.MeshStandardMaterial;
  diamondTread: THREE.MeshStandardMaterial;
  stairConcrete: THREE.MeshStandardMaterial;
  stairNosing: THREE.MeshStandardMaterial;
  stairGlass: THREE.MeshStandardMaterial;
  hazardStripe: THREE.MeshStandardMaterial;
  safetyYellow: THREE.MeshStandardMaterial;
  coolantPipe: THREE.MeshStandardMaterial;
  steamPipe: THREE.MeshStandardMaterial;
  portholeGlass: THREE.MeshPhysicalMaterial;
  escapeZoneFloor: THREE.MeshStandardMaterial;
  puzzleZoneFloor: THREE.MeshStandardMaterial;
  exitZoneFloor: THREE.MeshStandardMaterial;
  fabricSlate: THREE.MeshStandardMaterial;
  counterTop: THREE.MeshStandardMaterial;
  suspendedCeiling: THREE.MeshStandardMaterial;
  fluorescentOn: THREE.MeshStandardMaterial;
  fluorescentDim: THREE.MeshStandardMaterial;
  fluorescentOff: THREE.MeshStandardMaterial;
  fluorescentGlow: THREE.MeshBasicMaterial;
  baseboardDark: THREE.MeshStandardMaterial;
  fireRed: THREE.MeshStandardMaterial;
  ventGrille: THREE.MeshStandardMaterial;
  paperSheet: THREE.MeshStandardMaterial;
  cardboardBox: THREE.MeshStandardMaterial;
  smokeDetector: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function createIndustrialMaterials(
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean
): IndustrialMaterialLibrary {
  // Light concrete grey walls (#A6A6A0) for strong visual contrast against charcoal-black flooring
  const concreteWall = new THREE.MeshStandardMaterial({
    map: textures.paintedWallAlbedo,
    bumpMap: textures.paintedWallBump,
    bumpScale: 0.028,
    roughnessMap: textures.paintedWallRoughness,
    color: '#e5e5de',
    roughness: 0.9,
    metalness: 0.03,
    envMapIntensity: 0.52,
  });

  const paintedWall = new THREE.MeshStandardMaterial({
    map: textures.paintedWallAlbedo,
    bumpMap: textures.paintedWallBump,
    bumpScale: 0.02,
    color: '#e8e8e1',
    roughness: 0.88,
    metalness: 0.03,
    envMapIntensity: 0.48,
  });

  const concreteExterior = new THREE.MeshStandardMaterial({
    map: textures.concreteAlbedo,
    bumpMap: textures.concreteBump,
    bumpScale: 0.038,
    color: '#a8a8a0',
    roughness: 0.92,
    metalness: 0.05,
    envMapIntensity: 0.48,
  });

  // Charcoal-black / dark graphite industrial concrete flooring (#202124) across all 4 floors
  const concreteFloor = new THREE.MeshStandardMaterial({
    map: textures.floorTileAlbedo,
    bumpMap: textures.floorTileBump,
    bumpScale: 0.024,
    roughnessMap: textures.floorTileRoughness,
    color: '#e2e5e9',
    roughness: 0.72,
    metalness: 0.16,
    envMapIntensity: 1.4,
  });

  const corridorDeck = new THREE.MeshStandardMaterial({
    map: textures.floorTileAlbedo,
    bumpMap: textures.floorTileBump,
    bumpScale: 0.02,
    roughnessMap: textures.floorTileRoughness,
    color: '#dce0e5',
    roughness: 0.72,
    metalness: 0.16,
    envMapIntensity: 1.38,
  });

  // Honed dark graphite / basalt corridor center runner slabs
  const darkAccentTile = new THREE.MeshStandardMaterial({
    map: textures.darkFloorTileAlbedo,
    bumpMap: textures.concreteBump,
    bumpScale: 0.012,
    color: '#dce2e8',
    roughness: 0.28,
    metalness: 0.24,
    envMapIntensity: 1.55,
  });

  const apartmentWood = new THREE.MeshStandardMaterial({
    map: textures.apartmentWoodAlbedo,
    color: '#7c766d',
    roughness: 0.78,
    metalness: 0.05,
    envMapIntensity: 0.65,
  });

  const cabinetWood = new THREE.MeshStandardMaterial({
    map: textures.apartmentWoodAlbedo,
    color: '#5f564b',
    roughness: 0.74,
    metalness: 0.06,
    envMapIntensity: 0.55,
  });

  // Dark industrial steel doors (#343638)
  const apartmentDoor = new THREE.MeshStandardMaterial({
    map: textures.industrialDoorAlbedo,
    bumpMap: textures.industrialDoorBump,
    bumpScale: 0.024,
    color: '#dadde0',
    roughness: 0.38,
    metalness: 0.62,
    envMapIntensity: 1.2,
  });

  // Aged industrial structural steel
  const structuralSteel = new THREE.MeshStandardMaterial({
    color: '#2c3035',
    roughness: 0.48,
    metalness: 0.78,
    envMapIntensity: 1.05,
  });

  const railingSteel = new THREE.MeshStandardMaterial({
    color: '#373c43',
    roughness: 0.4,
    metalness: 0.82,
    envMapIntensity: 1.15,
  });

  const brushedSteel = new THREE.MeshStandardMaterial({
    map: textures.brushedSteel,
    color: '#b4bcc4',
    roughness: 0.28,
    metalness: 0.88,
    envMapIntensity: 1.35,
  });

  const brassTrim = new THREE.MeshStandardMaterial({
    color: '#a89668',
    roughness: 0.36,
    metalness: 0.82,
  });

  const diamondTread = new THREE.MeshStandardMaterial({
    map: textures.diamondPlate,
    color: '#7a828a',
    roughness: 0.46,
    metalness: 0.68,
  });

  const stairConcrete = new THREE.MeshStandardMaterial({
    map: textures.concreteAlbedo,
    bumpMap: textures.concreteBump,
    bumpScale: 0.024,
    color: '#7e848a',
    roughness: 0.84,
    metalness: 0.06,
    envMapIntensity: 0.6,
  });

  const stairNosing = new THREE.MeshStandardMaterial({
    map: textures.brushedSteel,
    color: '#343b42',
    roughness: 0.38,
    metalness: 0.74,
  });

  const stairGlass = new THREE.MeshStandardMaterial({
    color: '#465460',
    roughness: 0.14,
    metalness: 0.18,
    transparent: true,
    opacity: isSoftwareGl ? 0.32 : 0.36,
    depthWrite: false,
    side: THREE.DoubleSide,
    envMapIntensity: 1.3,
  });

  const hazardStripe = new THREE.MeshStandardMaterial({
    map: textures.hazardStripe,
    roughness: 0.62,
    metalness: 0.18,
  });

  const safetyYellow = new THREE.MeshStandardMaterial({
    color: '#b89428',
    roughness: 0.48,
    metalness: 0.26,
  });

  const coolantPipe = new THREE.MeshStandardMaterial({
    color: '#3c5868',
    roughness: 0.44,
    metalness: 0.58,
  });

  const steamPipe = new THREE.MeshStandardMaterial({
    color: '#5c646c',
    roughness: 0.46,
    metalness: 0.68,
  });

  const portholeGlass = new THREE.MeshPhysicalMaterial({
    color: '#9dbbc6',
    roughness: 0.14,
    metalness: 0.05,
    transmission: isSoftwareGl ? 0 : 0.7,
    transparent: true,
    opacity: isSoftwareGl ? 0.42 : 0.86,
    ior: 1.5,
    thickness: 0.2,
    depthWrite: false,
  });

  // Subtle dark graphite-tinted special room floor markers preserving industrial black floor aesthetic
  const escapeZoneFloor = new THREE.MeshStandardMaterial({
    map: textures.floorTileAlbedo,
    bumpMap: textures.floorTileBump,
    bumpScale: 0.018,
    roughnessMap: textures.floorTileRoughness,
    color: '#c9a67d',
    roughness: 0.78,
    metalness: 0.2,
    envMapIntensity: 1.25,
  });

  const puzzleZoneFloor = new THREE.MeshStandardMaterial({
    map: textures.floorTileAlbedo,
    bumpMap: textures.floorTileBump,
    bumpScale: 0.018,
    roughnessMap: textures.floorTileRoughness,
    color: '#88b2cc',
    roughness: 0.76,
    metalness: 0.22,
    envMapIntensity: 1.3,
  });

  const exitZoneFloor = new THREE.MeshStandardMaterial({
    map: textures.floorTileAlbedo,
    bumpMap: textures.floorTileBump,
    bumpScale: 0.018,
    roughnessMap: textures.floorTileRoughness,
    color: '#7db892',
    roughness: 0.74,
    metalness: 0.2,
    envMapIntensity: 1.25,
  });

  const fabricSlate = new THREE.MeshStandardMaterial({
    color: '#3f464e',
    roughness: 0.94,
    metalness: 0.02,
  });

  const counterTop = new THREE.MeshStandardMaterial({
    color: '#adb4ba',
    roughness: 0.42,
    metalness: 0.14,
  });

  // Pale industrial grey suspended acoustic ceiling (#D0CEC5)
  const suspendedCeiling = new THREE.MeshStandardMaterial({
    map: textures.ceilingTileAlbedo,
    bumpMap: textures.ceilingTileBump,
    bumpScale: 0.02,
    color: '#f2f0e8',
    roughness: 0.88,
    metalness: 0.04,
    envMapIntensity: 0.45,
  });

  // Warm industrial ceiling light diffuser (restrained emissive to avoid excessive bloom)
  const fluorescentOn = new THREE.MeshStandardMaterial({
    map: textures.fluorescentDiffuserAlbedo,
    color: '#fff4e0',
    emissive: '#f5cfa0',
    emissiveMap: textures.fluorescentDiffuserAlbedo,
    emissiveIntensity: 1.45,
    roughness: 0.24,
    metalness: 0.04,
  });

  const fluorescentDim = new THREE.MeshStandardMaterial({
    map: textures.fluorescentDiffuserAlbedo,
    color: '#7a7064',
    emissive: '#9c7e58',
    emissiveIntensity: 0.28,
    roughness: 0.35,
    metalness: 0.08,
  });

  const fluorescentOff = new THREE.MeshStandardMaterial({
    map: textures.fluorescentDiffuserAlbedo,
    color: '#3a3d42',
    emissive: '#14161a',
    emissiveIntensity: 0.06,
    roughness: 0.45,
    metalness: 0.1,
  });

  // Restrained warm industrial downward light haze (no excessive bloom)
  const fluorescentGlow = new THREE.MeshBasicMaterial({
    color: '#f5d4a6',
    alphaMap: textures.lightConeAlpha,
    transparent: true,
    opacity: 0.055,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  // Dark charcoal corridor skirting baseboards grounding the light grey walls to the black floor
  const baseboardDark = new THREE.MeshStandardMaterial({
    color: '#15181c',
    roughness: 0.54,
    metalness: 0.28,
  });

  const fireRed = new THREE.MeshStandardMaterial({
    color: '#8d2424',
    roughness: 0.44,
    metalness: 0.34,
  });

  const ventGrille = new THREE.MeshStandardMaterial({
    color: '#252b30',
    roughness: 0.55,
    metalness: 0.62,
  });

  const paperSheet = new THREE.MeshStandardMaterial({
    map: textures.paperSheetAlbedo,
    color: '#d6d4cc',
    roughness: 0.92,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  const cardboardBox = new THREE.MeshStandardMaterial({
    map: textures.cardboardAlbedo,
    color: '#8e8474',
    roughness: 0.94,
    metalness: 0.02,
  });

  const smokeDetector = new THREE.MeshStandardMaterial({
    color: '#b4babf',
    roughness: 0.55,
    metalness: 0.06,
  });

  const all: THREE.Material[] = [
    concreteWall,
    paintedWall,
    concreteExterior,
    concreteFloor,
    corridorDeck,
    darkAccentTile,
    apartmentWood,
    cabinetWood,
    apartmentDoor,
    structuralSteel,
    railingSteel,
    brushedSteel,
    brassTrim,
    diamondTread,
    stairConcrete,
    stairNosing,
    stairGlass,
    hazardStripe,
    safetyYellow,
    coolantPipe,
    steamPipe,
    portholeGlass,
    escapeZoneFloor,
    puzzleZoneFloor,
    exitZoneFloor,
    fabricSlate,
    counterTop,
    suspendedCeiling,
    fluorescentOn,
    fluorescentDim,
    fluorescentOff,
    fluorescentGlow,
    baseboardDark,
    fireRed,
    ventGrille,
    paperSheet,
    cardboardBox,
    smokeDetector,
  ];

  return {
    concreteWall,
    paintedWall,
    concreteExterior,
    concreteFloor,
    corridorDeck,
    darkAccentTile,
    apartmentWood,
    cabinetWood,
    apartmentDoor,
    structuralSteel,
    railingSteel,
    brushedSteel,
    brassTrim,
    diamondTread,
    stairConcrete,
    stairNosing,
    stairGlass,
    hazardStripe,
    safetyYellow,
    coolantPipe,
    steamPipe,
    portholeGlass,
    escapeZoneFloor,
    puzzleZoneFloor,
    exitZoneFloor,
    fabricSlate,
    counterTop,
    suspendedCeiling,
    fluorescentOn,
    fluorescentDim,
    fluorescentOff,
    fluorescentGlow,
    baseboardDark,
    fireRed,
    ventGrille,
    paperSheet,
    cardboardBox,
    smokeDetector,
    dispose: () => {
      all.forEach((m) => m.dispose());
    },
  };
}
