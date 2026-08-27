export type HooWorldPlayerFacing =
  | "up"
  | "down"
  | "left"
  | "right";

export type HooWorldCharacterSprites = Record<
  HooWorldPlayerFacing,
  string
>;

export type HooWorldCharacterDefinition = {
  id: string;
  name: string;
  sprites: HooWorldCharacterSprites;
};
