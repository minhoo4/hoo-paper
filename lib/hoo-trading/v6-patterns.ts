import {Random,weighted}from './v6-random';
export const OUTCOMES=['breakout','failed_breakout','fakeout','opposite_breakout','invalidation','range','reversal','extension']as const;
export type PatternOutcome=typeof OUTCOMES[number];
export type PatternContext={familyIndex:number;alignment:number;duration:number;amplitude:number;vol:number;stress:number;depth:number;quality:number;recentFailure:boolean};
export function outcomeProbabilities(c:PatternContext):number[]{
 const i=c.familyIndex,base=[1.4+.12*(i%4),1+.09*((i+2)%5),.8+.1*(i%3),.7+.08*((i+1)%4),.3,.7+.1*(i%2),.65+.1*((i+1)%3),.9+.11*((i+3)%5)];
 const align=Math.tanh(c.alignment),risk=Math.log1p(c.stress)+Math.max(0,c.vol-1),quality=Math.max(.05,Math.min(1,c.quality)),formed=Math.log1p(c.duration/120),size=Math.min(2,c.amplitude/.03);
 base[0]*=Math.exp(.45*align+.35*quality-.18*risk+.05*formed);
 base[1]*=Math.exp(-.2*align+.28*risk+.22*(c.recentFailure?1:0));
 base[2]*=1+.3/(c.depth+.2)+.12*size;
 base[3]*=Math.exp(-.4*align+.16*risk);
 base[4]*=1+.3*risk+(1-quality);
 base[5]*=Math.exp(-.15*risk+.1*formed);
 base[6]*=1+.15*risk+.2*(1-quality);
 base[7]*=Math.exp(.5*align+.2*quality-.08*risk+.08*size);
 const sum=base.reduce((a,b)=>a+Math.max(.05,b),0);return base.map(x=>Math.max(.05,x)/sum);
}
export function resolvePattern(r:Random,c:PatternContext,early:boolean){const probabilities=outcomeProbabilities(c);return {result:early?'invalidation':weighted(r,OUTCOMES,probabilities),probabilities};}
