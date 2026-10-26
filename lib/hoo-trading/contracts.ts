/** Shared wire validation. Financial authority remains in PostgreSQL. */
export type Command = {action:'open'|'close'|'risk';symbol?:'HOO'|'EGG'|'COAL';side?:'long'|'short';margin?:number;leverage?:number;stop?:number|null;take?:number|null;fraction?:number;hoo?:number};
export function validateCommand(body:unknown):{requestId:string;command:Command;timeframe:number}{
 if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('INVALID_COMMAND');
 const b=body as Record<string,unknown>;
 if(typeof b.requestId!=='string'||!/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(b.requestId))throw new Error('INVALID_REQUEST_ID');
 if(!['open','close','risk'].includes(String(b.action)))throw new Error('INVALID_ACTION');
 const number=(key:string,required=false):number|null=>{
  const x=b[key]; if(x==null){if(required)throw new Error(`MISSING_${key}`);return null;}
  if(typeof x!=='number'||!Number.isFinite(x))throw new Error(`INVALID_${key}`);return x;
 };
 const command:Command={action:b.action as Command['action']};
 {  if(!['HOO','EGG','COAL'].includes(String(b.symbol)))throw new Error('INVALID_SYMBOL');command.symbol=b.symbol as Command['symbol'];
  if(command.action==='open'){
   const margin=number('margin',true)!,leverage=number('leverage',true)!;
   if(margin<1e-8||margin>=1e16||!Number.isInteger(leverage)||leverage<1||leverage>20||!['long','short'].includes(String(b.side)))throw new Error('INVALID_OPEN');
   Object.assign(command,{margin,leverage,side:b.side});
  }
  if(command.action==='close'){
   const fraction=number('fraction')??1;if(fraction<=0||fraction>1)throw new Error('INVALID_FRACTION');command.fraction=fraction;
  }else{
   const stop=number('stop'),take=number('take');
   if((stop!==null&&stop<0)||(take!==null&&take<0))throw new Error('INVALID_RISK');Object.assign(command,{stop,take});
  }
 }
 const timeframe=b.timeframe===undefined?30:Number(b.timeframe);
 if(![30,60,240].includes(timeframe))throw new Error('INVALID_TIMEFRAME');
 return {requestId:b.requestId,command,timeframe};
}
/** Guard both sides of a mutation; reject polls launched during a pending mutation. */
export class RequestGate {
 private revision=0; private pending=false;
 beginRead(){return this.pending?null:this.revision;}
 accepts(token:number|null){return token!==null&&!this.pending&&token===this.revision;}
 beginMutation(){if(this.pending)return false;this.pending=true;this.revision++;return true;}
 endMutation(){this.revision++;this.pending=false;}
}
