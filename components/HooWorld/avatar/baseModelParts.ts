import type {
  HooWorldPlayerFacing,
} from "../characters/types";

export type HooBaseModelPartId =
  | "bodyCore"
  | "head"
  | "torso"
  | "pelvis"
  | "leftShoulder"
  | "leftUpperArm"
  | "leftForearm"
  | "leftHand"
  | "rightShoulder"
  | "rightUpperArm"
  | "rightForearm"
  | "rightHand"
  | "leftThigh"
  | "leftShin"
  | "leftFoot"
  | "rightThigh"
  | "rightShin"
  | "rightFoot";

export type HooBaseModelPartSet = Record<
  HooBaseModelPartId,
  string
>;

const createFacingPartSet = (
  facing: HooWorldPlayerFacing,
): HooBaseModelPartSet => ({
  bodyCore: `/hoo-world/avatar/base/${facing}/bodyCore.png`,
  head: `/hoo-world/avatar/base/${facing}/head.png`,
  torso: `/hoo-world/avatar/base/${facing}/torso.png`,
  pelvis: `/hoo-world/avatar/base/${facing}/pelvis.png`,
  leftShoulder: `/hoo-world/avatar/base/${facing}/leftShoulder.png`,
  leftUpperArm: `/hoo-world/avatar/base/${facing}/leftUpperArm.png`,
  leftForearm: `/hoo-world/avatar/base/${facing}/leftForearm.png`,
  leftHand: `/hoo-world/avatar/base/${facing}/leftHand.png`,
  rightShoulder: `/hoo-world/avatar/base/${facing}/rightShoulder.png`,
  rightUpperArm: `/hoo-world/avatar/base/${facing}/rightUpperArm.png`,
  rightForearm: `/hoo-world/avatar/base/${facing}/rightForearm.png`,
  rightHand: `/hoo-world/avatar/base/${facing}/rightHand.png`,
  leftThigh: `/hoo-world/avatar/base/${facing}/leftThigh.png`,
  leftShin: `/hoo-world/avatar/base/${facing}/leftShin.png`,
  leftFoot: `/hoo-world/avatar/base/${facing}/leftFoot.png`,
  rightThigh: `/hoo-world/avatar/base/${facing}/rightThigh.png`,
  rightShin: `/hoo-world/avatar/base/${facing}/rightShin.png`,
  rightFoot: `/hoo-world/avatar/base/${facing}/rightFoot.png`,
});

export const HOO_BASE_MODEL_PARTS: Record<
  HooWorldPlayerFacing,
  HooBaseModelPartSet
> = {
  down: createFacingPartSet("down"),
  up: createFacingPartSet("up"),
  left: createFacingPartSet("left"),
  right: createFacingPartSet("right"),
};

export function getHooBaseModelPart(
  facing: HooWorldPlayerFacing,
  partId: HooBaseModelPartId,
): string {
  return HOO_BASE_MODEL_PARTS[
    facing
  ][partId];
}
