export type HooSimpleAvatarJointId =
  | "body"
  | "head"
  | "leftArm"
  | "rightArm"
  | "leftLeg"
  | "rightLeg";

export type HooSimpleAvatarMotionSource =
  | "torso"
  | "head"
  | "leftUpperArm"
  | "rightUpperArm"
  | "leftThigh"
  | "rightThigh";

export type HooSimpleAvatarJoint = {
  id: HooSimpleAvatarJointId;

  parentId:
    | HooSimpleAvatarJointId
    | null;

  pivot: {
    x: number;
    y: number;
  };

  zIndex: number;

  motionSource:
    HooSimpleAvatarMotionSource;
};

export type HooSimpleAvatarRig = Record<
  HooSimpleAvatarJointId,
  HooSimpleAvatarJoint
>;

export const HOO_SIMPLE_AVATAR_JOINT_ORDER: HooSimpleAvatarJointId[] = [
  "body",
  "head",
  "leftArm",
  "rightArm",
  "leftLeg",
  "rightLeg",
];

export const HOO_SIMPLE_AVATAR_CHILDREN: Record<
  HooSimpleAvatarJointId,
  HooSimpleAvatarJointId[]
> = {
  body: [
    "head",
    "leftArm",
    "rightArm",
    "leftLeg",
    "rightLeg",
  ],

  head: [],
  leftArm: [],
  rightArm: [],
  leftLeg: [],
  rightLeg: [],
};

export function createHooSimpleAvatarRig(): HooSimpleAvatarRig {
  return {
    body: {
      id: "body",
      parentId: null,

      pivot: {
        x: 69.5,
        y: 126,
      },

      zIndex: 30,

      motionSource:
        "torso",
    },

    head: {
      id: "head",
      parentId: "body",

      pivot: {
        x: 69.5,
        y: 63,
      },

      zIndex: 60,

      motionSource:
        "head",
    },

    leftArm: {
      id: "leftArm",
      parentId: "body",

      pivot: {
        x: 39,
        y: 103,
      },

      zIndex: 42,

      motionSource:
        "leftUpperArm",
    },

    rightArm: {
      id: "rightArm",
      parentId: "body",

      pivot: {
        x: 100,
        y: 103,
      },

      zIndex: 42,

      motionSource:
        "rightUpperArm",
    },

    leftLeg: {
      id: "leftLeg",
      parentId: "body",

      pivot: {
        x: 56,
        y: 157,
      },

      zIndex: 24,

      motionSource:
        "leftThigh",
    },

    rightLeg: {
      id: "rightLeg",
      parentId: "body",

      pivot: {
        x: 83,
        y: 157,
      },

      zIndex: 24,

      motionSource:
        "rightThigh",
    },
  };
}
