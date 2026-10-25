/** HOO reset season 2026-10-23: initial allotment 500 HOO per account.
 * This is a BASELINE estimate, not an independently verified lifetime ROI.
 * Additional rewards, gifts, purchases, or later capital injections require
 * an immutable account-by-account cashflow ledger to calculate true ROI.
 */
export const SEASON_INITIAL_HOO=500;
export const SEASON_INITIAL_TC=SEASON_INITIAL_HOO*1000;
export function returnOnInitialCapital(realizedTc:number):number {
 if(!Number.isFinite(realizedTc)||Math.abs(realizedTc)>Number.MAX_SAFE_INTEGER)
  throw new Error('INVALID_PERFORMANCE_REALIZED_TC');
 return realizedTc/SEASON_INITIAL_TC*100;
}
