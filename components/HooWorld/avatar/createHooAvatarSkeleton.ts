export type HooAvatarSide =
  | "left"
  | "right";

export type HooAvatarJointId =
  | "pelvis"
  | "torso"
  | "head"
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

export type HooAvatarJointTransform = {
  x: number;
  y: number;

  rotation: number;

  scaleX: number;
  scaleY: number;
};

export type HooAvatarJointDefinition = {
  id: HooAvatarJointId;

  parentId:
    | HooAvatarJointId
    | null;

  pivotX: number;
  pivotY: number;

  zIndex: number;

  transform: HooAvatarJointTransform;
};

export type HooAvatarSkeleton = Record<
  HooAvatarJointId,
  HooAvatarJointDefinition
>;

export const HOO_AVATAR_CANVAS_WIDTH =
  139;

export const HOO_AVATAR_CANVAS_HEIGHT =
  228;

function createJoint(
  id: HooAvatarJointId,
  parentId:
    | HooAvatarJointId
    | null,
  pivotX: number,
  pivotY: number,
  zIndex: number,
): HooAvatarJointDefinition {
  return {
    id,
    parentId,

    pivotX,
    pivotY,

    zIndex,

    transform: {
      x: 0,
      y: 0,

      rotation: 0,

      scaleX: 1,
      scaleY: 1,
    },
  };
}

export function createHooAvatarSkeleton(): HooAvatarSkeleton {
  return {
    /*
     * 중앙 축
     *
     * pelvis
     *   └─ torso
     *       └─ head
     */
    pelvis: createJoint(
      "pelvis",
      null,
      69.5,
      143,
      30,
    ),

    torso: createJoint(
      "torso",
      "pelvis",
      69.5,
      103,
      40,
    ),

    head: createJoint(
      "head",
      "torso",
      69.5,
      58,
      80,
    ),

    /*
     * 왼팔
     *
     * torso
     *   └─ leftShoulder
     *       └─ leftUpperArm
     *           └─ leftForearm
     *               └─ leftHand
     */
    leftShoulder: createJoint(
      "leftShoulder",
      "torso",
      46,
      91,
      43,
    ),

    leftUpperArm: createJoint(
      "leftUpperArm",
      "leftShoulder",
      39,
      108,
      44,
    ),

    leftForearm: createJoint(
      "leftForearm",
      "leftUpperArm",
      34,
      126,
      45,
    ),

    leftHand: createJoint(
      "leftHand",
      "leftForearm",
      31,
      143,
      46,
    ),

    /*
     * 오른팔
     *
     * torso
     *   └─ rightShoulder
     *       └─ rightUpperArm
     *           └─ rightForearm
     *               └─ rightHand
     */
    rightShoulder: createJoint(
      "rightShoulder",
      "torso",
      93,
      91,
      43,
    ),

    rightUpperArm: createJoint(
      "rightUpperArm",
      "rightShoulder",
      100,
      108,
      44,
    ),

    rightForearm: createJoint(
      "rightForearm",
      "rightUpperArm",
      105,
      126,
      45,
    ),

    rightHand: createJoint(
      "rightHand",
      "rightForearm",
      108,
      143,
      46,
    ),

    /*
     * 왼다리
     *
     * pelvis
     *   └─ leftThigh
     *       └─ leftShin
     *           └─ leftFoot
     */
    leftThigh: createJoint(
      "leftThigh",
      "pelvis",
      57,
      150,
      31,
    ),

    leftShin: createJoint(
      "leftShin",
      "leftThigh",
      55,
      181,
      32,
    ),

    leftFoot: createJoint(
      "leftFoot",
      "leftShin",
      54,
      210,
      33,
    ),

    /*
     * 오른다리
     *
     * pelvis
     *   └─ rightThigh
     *       └─ rightShin
     *           └─ rightFoot
     */
    rightThigh: createJoint(
      "rightThigh",
      "pelvis",
      82,
      150,
      31,
    ),

    rightShin: createJoint(
      "rightShin",
      "rightThigh",
      84,
      181,
      32,
    ),

    rightFoot: createJoint(
      "rightFoot",
      "rightShin",
      85,
      210,
      33,
    ),
  };
}

export function cloneHooAvatarSkeleton(
  skeleton: HooAvatarSkeleton,
): HooAvatarSkeleton {
  return Object.fromEntries(
    Object.entries(
      skeleton,
    ).map(
      ([
        jointId,
        joint,
      ]) => [
        jointId,
        {
          ...joint,
          transform: {
            ...joint.transform,
          },
        },
      ],
    ),
  ) as HooAvatarSkeleton;
}

export function setHooAvatarJointTransform(
  skeleton: HooAvatarSkeleton,
  jointId: HooAvatarJointId,
  transform: Partial<HooAvatarJointTransform>,
): HooAvatarSkeleton {
  const nextSkeleton =
    cloneHooAvatarSkeleton(
      skeleton,
    );

  nextSkeleton[
    jointId
  ] = {
    ...nextSkeleton[
      jointId
    ],

    transform: {
      ...nextSkeleton[
        jointId
      ].transform,
      ...transform,
    },
  };

  return nextSkeleton;
}

export function rotateHooAvatarJoint(
  skeleton: HooAvatarSkeleton,
  jointId: HooAvatarJointId,
  rotation: number,
): HooAvatarSkeleton {
  return setHooAvatarJointTransform(
    skeleton,
    jointId,
    {
      rotation,
    },
  );
}

export function moveHooAvatarJoint(
  skeleton: HooAvatarSkeleton,
  jointId: HooAvatarJointId,
  x: number,
  y: number,
): HooAvatarSkeleton {
  return setHooAvatarJointTransform(
    skeleton,
    jointId,
    {
      x,
      y,
    },
  );
}

export function resetHooAvatarSkeleton(): HooAvatarSkeleton {
  return createHooAvatarSkeleton();
}

export function getHooAvatarJointChildren(
  skeleton: HooAvatarSkeleton,
  parentId: HooAvatarJointId,
): HooAvatarJointDefinition[] {
  return Object.values(
    skeleton,
  ).filter(
    (joint) =>
      joint.parentId ===
      parentId,
  );
}
