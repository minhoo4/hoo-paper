import { NextResponse } from 'next/server';
import { getR4SrPreview } from '../../../../lib/hoo-trading/r4-sr/preview-engine.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Never available in production, regardless of environmental feature flags. */
export async function GET(req: Request) {
  const headers = { 'Cache-Control':'private, no-store, max-age=0', 'X-Robots-Tag':'noindex, nofollow' };
  if(process.env.NODE_ENV === 'production' || process.env.HOO_R4_SR_PREVIEW_ENABLED !== 'true')
    return new NextResponse(null,{status:404,headers});
  const params=new URL(req.url).searchParams;
  const symbol=params.get('symbol')||'HOO';
  const frameText=params.get('timeframe')||'15';
  if(!/^(1|5|15|60)$/.test(frameText) || !['HOO','EGG','COAL'].includes(symbol))
    return NextResponse.json({error:'INVALID_PREVIEW_PARAMS'},{status:400,headers});
  try {
    const payload=getR4SrPreview(symbol,Number(frameText));
    return NextResponse.json(payload,{headers});
  } catch(e) {
    console.error('r4-sr local preview',e);
    return NextResponse.json({error:'PREVIEW_FAILED'},{status:503,headers});
  }
}
