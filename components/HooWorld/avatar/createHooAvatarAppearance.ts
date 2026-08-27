export type HooAvatarFacing =
  | "up"
  | "down"
  | "left"
  | "right";

export type HooAvatarLayerSlot =
  | "body"
  | "face"
  | "hairBack"
  | "innerTop"
  | "innerBottom"
  | "shoes"
  | "top"
  | "bottom"
  | "hairFront"
  | "hat"
  | "accessory"
  | "effect";

export type HooAvatarAppearance = {
  modelId: string;

  bodyId: string;
  faceId: string;

  hairBackId: string | null;
  hairFrontId: string | null;

  innerTopId: string;
  innerBottomId: string;

  shoesId: string | null;

  topId: string | null;
  bottomId: string | null;

  hatId: string | null;
  accessoryId: string | null;
  effectId: string | null;
};

export const HOO_AVATAR_LAYER_ORDER: HooAvatarLayerSlot[] = [
  "hairBack",
  "body",
  "face",
  "innerBottom",
  "innerTop",
  "shoes",
  "bottom",
  "top",
  "hairFront",
  "hat",
  "accessory",
  "effect",
];

export const HOO_BASE_AVATAR_APPEARANCE: HooAvatarAppearance = {
  modelId: "hoo_base_01",

  bodyId: "body_base_01",
  faceId: "face_base_01",

  hairBackId: "hair_bob_01_back",
  hairFrontId: "hair_bob_01_front",

  innerTopId: "pajama_basic_01_top",
  innerBottomId: "pajama_basic_01_bottom",

  shoesId: null,

  topId: null,
  bottomId: null,

  hatId: null,
  accessoryId: null,
  effectId: null,
};

export type HooAvatarAppearanceOverrides =
  Partial<
    Omit<
      HooAvatarAppearance,
      "modelId"
    >
  >;

export function createHooAvatarAppearance(
  overrides: HooAvatarAppearanceOverrides = {},
): HooAvatarAppearance {
  return {
    ...HOO_BASE_AVATAR_APPEARANCE,
    ...overrides,
  };
}

export function resetHooAvatarAppearance(): HooAvatarAppearance {
  return createHooAvatarAppearance();
}

export function equipHooAvatarItem(
  appearance: HooAvatarAppearance,
  slot: HooAvatarLayerSlot,
  itemId: string | null,
): HooAvatarAppearance {
  switch (slot) {
    case "body":
      return {
        ...appearance,
        bodyId:
          itemId ??
          HOO_BASE_AVATAR_APPEARANCE.bodyId,
      };

    case "face":
      return {
        ...appearance,
        faceId:
          itemId ??
          HOO_BASE_AVATAR_APPEARANCE.faceId,
      };

    case "hairBack":
      return {
        ...appearance,
        hairBackId: itemId,
      };

    case "hairFront":
      return {
        ...appearance,
        hairFrontId: itemId,
      };

    case "innerTop":
      return {
        ...appearance,
        innerTopId:
          itemId ??
          HOO_BASE_AVATAR_APPEARANCE.innerTopId,
      };

    case "innerBottom":
      return {
        ...appearance,
        innerBottomId:
          itemId ??
          HOO_BASE_AVATAR_APPEARANCE.innerBottomId,
      };

    case "shoes":
      return {
        ...appearance,
        shoesId: itemId,
      };

    case "top":
      return {
        ...appearance,
        topId: itemId,
      };

    case "bottom":
      return {
        ...appearance,
        bottomId: itemId,
      };

    case "hat":
      return {
        ...appearance,
        hatId: itemId,
      };

    case "accessory":
      return {
        ...appearance,
        accessoryId: itemId,
      };

    case "effect":
      return {
        ...appearance,
        effectId: itemId,
      };
  }
}

export function getHooAvatarEquippedLayerIds(
  appearance: HooAvatarAppearance,
): Record<
  HooAvatarLayerSlot,
  string | null
> {
  return {
    body:
      appearance.bodyId,

    face:
      appearance.faceId,

    hairBack:
      appearance.hairBackId,

    innerTop:
      appearance.innerTopId,

    innerBottom:
      appearance.innerBottomId,

    shoes:
      appearance.shoesId,

    top:
      appearance.topId,

    bottom:
      appearance.bottomId,

    hairFront:
      appearance.hairFrontId,

    hat:
      appearance.hatId,

    accessory:
      appearance.accessoryId,

    effect:
      appearance.effectId,
  };
}

export function getHooAvatarFacingAssetKey(
  itemId: string,
  facing: HooAvatarFacing,
): string {
  return `${itemId}:${facing}`;
}
