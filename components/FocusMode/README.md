# 정확한 집중시간 집계 수정

교체 파일:

```text
components/FocusMode/FocusMode.tsx
components/FocusMode/utils/format.ts
components/FocusMode/Profile/ProfileCalendar.tsx
```

변경 사항:

- 60초 미만 기록을 더 이상 1분으로 올림 표시하지 않음
- `23초`, `1분 18초`, `1시간 5분 7초` 형식으로 정확히 표시
- 캘린더 날짜 칸도 60초 미만이면 초 단위 표시
- 타임라인 시작·종료 시각을 초 단위까지 표시
- 자연 완료 시 계획시간 전체를 정확히 저장
- 사용자가 중간에 `집중 종료`를 눌러도 실제 집중한 시간만 저장
- 0초 세션은 저장하지 않음

적용 후:

```powershell
npm.cmd run build
```
