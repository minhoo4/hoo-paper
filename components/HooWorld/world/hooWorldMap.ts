export type HooWorldRegionId =
  | "creek"
  | "camping"
  | "grassland"
  | "jungle"
  | "cave"
  | "season2"
  | "foothills"
  | "abandoned_train_village"
  | "observatory"
  | "beach"
  | "deserted_island"
  | "deserted_island_jungle"
  | "cave_b1"
  | "cave_b2"
  | "cave_bottom"
  | "hidden_room";

export type HooWorldRegionDirection =
  | "north"
  | "east"
  | "south"
  | "west";

export type HooWorldRegionTravelRequirement =
  | "none"
  | "boat"
  | "season2"
  | "special_unlock";

export type HooWorldRegionConnection = {
  regionId: HooWorldRegionId;
  requirement?: HooWorldRegionTravelRequirement;
};

export type HooWorldRegionDefinition = {
  id: HooWorldRegionId;
  name: string;
  shortName: string;
  mapX: number;
  mapY: number;
  defaultUnlocked: boolean;
  connections: Partial<
    Record<
      HooWorldRegionDirection,
      HooWorldRegionConnection
    >
  >;
};

export const HOO_WORLD_DEFAULT_REGION_ID:
  HooWorldRegionId = "camping";

/*
 * 실제 월드의 지역 배치도.
 *
 * 주의:
 * 기존 Presence의 fieldId는 25명 단위 인원 분산용 필드(샤드)다.
 * 실제 맵 지역은 fieldId와 섞지 않고 별도 worldRegionId로 관리한다.
 *
 * mapX/mapY는 미니맵용 월드 좌표다.
 * 지역 내부 캐릭터 좌표 x/y(0~100)와 결합하면
 * 앞으로 지역 이동 시에도 미니맵 아이콘이 자연스럽게 이어진다.
 */
export const HOO_WORLD_REGION_MAP: Record<
  HooWorldRegionId,
  HooWorldRegionDefinition
