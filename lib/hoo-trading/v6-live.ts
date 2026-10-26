/** HOO P2: the only production bridge from V6 patterns/shocks into traded OHLCV.
 * No activation without dedicated SQL and authenticated bootstrap. All state and
 * chart bars commit in the SAME PostgreSQL transaction as position settlement.
 */
import 'server-only';
import { randomUUID } from 'node:crypto';
import { V6Engine, type Checkpoint } from './v6-engine';
import type { SupabaseClient } from '@supabase/supabase-js';
import { marketSecond } from './market';

// Hash-pinned engine source set: v6-engine, v6-shocks, v6-patterns, v6-random.
// Not a Next.js bundle attestation. P2 installer verifies source hashes.
export const APPROVED_V6_SOURCE_DIGEST = 'a09600c5d837780c7b9fb2f1e3b1a9e461c82816ee18cee53c9556e596ce1c9c';
export const V6_ANCHORS = { HOO: 58_000_000, EGG: 12_500_000, COAL: 4_000_000 } as const;

type V6Stream = { mode:string; start_second:number|string; last_second:number|string;
  build_digest:string; checkpoint:Checkpoint };
const secret = (): string => {
 const value=process.env.HOO_MARKET_SECRET;
 if(!value||value.length<24)throw new Error('V6_PRIVATE_MARKET_SECRET_REQUIRED');
 return value;
};
function makeEngine(startSecond:number,checkpoint?:Checkpoint):V6Engine {
 return new V6Engine({buildDigest:APPROVED_V6_SOURCE_DIGEST,secret:secret(),
  startSecond,prices:V6_ANCHORS,checkpoint});
}
export function createV6Anchor(second:number):Checkpoint {
 if(!Number.isSafeInteger(second))throw new Error('V6_INVALID_ANCHOR_TIME');
 return makeEngine(second).checkpoint();
}
function parsedStream(value:unknown):{last:number;start:number;checkpoint:Checkpoint}{
 const r=value as V6Stream;
 if(!r||r.mode!=='active'||r.build_digest!==APPROVED_V6_SOURCE_DIGEST)
  throw new Error('V6_ENGINE_VERSION_MISMATCH');
 const start=Number(r.start_second),last=Number(r.last_second);
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(last)||last<start||!r.checkpoint||
    Number(r.checkpoint.second)!==last)throw new Error('V6_CHECKPOINT_UNTRUSTED');
 return {start,last,checkpoint:r.checkpoint};
}
/** Replay all unsaved minutes. Do not fast-forward, omit OHLCV, or use legacy quotes. */
export async function catchUpV6(db:SupabaseClient,maxTicks:number):Promise<{caughtUp:boolean;remaining:number;lastSecond:number}> {
 // HOO_V6_SINGLE_WRITER_V1
 const leaseToken=randomUUID();

 const lease=await db.rpc('hootrading_v6_try_lease',{
  p_token:leaseToken
 });

 if(lease.error)
  throw new Error(`V6_LEASE_FAILED:${lease.error.message}`);

 if(lease.data!==true){
  const {data,error}=await db.from('hootrading_v6_stream')
   .select('last_second').eq('id',1).single();

  if(error)throw new Error(`V6_CLOCK_FAILED:${error.message}`);

  const last=Number(data.last_second);
  const target=marketSecond();

  if(!Number.isSafeInteger(last)||last<0||last>target+2)
   throw new Error('V6_INVALID_CLOCK');

  return {
   caughtUp:last>=target-1,
   remaining:Math.max(0,target-last),
   lastSecond:last
  };
 }

 try {
 const budget=Math.min(720,Math.max(1,Math.trunc(maxTicks)));
 const deadline=Date.now()+5000;
 let produced=0,completed=0;
 while(produced<budget&&Date.now()<deadline){
  const {data,error}=await db.from('hootrading_v6_stream')
   .select('mode,start_second,last_second,build_digest,checkpoint').eq('id',1).single();
  if(error)throw new Error(`V6_LOAD_FAILED:${error.message}`);
  const row=parsedStream(data);
  const target=marketSecond();
  if(row.last>=target-1){completed=row.last;break;}
  const count=Math.min(45,budget-produced,Math.max(0,target-row.last));
  if(count<1){completed=row.last;break;}
  const engine=makeEngine(row.start,row.checkpoint);
  const batch:Array<{second:number;quotes:Record<string,unknown>}>=[];
  for(let k=0;k<count;k++){
   const quote=engine.next();
   batch.push({second:engine.second,quotes:quote});
  }
  const next=engine.checkpoint();
  const result=await db.rpc('hootrading_v6_advance_atomic',{
   p_expected_second:row.last,p_batch:batch,p_checkpoint:next
  });
  if(result.error){
   // Another worker won the compare-and-swap. Reload fresh state, never reuse
   // stale generated prices and never partially submit this batch.
   if(result.error.message.includes('V6_REPLAY_CONFLICT'))continue;
   throw new Error(`V6_ADVANCE_FAILED:${result.error.message}`);
  }
  const accepted=Number(result.data);
  if(!Number.isSafeInteger(accepted)||accepted!==engine.second)
   throw new Error('V6_COMMIT_MISMATCH');
  completed=accepted;produced+=count;
 }
 const target=marketSecond();
 if(completed===0){
  const {data,error}=await db.from('hootrading_v6_stream').select('last_second').eq('id',1).single();
  if(error)throw new Error(`V6_CLOCK_FAILED:${error.message}`);
  completed=Number(data.last_second);
 }
 return {caughtUp:completed>=target-1,remaining:Math.max(0,target-completed),lastSecond:completed};
 } finally {
  const {error:releaseError}=await db.rpc(
   'hootrading_v6_release_lease',
   {p_token:leaseToken}
  );
  if(releaseError)
   console.error('V6_LEASE_RELEASE_FAILED',releaseError.message);
 }
}
