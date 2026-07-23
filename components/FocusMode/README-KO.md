# HOO 캘린더 최종 기능 묶음

이번 버전에는 아래 기능이 포함됩니다.

- 날짜 클릭 시 하루 집중 타임라인
- 이번 달 총 집중시간
- 최대 연속 집중일
- 평균 세션 집중시간
- 최대 세션 집중시간
- 이번 주와 지난 주 집중시간 비교
- 자동 AI Insight 문장
- 캘린더 날짜 칸에는 날짜와 누적 분만 표시
- 오버뷰 주간 히트맵 유지
- 기존 타이머, 메모, 프로필 사진 기능 유지

## 적용

기존 `components/FocusMode` 폴더를 백업한 뒤,
이 폴더의 내용 전체로 교체하세요.

```text
components/FocusMode
```

`page.tsx` import는 그대로 유지합니다.

```tsx
import FocusMode from "@/components/FocusMode/FocusMode";
```

적용 후:

```bash
npm run build
```

빌드 성공 후:

```bash
npm run dev
```
