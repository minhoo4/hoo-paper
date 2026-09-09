"use client";

import {
  HOO_WORLD_FOOD_ACTION_DURATION_MS,
  type HooWorldFoodDefinition,
} from "./hooWorldFoodCatalog";

type HooWorldFoodInteractionEffectProps = {
  food: HooWorldFoodDefinition;
  startedAt: number;
};

export default function HooWorldFoodInteractionEffect({
  food,
  startedAt,
}: HooWorldFoodInteractionEffectProps) {
  const elapsed =
    Math.max(
      0,
      Date.now() -
        startedAt,
    );

  if (
    elapsed >=
    HOO_WORLD_FOOD_ACTION_DURATION_MS
  ) {
    return null;
  }

  const animationDelay =
    `-${elapsed}ms`;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-[62px] z-[12] h-[150px] w-[230px] -translate-x-1/2"
      data-hoo-world-food-effect="true"
    >
      <style jsx>{`
        @keyframes hoo-food-hand-reach {
          0% {
            opacity: 0;
            transform:
              translate3d(-14px, 20px, 0)
              rotate(34deg)
              scaleX(0.4);
          }

          8% {
            opacity: 1;
          }

          17% {
            opacity: 1;
            transform:
              translate3d(20px, 2px, 0)
              rotate(18deg)
              scaleX(1);
          }

          28%,
          100% {
            opacity: 0;
            transform:
              translate3d(28px, -6px, 0)
              rotate(4deg)
              scaleX(0.72);
          }
        }

        @keyframes hoo-food-full-container {
          0%,
          9% {
            opacity: 0;
            transform:
              translate3d(54px, 96px, 0)
              rotate(0deg)
              scale(0.82);
          }

          14% {
            opacity: 1;
          }

          34% {
            opacity: 1;
            transform:
              translate3d(4px, 2px, 0)
              rotate(-4deg)
              scale(1);
          }

          48% {
            opacity: 1;
            transform:
              translate3d(0, -4px, 0)
              rotate(-112deg)
              scale(1);
          }

          66% {
            opacity: 0;
            transform:
              translate3d(-4px, 2px, 0)
              rotate(-138deg)
              scale(0.9);
          }

          100% {
            opacity: 0;
          }
        }

        @keyframes hoo-food-fall-a {
          0%,
          36% {
            opacity: 0;
            transform:
              translate3d(0, 0, 0)
              scale(0.4);
          }

          42% {
            opacity: 1;
          }

          66% {
            opacity: 0.95;
            transform:
              translate3d(-10px, 62px, 0)
              scale(1);
          }

          72%,
          100% {
            opacity: 0;
            transform:
              translate3d(-15px, 76px, 0)
              scale(0.7);
          }
        }

        @keyframes hoo-food-fall-b {
          0%,
          39% {
            opacity: 0;
            transform:
              translate3d(0, 0, 0)
              scale(0.4);
          }

          45% {
            opacity: 1;
          }

          68% {
            opacity: 0.9;
            transform:
              translate3d(11px, 65px, 0)
              scale(0.9);
          }

          74%,
          100% {
            opacity: 0;
            transform:
              translate3d(16px, 80px, 0)
              scale(0.65);
          }
        }

        @keyframes hoo-food-empty-toss {
          0%,
          62% {
            opacity: 0;
            transform:
              translate3d(0, 22px, 0)
              rotate(-118deg)
              scale(0.8);
          }

          64% {
            opacity: 1;
          }

          76% {
            opacity: 1;
            transform:
              translate3d(78px, 24px, 0)
              rotate(130deg)
              scale(0.92);
          }

          84% {
            opacity: 1;
            transform:
              translate3d(116px, 78px, 0)
              rotate(260deg)
              scale(0.9);
          }

          89% {
            opacity: 1;
            transform:
              translate3d(132px, 60px, 0)
              rotate(330deg)
              scale(0.86);
          }

          94% {
            opacity: 1;
            transform:
              translate3d(144px, 80px, 0)
              rotate(410deg)
              scale(0.82);
          }

          100% {
            opacity: 0;
            transform:
              translate3d(148px, 80px, 0)
              rotate(430deg)
              scale(0.15);
          }
        }

        @keyframes hoo-food-pop {
          0%,
          92% {
            opacity: 0;
            transform:
              translate3d(143px, 78px, 0)
              scale(0.2);
          }

          96% {
            opacity: 1;
            transform:
              translate3d(143px, 78px, 0)
              scale(1.4);
          }

          100% {
            opacity: 0;
            transform:
              translate3d(143px, 78px, 0)
              scale(2);
          }
        }
      `}</style>

      <div
        className="absolute left-[84px] top-[70px] h-[20px] w-[58px] origin-left rounded-full bg-[#f0c4a4] shadow-[inset_0_-2px_0_rgba(113,72,53,0.10)]"
        style={{
          animation:
            `hoo-food-hand-reach ${HOO_WORLD_FOOD_ACTION_DURATION_MS}ms linear both`,
          animationDelay,
        }}
      />

      <div
        className="absolute left-[92px] top-[4px] flex h-[68px] w-[68px] items-center justify-center"
        style={{
          animation:
            `hoo-food-full-container ${HOO_WORLD_FOOD_ACTION_DURATION_MS}ms linear both`,
          animationDelay,
        }}
      >
        {food.imagePath
          ? (
              <img
                src={
                  food.imagePath
                }
                alt=""
                draggable={false}
                className="max-h-full max-w-full select-none object-contain drop-shadow-[0_4px_4px_rgba(0,0,0,0.2)]"
              />
            )
          : (
              <span className="text-[48px] leading-none">
                {
                  food.fallbackEmoji
                }
              </span>
            )}
      </div>

      {[
        {
          left: 110,
          top: 49,
          animation:
            "hoo-food-fall-a",
          symbol: "●",
        },
        {
          left: 124,
          top: 45,
          animation:
            "hoo-food-fall-b",
          symbol: "•",
        },
        {
          left: 100,
          top: 42,
          animation:
            "hoo-food-fall-b",
          symbol: "●",
        },
      ].map(
        (
          particle,
          index,
        ) => (
          <span
            key={
              index
            }
            className="absolute text-[10px] font-black text-[#d99155] drop-shadow-sm"
            style={{
              left:
                particle.left,
              top:
                particle.top,
              animation:
                `${particle.animation} ${HOO_WORLD_FOOD_ACTION_DURATION_MS}ms linear both`,
              animationDelay,
            }}
          >
            {
              particle.symbol
            }
          </span>
        ),
      )}

      <div
        className="absolute left-[92px] top-[8px] flex h-[56px] w-[56px] items-center justify-center"
        style={{
          animation:
            `hoo-food-empty-toss ${HOO_WORLD_FOOD_ACTION_DURATION_MS}ms linear both`,
          animationDelay,
        }}
      >
        {food.emptyContainerImagePath
          ? (
              <img
                src={
                  food.emptyContainerImagePath
                }
                alt=""
                draggable={false}
                className="max-h-full max-w-full select-none object-contain drop-shadow-[0_4px_4px_rgba(0,0,0,0.18)]"
              />
            )
          : (
              <span className="text-[40px] leading-none">
                {
                  food.emptyContainerFallbackEmoji
                }
              </span>
            )}
      </div>

      <span
        className="absolute left-[92px] top-[8px] text-[24px]"
        style={{
          animation:
            `hoo-food-pop ${HOO_WORLD_FOOD_ACTION_DURATION_MS}ms linear both`,
          animationDelay,
        }}
      >
        ✦
      </span>
    </div>
  );
}
