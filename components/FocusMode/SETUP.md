# HOO 실시간 함께 집중 중 기능 설치

## 1. 패키지 설치

프로젝트 루트 터미널에서 실행:

```bash
npm install @supabase/supabase-js
```

## 2. Supabase 프로젝트 생성

Supabase Dashboard에서 프로젝트를 만들고,
Project Connect 화면에서 아래 두 값을 복사합니다.

- Project URL
- Publishable key

## 3. `.env.local` 설정

프로젝트 루트의 `.env.local` 파일에 추가:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

환경변수 변경 뒤 개발 서버를 반드시 다시 시작하세요.

## 4. 파일 적용

이 압축파일 안의 `HOO-focus-presence-files` 폴더 내용을
프로젝트의 `components/FocusMode`에 같은 경로로 덮어씁니다.

추가 파일:

```text
components/FocusMode/
├─ lib/
│  └─ supabaseClient.ts
├─ hooks/
│  └─ useFocusPresence.ts
└─ Timer/
   └─ FocusPresenceBadge.tsx
```

교체 파일:

```text
components/FocusMode/
├─ FocusMode.tsx
└─ Timer/
   ├─ FocusTimerModal.tsx
   └─ FocusSession.tsx
```

## 5. 집계 기준

- 포커스 타이머를 실제로 시작한 브라우저만 포함
- 설정 화면만 열어둔 사용자는 제외
- 일시정지 상태는 집중 세션이 유지되므로 포함
- 집중 종료·완료·모달 닫기 시 제외
- 브라우저나 네트워크 연결 종료 시 Presence에서 자동 제외
- 같은 브라우저의 여러 탭은 하나의 익명 ID로 중복 제거

현재 로그인 전 구조이므로 PC와 휴대폰처럼 서로 다른
브라우저·기기는 각각 한 명으로 집계됩니다. 로그인 도입 뒤에는
익명 ID 대신 사용자 ID를 Presence key로 사용하면 완전한 사용자
단위 중복 제거가 가능합니다.

## 6. 확인

```bash
npm run build
npm run dev
```

서로 다른 브라우저 또는 시크릿 창 두 개에서 포커스 모드를
시작해 인원이 실제로 바뀌는지 확인하세요.

Supabase 환경변수가 없거나 연결에 실패하면 임의 숫자를 보여주지
않고 문구를 숨기도록 구현되어 있습니다.
