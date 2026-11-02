import type { ContestPosterData } from "@/lib/hooContestPoster";
import { formatContestKst, formatPrizeHoo, posterStatus } from "@/lib/hooContestPoster";
import styles from "./HooContestPoster.module.css";

export type HooContestPosterProps = { contest: ContestPosterData; className?: string };

export default function HooContestPoster({ contest, className }: HooContestPosterProps) {
  const prizes = contest.prizesHoo;
  return (
    <section className={[styles.poster, className].filter(Boolean).join(" ")}
      aria-label={`${contest.title || "HOO 트레이딩 대회"} 포스터`}>
      <div className={styles.brand}>
        <div className={styles.brandCore}><strong>HOO✧</strong><small>HOO WORLD</small></div>
      </div>
      <div className={styles.heading}>
        <div className={styles.headingPrimary}>HOO TRADING</div>
        <div className={styles.headingSecondary}>
          <span className={styles.wreath} aria-hidden="true">❧</span>CONTEST
          <span className={styles.wreath} aria-hidden="true">❧</span>
        </div>
      </div>
      <div className={styles.subtitle}>HOO WORLD 공식 트레이딩 대회</div>
      <div className={styles.eventName}>{contest.title || "대회명을 입력하세요"}</div>
      <div className={styles.schedule}>
        <div className={styles.dateGroup}><span className={styles.dateLabel}>대회 시작</span><strong className={styles.dateText}>{formatContestKst(contest.startsAt)}</strong></div>
        <div className={styles.dateGroup}><span className={styles.dateLabel}>대회 종료</span><strong className={styles.dateText}>{formatContestKst(contest.endsAt)}</strong></div>
      </div>
      <div className={styles.prizes}>
        <div className={styles.prize}><span className={styles.rank}>1등</span><strong className={styles.amount}>{formatPrizeHoo(prizes.first)} HOO</strong></div>
        <div className={styles.prize}><span className={styles.rank}>2등</span><strong className={styles.amount}>{formatPrizeHoo(prizes.second)} HOO</strong></div>
        <div className={styles.prize}><span className={styles.rank}>3등</span><strong className={styles.amount}>{formatPrizeHoo(prizes.third)} HOO</strong></div>
      </div>
      <div className={styles.status}>{posterStatus(contest.phase)}</div>
    </section>
  );
}
