import {
  minhooCharacter,
} from "./minhoo";

import type {
  HooWorldCharacterDefinition,
} from "./types";

export const HOO_WORLD_CHARACTER_REGISTRY = {
  minhoo: minhooCharacter,
} as const;

export type HooWorldCharacterId =
  keyof typeof HOO_WORLD_CHARACTER_REGISTRY;

export function getHooWorldCharacter(
  characterId: HooWorldCharacterId,
): HooWorldCharacterDefinition {
  return HOO_WORLD_CHARACTER_REGISTRY[
    characterId
  ];
}