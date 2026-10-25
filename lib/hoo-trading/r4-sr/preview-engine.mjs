/**
 * Developer-only OFFLINE R4-SR chart harness.
 * NEVER use these quotes to fill an order, value an account, or settle HOO coins.
 * Imported only by the dev-only preview route. No Supabase imports.
 */
import {V6Engine, aggregate, ENGINE_VERSION} from './v6-worker-sr.mjs';

const BUILD_DIGEST = '105a56ee1ad6fb31ffe9880a229ccf677bdfdd1e2f413178f1518e8082be19f0';
const DEMO_SEED = 'hoo-r4-sr-local-preview-static-demo-seed-not-for-production';
const INITIAL_PRICES = Object.freeze({HOO:100, EGG:20, COAL:0.005});
const SYMBOLS = Object.freeze(['HOO','EGG','COAL']);
const SPANS = Object.freeze([1,5,15,60]);
const SAMPLE_MINUTES = 1800;
const FIXED_TIME = Math.floor(Date.UTC(2026,9,25,0,0,0)/1000);
let immutableMinuteBars;

function makeBars() {
  const engine=new V6Engine({
    buildDigest:BUILD_DIGEST, secret:DEMO_SEED,
    startSecond:0, prices:INITIAL_PRICES
  });
  const result={HOO:[],EGG:[],COAL:[]};
  for(let minute=0;minute<SAMPLE_MINUTES;minute++){
    const now=engine.next();
    for(const symbol of SYMBOLS){
      const b=now[symbol];
      result[symbol].push({t:b.t,open:b.open,high:b.high,low:b.low,close:b.close,volume:b.volume});
    }
  }
  return result;
}

export function getR4SrPreview(symbol, timeframe) {
  if(!SYMBOLS.includes(symbol) || !SPANS.includes(timeframe))
    throw new Error('INVALID_PREVIEW_PARAMS');
  if(!immutableMinuteBars)immutableMinuteBars=makeBars();
  const bars=aggregate(immutableMinuteBars[symbol],timeframe,0).slice(-600).map(b=>({
    // R4 logical minute becomes a fixed simulated Unix second for the demo chart.
    t:FIXED_TIME+b.t*60, open:b.open,high:b.high,low:b.low,close:b.close,volume:b.volume
  }));
  return {mode:'LOCAL_OFFLINE_PREVIEW_ONLY',engine:ENGINE_VERSION,
    symbol,timeframe,simulated:true,livePrice:false,canTrade:false,walletConnected:false,
    bars};
}
