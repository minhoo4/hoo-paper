/** PostgreSQL transaction adapter. Bind transaction() to an exclusively checked-out client.
 * PGlite tests prove SQL behavior in one local engine, not multi-session production locking.
 */
import {createHash}from'node:crypto';
export type QueryClient={query(sql:string,params?:unknown[]):Promise<{rows:any[]}>};
export type Transaction=<T>(fn:(client:QueryClient)=>Promise<T>)=>Promise<T>;
export function canonical(value:any):string{if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';}
export const digestState=(s:any)=>createHash('sha256').update(canonical(s)).digest('hex');
export class PostgresMarketStore{
 private transaction:Transaction;private stream:string;private build:string;
 constructor(transaction:Transaction,stream:string,approvedBuild:string){this.transaction=transaction;this.stream=stream;this.build=approvedBuild;}
 async initialize(checkpoint:any){if(checkpoint.buildDigest!==this.build)throw Error('V6_STORE_BUILD_MISMATCH');await this.transaction(async db=>{await db.query('INSERT INTO hoo_v6_candidate.streams VALUES($1,$2,$3,$3,$4,$5::jsonb) ON CONFLICT DO NOTHING',[this.stream,this.build,checkpoint.second,digestState(checkpoint),JSON.stringify(checkpoint)]);const r=(await db.query('SELECT build_digest FROM hoo_v6_candidate.streams WHERE stream_id=$1',[this.stream])).rows[0];if(r.build_digest!==this.build)throw Error('V6_STREAM_ALREADY_PINNED_TO_OTHER_BUILD');});}
 async load(){return this.transaction(async db=>{const r=(await db.query('SELECT * FROM hoo_v6_candidate.streams WHERE stream_id=$1',[this.stream])).rows[0];if(!r)throw Error('V6_STREAM_MISSING');if(r.build_digest!==this.build||r.checkpoint.buildDigest!==this.build)throw Error('V6_STORE_BUILD_MISMATCH');if(digestState(r.checkpoint)!==r.state_hash)throw Error('V6_CORRUPT_STORED_STATE');return {checkpoint:r.checkpoint,hash:r.state_hash};});}
 async commit(expected:{checkpoint:any;hash:string},checkpoint:any,batch:any[]){
  if(checkpoint.buildDigest!==this.build||expected.checkpoint.buildDigest!==this.build)throw Error('V6_STORE_BUILD_MISMATCH');
  if(digestState(expected.checkpoint)!==expected.hash||checkpoint.namespace!==expected.checkpoint.namespace)throw Error('V6_STATE_CONTEXT_MISMATCH');
  if(!batch.length||batch.length>1000)throw Error('V6_BATCH_LIMIT');let second=expected.checkpoint.second;const rows:any[]=[];
  for(const all of batch){second++;for(const symbol of ['HOO','EGG','COAL']){const b=all[symbol];if(!b||b.t!==second||b.path?.length!==21||![b.open,b.high,b.low,b.close,b.volume,...b.path].every(Number.isFinite)||b.volume<=0||b.volume>Number.MAX_SAFE_INTEGER||b.low<=0||b.high!==Math.max(...b.path)||b.low!==Math.min(...b.path)||b.open!==b.path[0]||b.close!==b.path[20])throw Error('V6_INVALID_COMMIT_PATH');const prior=rows.length>=3?rows[rows.length-3].close:expected.checkpoint.coins[symbol].price;if(b.open!==prior)throw Error('V6_COMMIT_DISCONTINUITY');rows.push({...b,symbol,second});}}
  for(const symbol of ['HOO','EGG','COAL'])if(checkpoint.coins[symbol].price!==batch.at(-1)[symbol].close)throw Error('V6_STATE_CLOSE_MISMATCH');
  if(checkpoint.second!==second)throw Error('V6_CHECKPOINT_BATCH_DISAGREES');
  const hash=digestState(checkpoint),id=digestState({build:this.build,stream:this.stream,previous:expected.hash,hash,batch});
  return this.transaction(async db=>{const current=(await db.query('SELECT * FROM hoo_v6_candidate.streams WHERE stream_id=$1 FOR UPDATE',[this.stream])).rows[0];if(current.build_digest!==this.build)throw Error('V6_STORE_BUILD_MISMATCH');if(current.state_hash!==expected.hash||Number(current.last_second)!==expected.checkpoint.second)return false;
   await db.query('INSERT INTO hoo_v6_candidate.bars SELECT $1,symbol,second,open,high,low,close,volume,path,$3 FROM jsonb_to_recordset($2::jsonb) AS b(symbol text,second bigint,open float8,high float8,low float8,close float8,volume float8,path jsonb)',[this.stream,JSON.stringify(rows),id]);
   await db.query(`INSERT INTO hoo_v6_candidate.rollups
 SELECT $1,symbol,span,$3+floor((second-$3-1)::numeric/span)::bigint*span AS bucket,
 (array_agg(open ORDER BY second))[1],max(high),min(low),(array_agg(close ORDER BY second DESC))[1],sum(volume),min(second),max(second),count(*)
 FROM jsonb_to_recordset($2::jsonb) AS b(symbol text,second bigint,open float8,high float8,low float8,close float8,volume float8)
 CROSS JOIN unnest(ARRAY[5,15,60,240,1440]) AS span GROUP BY symbol,span,bucket
 ON CONFLICT(stream_id,symbol,span,bucket) DO UPDATE SET
 high=greatest(hoo_v6_candidate.rollups.high,excluded.high),low=least(hoo_v6_candidate.rollups.low,excluded.low),close=excluded.close,
 volume=hoo_v6_candidate.rollups.volume+excluded.volume,last_second=excluded.last_second,covered_count=hoo_v6_candidate.rollups.covered_count+excluded.covered_count`,[this.stream,JSON.stringify(rows),Number(current.origin_second)]);
   await db.query('INSERT INTO hoo_v6_candidate.commits VALUES($1,$2,$3,$4,$5)',[this.stream,id,expected.checkpoint.second+1,second,hash]);
   await db.query('UPDATE hoo_v6_candidate.streams SET last_second=$2,state_hash=$3,checkpoint=$4::jsonb WHERE stream_id=$1',[this.stream,second,hash,JSON.stringify(checkpoint)]);return true;});
 }
 async readCandles(symbol:string,span:number,limit=100){
 if(span===1)return this.readRecent(symbol,limit);if(!['HOO','EGG','COAL'].includes(symbol)||![5,15,60,240,1440].includes(span)||!Number.isInteger(limit)||limit<1||limit>1000)throw Error('V6_BAD_QUERY');
 return this.transaction(async db=>(await db.query('SELECT r.bucket AS t,r.open,r.high,r.low,r.close,r.volume,r.covered_count,r.covered_count=r.span AS complete FROM hoo_v6_candidate.rollups r JOIN hoo_v6_candidate.streams s USING(stream_id) WHERE stream_id=$1 AND symbol=$2 AND span=$3 AND r.last_second<=s.last_second ORDER BY bucket DESC LIMIT $4',[this.stream,symbol,span,limit])).rows);
 }
 async readRecent(symbol:string,limit=100){if(!['HOO','EGG','COAL'].includes(symbol)||!Number.isInteger(limit)||limit<1||limit>1000)throw Error('V6_BAD_QUERY');return this.transaction(async db=>(await db.query('SELECT second AS t,open,high,low,close,volume FROM hoo_v6_candidate.bars WHERE stream_id=$1 AND symbol=$2 AND second<=(SELECT last_second FROM hoo_v6_candidate.streams WHERE stream_id=$1) ORDER BY second DESC LIMIT $3',[this.stream,symbol,limit])).rows);}
}
export async function advanceCommitted(store:PostgresMarketStore,build:{digest:string;create:(o:any)=>any},anchor:any,target:number,serverNow:number,maxBatch=1000){
 if(!Number.isSafeInteger(target)||!Number.isSafeInteger(serverNow)||target>serverNow||target<anchor.startSecond||maxBatch<1||maxBatch>1000||!Number.isInteger(maxBatch))throw Error('V6_BAD_TARGET');const before=await store.load();if(before.checkpoint.buildDigest!==build.digest)throw Error('V6_COORDINATOR_BUILD_MISMATCH');const engine=build.create({...anchor,checkpoint:before.checkpoint}),batch=[];while(engine.second<Math.min(target,before.checkpoint.second+maxBatch))batch.push(engine.next());if(!batch.length)return {committed:engine.second,generated:0,conflict:false};const ok=await store.commit(before,engine.checkpoint(),batch);return{committed:ok?engine.second:before.checkpoint.second,generated:ok?batch.length:0,conflict:!ok};
}
export function publicCandle(b:any,committedSecond:number){if(!Number.isSafeInteger(b.t)||b.t>committedSecond)throw Error('V6_FUTURE_BAR');return{t:b.t,open:b.open,high:b.high,low:b.low,close:b.close,volume:b.volume};}
export function gameTime(realSecond:number,realEpoch:number,gameEpochMs:number){if(![realSecond,realEpoch,gameEpochMs].every(Number.isSafeInteger)||realSecond<realEpoch)throw Error('V6_BAD_TIME');const time=gameEpochMs+(realSecond-realEpoch)*60000;if(!Number.isSafeInteger(time)||Math.abs(time)>8640000000000000)throw Error('V6_TIME_RANGE');return time;}
