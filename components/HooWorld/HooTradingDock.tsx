// HOO TRADING: remove only the obsolete chart-lag warning banner.
// Does not modify market generation, refresh timers, trading or database logic.
const fs = require('node:fs');
const path = require('node:path');

const target = path.resolve(process.cwd(), 'components/HooWorld/HooTradingDock.tsx');
function abort(message) {
  console.error(`PATCH_ABORTED: ${message}`);
  process.exit(1);
}
if (!fs.existsSync(target)) abort('프로젝트 루트에서 실행하세요. HooTradingDock.tsx를 찾을 수 없습니다.');

const original = fs.readFileSync(target, 'utf8');
const warning = '⚠ 실시간 시세 지연 · 마지막 확인 차트 표시 중 (거래용 실시간 가격이 아닙니다).';
if (!original.includes(warning)) {
  console.log('NO_CHANGE: 알려진 시장 지연 경고 배너가 없습니다. 현재 파일은 수정하지 않았습니다.');
  process.exit(0);
}
if (original.split(warning).length !== 2) abort('경고 메시지가 여러 곳에 있어 자동 수정하지 않습니다.');

// Locate the exact JSX block from the previously installed chart-stability patch.
const openRegex = /^[ \t]*\{chartDelayed&&shownChartBars\.length>0&&<div\b[^\r\n]*\r?\n/gm;
const matches = [...original.matchAll(openRegex)];
if (matches.length !== 1) abort('예상한 chartDelayed JSX 블록을 하나만 찾지 못했습니다.');
const start = matches[0].index;
const warningAt = original.indexOf(warning);
const close = original.indexOf('</div>}', warningAt);
if (!(start < warningAt && close > warningAt && close - start < 2000)) {
  abort('기존 배너의 범위를 안전하게 확정할 수 없습니다.');
}
const bannerEnd = close + '</div>}'.length;
if (!/^\s*\{marketError&&!shownChartBars\.length\b/.test(original.slice(bannerEnd, bannerEnd + 150))) {
  abort('배너 뒤의 실제 연결 오류 처리 구문이 예상과 달라 자동 수정하지 않습니다.');
}
if (!original.slice(start, bannerEnd).includes(warning)) abort('경고 JSX와 메시지가 일치하지 않습니다.');

// Remove just that banner; keep the network-failure branch and CandleChart intact.
let removeEnd = bannerEnd;
if (original.slice(removeEnd).startsWith('\r\n')) removeEnd += 2;
else if (original.slice(removeEnd).startsWith('\n')) removeEnd += 1;
let updated = original.slice(0, start) + original.slice(removeEnd);

// Remove now-unused warning-only calculations if no other code references them.
function removeUnusedSingleLineDeclaration(name) {
  const occurrences = (updated.match(new RegExp('\\b' + name + '\\b', 'g')) || []).length;
  if (occurrences !== 1) return;
  const line = new RegExp('^[ \\t]*const[ \\t]+' + name + '[ \\t]*=[^\\r\\n]*;\\r?\\n', 'm');
  updated = updated.replace(line, '');
}
removeUnusedSingleLineDeclaration('chartDelayed');
removeUnusedSingleLineDeclaration('ageSeconds');

if (updated === original || updated.includes(warning)) abort('배너 제거 결과가 올바르지 않습니다.');
if (!updated.includes('{marketError&&!shownChartBars.length')) abort('서버 연결 실패 분기가 손상되었습니다.');
if (!updated.includes('bars={shownChartBars}')) abort('차트 표시 분기가 손상되었습니다.');

const backup = path.resolve(process.cwd(), '..', 'HooTradingDock.before_warning_removal_' + new Date().toISOString().replace(/[:.]/g, '-') + '.tsx.bak');
fs.writeFileSync(backup, original, 'utf8');
fs.writeFileSync(target, updated, 'utf8');
console.log('PATCH_APPLIED: 시장 지연 경고 UI만 제거했습니다.');
console.log('UNCHANGED: 실제 연결 오류 안내 / 차트 / 시장 엔진 / 거래 / DB');
console.log('BACKUP:', backup);
console.log('NEXT: npm run build && git diff --check');
