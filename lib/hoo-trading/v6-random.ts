import {createCipheriv,createHmac} from 'node:crypto';
export type RandomState={words:number;spare:number|null};
export class Random{
 private key:Buffer;private buffer=Buffer.alloc(0);private cursor=0;words:number;spare:number|null;
 constructor(secret:string,domain:string,state:RandomState={words:0,spare:null}){this.key=createHmac('sha256',secret).update('hoo-v6-1:'+domain).digest();this.words=state.words;this.spare=state.spare;}
 u(){if(this.cursor>=this.buffer.length){const offset=this.words*4,iv=Buffer.alloc(16);iv.writeBigUInt64BE(BigInt(Math.floor(offset/16)),8);this.buffer=createCipheriv('aes-256-ctr',this.key,iv).update(Buffer.alloc(32768));this.cursor=offset%16;}const v=(this.buffer.readUInt32LE(this.cursor)+.5)/4294967296;this.cursor+=4;this.words++;return v;}
 n(){if(this.spare!==null){const s=this.spare;this.spare=null;return s;}const r=Math.sqrt(-2*Math.log(this.u())),a=2*Math.PI*this.u();this.spare=r*Math.sin(a);return r*Math.cos(a);}
 snapshot():RandomState{return{words:this.words,spare:this.spare};}
}
export function weighted<T>(r:Random,values:readonly T[],weights:readonly number[]):T{let k=r.u()*weights.reduce((a,b)=>a+b,0);for(let i=0;i<values.length;i++){k-=weights[i];if(k<=0)return values[i];}return values.at(-1)!;}
export function duration(r:Random,scale:number){return Math.max(2,Math.round(scale*Math.exp(.65*r.n()-.21)));}
