/** Scheduled fallback: Vercel cron or an always-on worker can call this endpoint. */
import { NextResponse } from 'next/server';
import { catchUp } from '../../../../lib/hoo-trading/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const authorized=req.headers.get('authorization')===`Bearer ${process.env.CRON_SECRET}`;
 if(!process.env.CRON_SECRET||!authorized)return NextResponse.json({error:'forbidden'},{status:403});
 try { const clock=await catchUp(720);return NextResponse.json({ok:true,...clock},{headers:{'Cache-Control':'no-store'}}); }
 catch(e){return NextResponse.json({error:String(e)},{status:500});}
}