> = {
  creek: {
    id: "creek",
    name: "냇가",
    shortName: "냇가",
    mapX: -2,
    mapY: 0,
    defaultUnlocked: false,
    connections: {
      east: {
        regionId: "camping",
      },
      south: {
        regionId: "beach",
      },
    },
  },

  camping: {
    id: "camping",
    name: "캠핑필드",
    shortName: "캠핑",
    mapX: -1,
    mapY: 0,
    defaultUnlocked: true,
    connections: {
      west: {
        regionId: "creek",
      },
      east: {
        regionId: "grassland",
      },
      north: {
        regionId: "foothills",
      },
    },
  },

  grassland: {
    id: "grassland",
    name: "초원필드",
    shortName: "초원",
    mapX: 0,
    mapY: 0,
    defaultUnlocked: false,
    connections: {
      west: {
        regionId: "camping",
      },
      east: {
        regionId: "jungle",
      },
      north: {
        regionId: "abandoned_train_village",
      },
    },
  },

  jungle: {
    id: "jungle",
    name: "정글",
    shortName: "정글",
    mapX: 1,
    mapY: 0,
    defaultUnlocked: false,
    connections: {
      west: {
        regionId: "grassland",
      },
      east: {
        regionId: "cave",
      },
    },
  },

  cave: {
    id: "cave",
    name: "동굴(던전)",
    shortName: "동굴",
    mapX: 2,
    mapY: 0,
    defaultUnlocked: false,
    connections: {
      west: {
        regionId: "jungle",
      },
      east: {
        regionId: "season2",
        requirement: "season2",
      },
      south: {
        regionId: "cave_b1",
      },
    },
  },

  season2: {
    id: "season2",
    name: "동굴 넘어 세상",
    shortName: "SEASON 2",
    mapX: 3,
    mapY: 0,
    defaultUnlocked: false,
    connections: {
      west: {
        regionId: "cave",
        requirement: "season2",
      },
    },
  },

  foothills: {
    id: "foothills",
    name: "산기슭",
    shortName: "산기슭",
    mapX: -1,
    mapY: -1,
    defaultUnlocked: false,
    connections: {
      north: {
        regionId: "observatory",
      },
      east: {
        regionId: "abandoned_train_village",
      },
      south: {
        regionId: "camping",
      },
    },
  },

  abandoned_train_village: {
    id: "abandoned_train_village",
    name: "버려진 기차마을",
    shortName: "기차마을",
    mapX: 0,
    mapY: -1,
    defaultUnlocked: false,
    connections: {
      west: {
        regionId: "foothills",
      },
      south: {
        regionId: "grassland",
      },
    },
  },

  observatory: {
    id: "observatory",
    name: "천문대",
    shortName: "천문대",
    mapX: -1,
    mapY: -2,
    defaultUnlocked: false,
    connections: {
      south: {
        regionId: "foothills",
      },
    },
  },

  beach: {
    id: "beach",
    name: "바닷가",
    shortName: "바닷가",
    mapX: -2,
    mapY: 1,
    defaultUnlocked: false,
    connections: {
      north: {
        regionId: "creek",
      },
      south: {
        regionId: "deserted_island",
        requirement: "boat",
      },
    },
  },

  deserted_island: {
    id: "deserted_island",
    name: "무인도",
    shortName: "무인도",
    mapX: -2,
    mapY: 2,
    defaultUnlocked: false,
    connections: {
      north: {
        regionId: "beach",
        requirement: "boat",
      },
      south: {
        regionId: "deserted_island_jungle",
      },
    },
  },

  deserted_island_jungle: {
    id: "deserted_island_jungle",
    name: "무인도 정글",
    shortName: "섬 정글",
    mapX: -2,
    mapY: 3,
    defaultUnlocked: false,
    connections: {
      north: {
        regionId: "deserted_island",
      },
    },
  },

  cave_b1: {
    id: "cave_b1",
    name: "동굴 지하 1층",
    shortName: "B1",
    mapX: 2,
    mapY: 1,
    defaultUnlocked: false,
    connections: {
      north: {
        regionId: "cave",
      },
      south: {
        regionId: "cave_b2",
      },
    },
  },

  cave_b2: {
    id: "cave_b2",
    name: "동굴 지하 2층",
    shortName: "B2",
    mapX: 2,
    mapY: 2,
    defaultUnlocked: false,
    connections: {
      north: {
        regionId: "cave_b1",
      },
      south: {
        regionId: "cave_bottom",
      },
    },
  },

  cave_bottom: {
    id: "cave_bottom",
    name: "동굴 최하층 (보스 + 보물)",
    shortName: "최하층",
    mapX: 2,
    mapY: 3,
    defaultUnlocked: false,
    connections: {
      north: {
        regionId: "cave_b2",
      },
      south: {
        regionId: "hidden_room",
        requirement: "special_unlock",
      },
    },
  },

  hidden_room: {
    id: "hidden_room",
    name: "숨겨진 방 (보물지도)",
    shortName: "숨겨진 방",
    mapX: 2,
    mapY: 4,
    defaultUnlocked: false,
    connections: {
      north: {
        regionId: "cave_bottom",
        requirement: "special_unlock",
      },
    },
  },
};


export function isHooWorldRegionId(
  value: unknown,
): value is HooWorldRegionId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(
      HOO_WORLD_REGION_MAP,
      value,
    )
  );
}

export const HOO_WORLD_REGION_LIST =
  Object.values(
    HOO_WORLD_REGION_MAP,
  );

export const HOO_WORLD_DEFAULT_UNLOCKED_REGION_IDS =
  HOO_WORLD_REGION_LIST
    .filter(
      (region) =>
        region.defaultUnlocked,
    )
    .map(
      (region) =>
        region.id,
    );

export function getHooWorldRegion(
  regionId: HooWorldRegionId,
) {
  return HOO_WORLD_REGION_MAP[
    regionId
  ];
}

export function getConnectedHooWorldRegion(
  regionId: HooWorldRegionId,
  direction: HooWorldRegionDirection,
) {
  return HOO_WORLD_REGION_MAP[
    regionId
  ].connections[
    direction
  ] ?? null;
}
