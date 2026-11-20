import { FLOOR_ELEVATIONS } from './buildingLayout';
import { FloorNumber, HidingSpotDefinition, HidingSpotType } from '../types/game';

/**
 * 20 believable, corridor-safe hiding structures distributed evenly across all 4 floors
 * (5 per floor across NW, NE, SE, and SW lobbies/lounges).
 * Every collider is tucked flush against outer perimeter walls — completely clear of
 * the 14.8m wrap-around corridor ring, all 80 apartment doorways, staircases, and benches.
 */
interface FloorSpotTemplate {
  suffix: string;
  type: HidingSpotType;
  label: string;
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  rotationY: number;
  hideOffset: [number, number];
  exitOffset: [number, number];
  lookYaw: number;
}

const FLOOR_SPOT_TEMPLATES: FloorSpotTemplate[] = [
  {
    suffix: 'ne-wardrobe',
    type: 'wardrobe',
    label: 'Large Wooden Wardrobe',
    x: 22.8,
    z: -27.18,
    halfX: 0.92,
    halfZ: 0.56,
    rotationY: 0, // Faces South (+Z) into NE lounge
    hideOffset: [0, 0.14],
    exitOffset: [0, 1.38],
    lookYaw: Math.PI,
  },
  {
    suffix: 'ne-crates',
    type: 'crate-stack',
    label: 'Heavy Storage Crates',
    x: 27.1,
    z: -18.2,
    halfX: 0.62,
    halfZ: 0.92,
    rotationY: -Math.PI / 2, // Faces West (-X) into NE lounge
    hideOffset: [-0.12, 0],
    exitOffset: [-1.42, 0],
    lookYaw: Math.PI / 2,
  },
  {
    suffix: 'sw-cabinet',
    type: 'storage-cabinet',
    label: 'Industrial Storage Cabinet',
    x: -22.8,
    z: 27.18,
    halfX: 0.92,
    halfZ: 0.56,
    rotationY: Math.PI, // Faces North (-Z) into SW lounge
    hideOffset: [0, -0.14],
    exitOffset: [0, -1.38],
    lookYaw: 0,
  },
  {
    suffix: 'nw-cupboard',
    type: 'utility-cupboard',
    label: 'Utility Supply Cupboard',
    x: -16.2,
    z: -27.18,
    halfX: 0.84,
    halfZ: 0.56,
    rotationY: 0, // Faces South (+Z) into NW stairwell lobby
    hideOffset: [0, 0.14],
    exitOffset: [0, 1.38],
    lookYaw: Math.PI,
  },
  {
    suffix: 'se-locker',
    type: 'laundry-locker',
    label: 'Corridor Laundry Alcove',
    x: 16.2,
    z: 27.18,
    halfX: 0.84,
    halfZ: 0.56,
    rotationY: Math.PI, // Faces North (-Z) into SE stairwell lobby
    hideOffset: [0, -0.14],
    exitOffset: [0, -1.38],
    lookYaw: 0,
  },
];

export const HIDING_SPOTS: HidingSpotDefinition[] = ([1, 2, 3, 4] as FloorNumber[]).flatMap(
  (floor) => {
    const y = FLOOR_ELEVATIONS[floor];
    return FLOOR_SPOT_TEMPLATES.map((tpl) => ({
      id: `hide-f${floor}-${tpl.suffix}`,
      floor,
      type: tpl.type,
      label: tpl.label,
      position: [tpl.x, y, tpl.z] as [number, number, number],
      rotationY: tpl.rotationY,
      colliderBox: {
        minX: tpl.x - tpl.halfX,
        maxX: tpl.x + tpl.halfX,
        minZ: tpl.z - tpl.halfZ,
        maxZ: tpl.z + tpl.halfZ,
      },
      hidePos: [tpl.x + tpl.hideOffset[0], y, tpl.z + tpl.hideOffset[1]] as [
        number,
        number,
        number,
      ],
      exitPos: [tpl.x + tpl.exitOffset[0], y, tpl.z + tpl.exitOffset[1]] as [
        number,
        number,
        number,
      ],
      lookYaw: tpl.lookYaw,
    }));
  }
);

export const HIDING_SPOTS_BY_FLOOR: Record<FloorNumber, HidingSpotDefinition[]> = {
  1: HIDING_SPOTS.filter((s) => s.floor === 1),
  2: HIDING_SPOTS.filter((s) => s.floor === 2),
  3: HIDING_SPOTS.filter((s) => s.floor === 3),
  4: HIDING_SPOTS.filter((s) => s.floor === 4),
};

export function getHidingSpotById(id: string | null): HidingSpotDefinition | undefined {
  if (!id) return undefined;
  return HIDING_SPOTS.find((s) => s.id === id);
}
