/** Restricted, explicit P2 activation. NEVER run automatically at build or on GET. */
import { NextResponse } from 'next/server';
import { admin, catchUp } from '../../../../../lib/hoo-trading/server';
import { createV6Anchor, APPROVED_V6_SOURCE_DIGEST } from '../../../../../lib/hoo-trading/v6-live';
import { REBASE_AT_SECOND } from '../../../../../lib/hoo-trading/market';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const expected=process.env.CRON_SECRET;
 const bearer=request.headers.get('authorization');
 if(!expected||bearer!==`Bearer ${expected}`||
  request.headers.get('x-hoo-v6-confirm')!=='ACTIVATE_V6_FLAT')
  return NextResponse.json({error:'forbidden'},{status:403});
 if(REBASE_AT_SECOND!==null)return NextResponse.json({error:'REMOVE_LEGACY_REBASE_CONFIG_FIRST'}, {status:409});
 try{
  const db=admin();
  const status=await db.from('hootrading_v6_stream').select('mode').eq('id',1).maybeSingle();
  if(status.error)throw new Error(`V6_SCHEMA_NOT_READY:${status.error.message}`);
  if(status.data)return NextResponse.json({error:'V6_STREAM_EXISTS_NO_REINITIALIZATION'}, {status:409});
  const synced=await catchUp(960);
  if(!synced.caughtUp)return NextResponse.json({error:'LEGACY_CLOCK_NOT_CAUGHT_UP',remaining:synced.remaining},{status:409});
  const anchorSecond=synced.lastSecond;
  const checkpoint=createV6Anchor(anchorSecond);
  const r=await db.rpc('hootrading_v6_activate',{
   p_expected_second:anchorSecond,p_build_digest:APPROVED_V6_SOURCE_DIGEST,p_checkpoint:checkpoint
  });
  if(r.error)throw new Error(`V6_ACTIVATE_REJECTED:${r.error.message}`);
  return NextResponse.json({ok:true,mode:'active',startSecond:Number(r.data),
   initialPrices:{HOO:58000000,EGG:12500000,COAL:4000000},
   note:'Existing flat positions verified atomically. Run live chart/quote consistency checks before economy unpause.'},
   {headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('V6 bootstrap',e);return NextResponse.json({error:e instanceof Error?e.message:'V6_ACTIVATION_FAILED'}, {status:500});}
}
