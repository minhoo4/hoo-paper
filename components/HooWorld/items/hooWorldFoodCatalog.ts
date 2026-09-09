export type HooWorldFoodId =
  keyof typeof HOO_WORLD_FOOD_CATALOG;

export type HooWorldFoodDefinition = {
  id: string;
  name: string;

  /*
   * 실제 PNG/SVG가 준비되면 경로만 넣는다.
   * null이면 fallbackEmoji를 사용한다.
   *
   * 음식이 추가되어도 상호작용 엔진은 수정하지 않는다.
   */
  imagePath: string | null;
  fallbackEmoji: string;

  /*
   * 음식을 다 먹은 뒤 던질 빈 그릇.
   * 음식마다 별도 그릇 이미지가 있으면 등록하고,
   * 없으면 공통 이모지 fallback을 사용한다.
   */
  emptyContainerImagePath: string | null;
  emptyContainerFallbackEmoji: string;
};

export const HOO_WORLD_FOOD_CATALOG = {
  camp_stew: {
    id: "camp_stew",
    name: "캠프 스튜",
    imagePath: null,
    fallbackEmoji: "🍲",
    emptyContainerImagePath: null,
    emptyContainerFallbackEmoji: "🥣",
  },
} as const satisfies Record<
  string,
  HooWorldFoodDefinition
>;

export type HooWorldFoodFieldItem = {
  itemId: string;
  foodId: HooWorldFoodId;
  x: number;
  y: number;
};

/*
 * 후월드 정적 음식 배치는 사용하지 않는다.
 *
 * 음식은 반드시 HOO DELIVERY 상자로 실시간 배송되고,
 * 이용자가 상자에서 꺼낸 뒤 필드에 생성된다.
 *
 * 앞으로 새 음식 추가 시 위 HOO_WORLD_FOOD_CATALOG에
 * 음식 데이터만 추가하면 관리자 음식 배송 목록에도 자동 반영된다.
 *
 * 먹기 / 던지기 / 춤 / Presence / 배송 상호작용 로직은 수정하지 않는다.
 */
export const HOO_WORLD_FIELD_FOOD_ITEMS:
  readonly HooWorldFoodFieldItem[] =
  [] as const;

/*
 * 공통 음식 연출 시간.
 *
 * 0.00s ~ 0.60s : 손 뻗기
 * 0.60s ~ 1.35s : 음식 머리 위로 들기
 * 1.35s ~ 2.45s : 머리 위로 붓기
 * 2.45s ~ 3.60s : 빈 그릇 던지기 + 바닥 튕김 + 뿅
 * 이후 90초 동안 춤
 */
export const HOO_WORLD_FOOD_REACH_DURATION_MS =
  600;

export const HOO_WORLD_FOOD_ACTION_DURATION_MS =
  3600;

export const HOO_WORLD_FOOD_DANCE_DURATION_MS =
  90000;

export const HOO_WORLD_FOOD_INTERACTION_DISTANCE_PX =
  118;

export function getHooWorldFoodDefinition(
  foodId: string,
): HooWorldFoodDefinition | null {
  return (
    HOO_WORLD_FOOD_CATALOG[
      foodId as HooWorldFoodId
    ] ?? null
  );
}
