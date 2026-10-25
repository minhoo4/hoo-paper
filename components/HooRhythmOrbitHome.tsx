"use client";

import "./HooRhythmOrbitHome.css";

type HooRhythmOrbitHomeProps = {
  onStart: () => void;
  onSelect: () => void;
  onStudio: () => void;
  onExit: () => void;
  isAdmin: boolean;
  adminChecked: boolean;
};

const SOUND_BARS = Array.from({ length: 43 }, (_, index) => {
  const distance = Math.abs(index - 21) / 21;
  const envelope = 1 - distance * 0.52;
  const wobble = Math.abs(Math.sin(index * 1.73) * Math.cos(index * 0.69));
  const height = 13 + Math.round((21 + 44 * wobble) * envelope);
  return { height, delay: ((index * 11) % 29) / -10 };
});

const STARS = [
  [5, 16, 2], [12, 59, 1.4], [19, 28, 1.3], [24, 76, 1.2],
  [32, 10, 1.5], [39, 47, 1], [48, 13, 1.2], [55, 83, 1.3],
  [64, 27, 2], [72, 65, 1.2], [79, 18, 1.6], [85, 47, 1.1],
  [91, 76, 1.5], [96, 23, 2], [8, 91, 1.2], [96, 91, 1.1],
] as const;

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

function MusicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18V5l11-2v13" /><ellipse cx="6" cy="18" rx="3" ry="2" /><ellipse cx="17" cy="16" rx="3" ry="2" />
    </svg>
  );
}

function StudioIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m14.5 6.5 3 3m-11 8 10-10m2.6-3.6a4 4 0 0 1-5.5 5.5l-7.9 7.9a2 2 0 0 1-2.8-2.8l7.9-7.9a4 4 0 0 1 5.5-5.5l-2.1 2.1 2.7 2.7z" />
    </svg>
  );
}

/**
 * HOO RHYTHM · ORBIT STAGE
 * First screen only. All gameplay/data logic stays inside HooRhythmGame.tsx.
 * This component does not fetch, mutate storage, or interact with Supabase.
 */
export default function HooRhythmOrbitHome({
  onStart,
  onSelect,
  onStudio,
  onExit,
  isAdmin,
  adminChecked,
}: HooRhythmOrbitHomeProps) {
  return (
    <main className="hor-home" aria-label="리듬후 메인 화면">
      <div className="hor-universe" aria-hidden="true">
        <div className="hor-universe-glow hor-universe-glow--left" />
        <div className="hor-universe-glow hor-universe-glow--right" />
        <div className="hor-starfield hor-starfield--far" />
        <div className="hor-starfield hor-starfield--near" />
        {STARS.map(([x, y, size], i) => (
          <span
            key={i}
            className="hor-bright-star"
            style={{ left: `${x}%`, top: `${y}%`, width: size * 2, height: size * 2, animationDelay: `${-i * 0.44}s` }}
          />
        ))}
        <div className="hor-horizon" />
      </div>

      <div className="hor-content">
        <header className="hor-header">
          <div className="hor-eyebrow"><span />4 KEY MUSIC EXPERIENCE<span /></div>
          <h1>HOO <em>RHYTHM</em></h1>
          <p className="hor-subtitle">음악이 머무는 또 하나의 밤</p>
          <button type="button" className="hor-exit" onClick={onExit} aria-label="리듬후를 나가고 후사이트로 돌아가기">
            <span aria-hidden="true">×</span><span>나가기</span>
          </button>
        </header>

        <div className="hor-middle">
          <div className="hor-art" aria-label="음악을 형상화한 별과 회전 궤도">
            <div className="hor-art-glow" aria-hidden="true" />
            <div className="hor-axis hor-axis--x" aria-hidden="true" />
            <div className="hor-axis hor-axis--y" aria-hidden="true" />
            <div className="hor-circle hor-circle--outer" aria-hidden="true" />
            <div className="hor-circle hor-circle--middle" aria-hidden="true" />
            <div className="hor-circle hor-circle--inner" aria-hidden="true" />
            <div className="hor-orbit hor-orbit--a" aria-hidden="true"><i /></div>
            <div className="hor-orbit hor-orbit--b" aria-hidden="true"><i /></div>
            <div className="hor-orbit hor-orbit--c" aria-hidden="true"><i /></div>
            <div className="hor-eq" aria-hidden="true">
              {SOUND_BARS.map(({ height, delay }, i) => (
                <span key={i} className="hor-eq-bar" style={{ height, animationDelay: `${delay}s` }} />
              ))}
            </div>
            <div className="hor-center-glow" aria-hidden="true" />
            <button type="button" className="hor-core" onClick={onStart} aria-label="게임 시작, 곡 선택으로 이동">
              <span className="hor-core-inner">
                <svg className="hor-core-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m8 5 12 7-12 7V5Z" /></svg>
              </span>
            </button>
            <span className="hor-art-spark hor-art-spark--a" aria-hidden="true">✦</span>
            <span className="hor-art-spark hor-art-spark--b" aria-hidden="true">✧</span>
            <span className="hor-art-spark hor-art-spark--c" aria-hidden="true">✦</span>
          </div>
          <p className="hor-tagline">YOUR MUSIC <span>·</span> YOUR RHYTHM</p>
        </div>

        <nav className="hor-actions" aria-label="리듬후 메뉴">
          <button type="button" onClick={onStart} className="hor-card hor-card--start">
            <span className="hor-card-icon hor-card-icon--start" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="m8 5 12 7-12 7V5Z" /></svg>
            </span>
            <span className="hor-card-label"><strong>게임 시작</strong><small>음악의 궤도로 들어가기</small></span>
            <span className="hor-card-arrow" aria-hidden="true"><ArrowIcon /></span>
          </button>
          <div className="hor-actions-secondary">
            <button type="button" onClick={onSelect} className="hor-card hor-card--secondary">
              <span className="hor-card-icon hor-card-icon--music" aria-hidden="true"><MusicIcon /></span>
              <span className="hor-card-label"><strong>곡 선택</strong><small>다양한 음악을 만나보세요</small></span>
              <span className="hor-card-arrow" aria-hidden="true"><ArrowIcon /></span>
            </button>
            <button type="button" onClick={onStudio} className="hor-card hor-card--secondary hor-card--studio">
              <span className="hor-card-icon hor-card-icon--studio" aria-hidden="true"><StudioIcon /></span>
              <span className="hor-card-label"><strong>관리자 작업실</strong><small>음원과 채보를 제작해요</small></span>
              <span className="hor-card-admin" aria-label={!adminChecked ? "권한 확인 중" : isAdmin ? "관리자" : "로컬 모드"}>
                {!adminChecked ? "CHECK" : isAdmin ? "ADMIN" : "LOCAL"}
              </span>
            </button>
          </div>
        </nav>

        <footer className="hor-footer">
          <span className="hor-version">ver 1.0.0</span>
          <div className="hor-keys"><span>4키로 플레이하세요</span><div className="hor-keycaps" aria-label="조작 키 A, S, K, L">{["A", "S", "K", "L"].map((key) => <kbd key={key}>{key}</kbd>)}</div></div>
          <span className="hor-footer-right">ORBIT STAGE</span>
        </footer>
      </div>
    </main>
  );
}
