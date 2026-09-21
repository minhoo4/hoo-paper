"use client";

type HooWorldTornSleepingBagProps = {
  itemName?: string;
  isPlayerNear?: boolean;
  isResting?: boolean;
};

export default function HooWorldTornSleepingBag({
  itemName = "찢어진 침낭",
  isPlayerNear = false,
  isResting = false,
}: HooWorldTornSleepingBagProps) {
  return (
    <div
      data-hoo-world-torn-sleeping-bag="true"
      className="relative h-full w-full"
      aria-label={itemName}
    >
      {/* 이동/충돌 판정용 바닥 기준점 */}
      <div
        data-hoo-world-collision-anchor="true"
        className="invisible pointer-events-none absolute bottom-[5%] left-1/2 h-[12%] w-[78%] -translate-x-1/2"
      />

      {/* 바닥 그림자: 취침 여부와 관계없이 항상 유지 */}
      <div className="pointer-events-none absolute bottom-[2%] left-1/2 h-[20%] w-[80%] -translate-x-1/2 rounded-[50%] bg-[#273127]/20 blur-[5px]" />

      {/*
       * 침낭 본체는 isResting과 무관하게 항상 같은 크기/형태로 렌더한다.
       * 취침 중 포근한 변화는 아래의 추가 쿠션 레이어만으로 표현한다.
       * 이렇게 해야 상태 전환 시 본체가 사라지거나 접히는 문제가 없다.
       */}
      <div className="pointer-events-none absolute bottom-[12%] left-1/2 h-[70%] w-[84%] -translate-x-1/2 rotate-[-4deg] overflow-hidden rounded-[42%_38%_28%_30%/48%_44%_26%_28%] border border-[#4f493b]/65 bg-gradient-to-br from-[#817b5b] via-[#66664d] to-[#464838] shadow-[0_6px_11px_rgba(41,37,30,0.24)]">
        <div className="absolute inset-[5%] rounded-[38%_34%_24%_26%/44%_40%_22%_24%] border border-white/8" />

        {/* 오래 접히고 닳은 주름 */}
        <span className="absolute left-[20%] top-[17%] h-[3%] w-[48%] rotate-[5deg] rounded-full bg-white/10" />
        <span className="absolute left-[13%] top-[43%] h-[3%] w-[61%] -rotate-[4deg] rounded-full bg-[#2e3028]/18" />
        <span className="absolute left-[25%] top-[67%] h-[3%] w-[45%] rotate-[3deg] rounded-full bg-white/7" />

        {/* 입구 쪽 접힌 천 */}
        <div className="absolute left-[5%] top-[5%] h-[33%] w-[28%] -rotate-[6deg] rounded-[55%_34%_48%_42%] border border-[#4c4639]/45 bg-gradient-to-br from-[#91866a] to-[#5f604a] shadow-[2px_2px_4px_rgba(38,35,29,0.18)]" />

        {/* 취침 중 캐릭터가 눌러 만든 가운데 포근한 홈 */}
        {isResting ? (
          <>
            <div className="absolute left-1/2 top-[26%] h-[31%] w-[46%] -translate-x-1/2 rounded-[50%] bg-[#47473c]/24 shadow-[inset_0_4px_8px_rgba(39,36,30,0.24)]" />
            <div className="absolute left-1/2 top-[30%] h-[18%] w-[34%] -translate-x-1/2 rounded-[50%] border border-[#aaa080]/12 bg-[#aaa080]/6" />
          </>
        ) : null}

        {/* 크게 벌어진 오른쪽 찢김 */}
        <div
          className="absolute right-[-8%] top-[24%] h-[38%] w-[34%] rotate-[10deg] bg-[#292d27] shadow-[inset_4px_0_4px_rgba(14,16,13,0.30)]"
          style={{
            clipPath:
              "polygon(0 12%, 20% 0, 34% 24%, 49% 5%, 64% 30%, 80% 10%, 100% 38%, 76% 54%, 92% 78%, 61% 70%, 51% 100%, 35% 72%, 12% 91%, 20% 57%)",
          }}
        />

        {/* 찢어진 안쪽 천 / 솜이 보이는 면 */}
        <div
          className="absolute right-[2%] top-[32%] h-[23%] w-[24%] rotate-[9deg] bg-[#c9bd97]/62"
          style={{
            clipPath:
              "polygon(0 18%, 24% 0, 40% 28%, 58% 8%, 100% 34%, 72% 58%, 88% 100%, 44% 78%, 18% 94%, 25% 56%)",
          }}
        />

        {/* 오른쪽 올풀린 실밥 */}
        <span className="absolute right-[7%] top-[29%] h-[34%] w-[2px] rotate-[21deg] bg-[#d3c69d]/70" />
        <span className="absolute right-[12%] top-[34%] h-[30%] w-[2px] rotate-[8deg] bg-[#c4b68c]/58" />
        <span className="absolute right-[4%] top-[43%] h-[23%] w-[2px] -rotate-[8deg] bg-[#e0d4ae]/52" />

        {/* 아래쪽 크게 터진 부분 */}
        <div
          className="absolute bottom-[-7%] left-[31%] h-[30%] w-[39%] -rotate-[4deg] bg-[#292d27]"
          style={{
            clipPath:
              "polygon(0 72%, 10% 30%, 27% 52%, 38% 4%, 51% 45%, 62% 0, 74% 51%, 91% 25%, 100% 76%, 80% 100%, 58% 79%, 38% 98%, 20% 76%)",
          }}
        />

        {/* 아래쪽 벌어진 안감 */}
        <div
          className="absolute bottom-[0%] left-[37%] h-[19%] w-[29%] -rotate-[2deg] bg-[#b8ae8c]/54"
          style={{
            clipPath:
              "polygon(0 64%, 18% 19%, 36% 50%, 51% 0, 65% 43%, 82% 17%, 100% 68%, 72% 100%, 44% 79%, 22% 94%)",
          }}
        />

        {/* 왼쪽 옆면 작은 파열 */}
        <div
          className="absolute left-[-3%] top-[49%] h-[18%] w-[21%] -rotate-[10deg] bg-[#30342c]"
          style={{
            clipPath:
              "polygon(0 44%, 28% 12%, 42% 38%, 62% 0, 100% 54%, 66% 63%, 78% 100%, 39% 76%, 15% 92%)",
          }}
        />
        <span className="absolute left-[7%] top-[51%] h-[20%] w-[2px] -rotate-[18deg] bg-[#cdbf97]/48" />

        {/* 군데군데 삐져나온 솜 */}
        <span className="absolute bottom-[3%] left-[39%] h-[13%] w-[20%] rotate-[8deg] rounded-[50%] bg-[#d9cfaf]/82 blur-[0.3px]" />
        <span className="absolute bottom-[7%] left-[50%] h-[10%] w-[17%] -rotate-[12deg] rounded-[50%] bg-[#eee3c6]/72" />
        <span className="absolute right-[4%] top-[42%] h-[9%] w-[12%] rotate-[18deg] rounded-[50%] bg-[#e8ddbc]/68" />
        <span className="absolute right-[10%] top-[48%] h-[7%] w-[10%] -rotate-[4deg] rounded-[50%] bg-[#cfc39f]/62" />
      </div>

      {/*
       * 캐릭터가 올라오면 침낭 좌우 가장자리만 살짝 솟아
       * 닭이 알을 품듯 몸을 감싸는 모양을 만든다.
       * 본체와 분리된 레이어라 침낭 자체는 절대 사라지지 않는다.
       */}
      {isResting ? (
        <>
          <div className="pointer-events-none absolute bottom-[30%] left-[18%] z-[2] h-[25%] w-[22%] -rotate-[8deg] rounded-[55%_45%_50%_50%] bg-gradient-to-br from-[#8d8465]/90 via-[#746e56]/92 to-[#5a5949]/88 shadow-[1px_2px_4px_rgba(37,34,28,0.12)]" />
          <div className="pointer-events-none absolute bottom-[30%] right-[18%] z-[2] h-[25%] w-[22%] rotate-[8deg] rounded-[45%_55%_50%_50%] bg-gradient-to-bl from-[#8d8465]/90 via-[#746e56]/92 to-[#5a5949]/88 shadow-[-1px_2px_4px_rgba(37,34,28,0.12)]" />
          <div className="pointer-events-none absolute bottom-[14%] left-1/2 z-[2] h-[15%] w-[48%] -translate-x-1/2 rounded-[50%] bg-[#575547]/26 blur-[1px]" />
        </>
      ) : null}

      {(isPlayerNear || isResting) ? (
        <div className="pointer-events-none absolute bottom-[90%] left-1/2 z-[3] -translate-x-1/2 whitespace-nowrap rounded-full border border-[#eadbb4]/55 bg-[#1e211b]/92 px-3 py-1 text-[9px] font-black text-[#fff1c9] shadow-[0_4px_12px_rgba(0,0,0,0.28)] backdrop-blur-sm">
          {isResting
            ? "F 침낭 나오기"
            : "F 침낭 들어가기"}
        </div>
      ) : null}

      <div className="pointer-events-none absolute left-1/2 top-full mt-[-2px] max-w-[150%] -translate-x-1/2 whitespace-nowrap rounded-full border border-white/35 bg-[#343d31]/76 px-2 py-0.5 text-[7px] font-black text-white/90 shadow-sm backdrop-blur-[2px]">
        {itemName}
      </div>
    </div>
  );
}
