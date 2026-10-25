/** Exact decimal preflight for the recovered numeric(28,12)/(24,8) policy.
 * Candidate fail-closed contract; current production wallet/schema still needs integration.
 */
type Rat={n:bigint;d:bigint};
function decimal(input:string|number):Rat{
 const s=String(input);if(s.length>160)throw Error('V6_DECIMAL_RANGE');const m=/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(s);if(!m)throw Error('V6_NONFINITE_DECIMAL');const e=Number(m[4]??0)-(m[3]?.length??0);if(!Number.isSafeInteger(e)||Math.abs(e)>500)throw Error('V6_DECIMAL_RANGE');const n=BigInt(m[2]+(m[3]??''))*(m[1]==='-'?-BigInt(1):BigInt(1));return e>=0?{n:n*BigInt(10)**BigInt(e),d:BigInt(1)}:{n,d:BigInt(10)**BigInt(-e)};
}
const round=(n:bigint,d:bigint)=>{if(d<=BigInt(0))throw Error('V6_BAD_DIVISOR');const sign=n<BigInt(0)?-BigInt(1):BigInt(1);n=n<BigInt(0)?-n:n;return sign*((n+d/BigInt(2))/d);};
function quantize(x:Rat,scale:number,precision:number){const q=round(x.n*BigInt(10)**BigInt(scale),x.d);if(q<=BigInt(0)||q>=BigInt(10)**BigInt(precision))throw Error('V6_UNREPRESENTABLE_PRICE_OR_QUANTITY');const error=q*x.d-x.n*BigInt(10)**BigInt(scale),abs=error<BigInt(0)?-error:error;if(abs*BigInt(1000000)>x.n*BigInt(10)**BigInt(scale))throw Error('V6_PRECISION_LOSS_GT_1PPM');return q;}
export function safeOrder(price:string|number,marginTC:string|number,leverage:number,side:1|-1,slippagePpm:number){
 if(!Number.isInteger(leverage)||leverage<1||leverage>20||![1,-1].includes(side)||!Number.isInteger(slippagePpm)||slippagePpm<0||slippagePpm>10000)throw Error('V6_INVALID_ORDER_POLICY');
 const p=decimal(price),m=decimal(marginTC);if(p.n<=BigInt(0)||m.n<m.d)throw Error('V6_MIN_MARGIN_OR_PRICE');
 const cash=round(m.n*BigInt(100000000),m.d);if(cash>=BigInt(10)**BigInt(24)||cash*m.d!==m.n*BigInt(100000000))throw Error('V6_CASH_PRECISION');
 const fill={n:p.n*BigInt(1000000+side*slippagePpm),d:p.d*BigInt(1000000)};const priceAtoms=quantize(fill,12,28);
 const quantityAtoms=quantize({n:cash*BigInt(leverage)*BigInt(10)**BigInt(12),d:BigInt(100000000)*priceAtoms},12,28);
 const entryFeeAtoms=round(cash*BigInt(leverage)*BigInt(6),BigInt(10000));checkCashAtoms(cash+entryFeeAtoms);
 return {priceAtoms,quantityAtoms,marginAtoms:cash,entryFeeAtoms,requiredAtoms:cash+entryFeeAtoms};
}
export function settleExact(position:ReturnType<typeof safeOrder>,exitPrice:string|number,side:1|-1,slippagePpm:number,fractionPpm=1000000){
 if(![1,-1].includes(side)||!Number.isInteger(slippagePpm)||slippagePpm<0||slippagePpm>10000)throw Error('V6_INVALID_ORDER_POLICY');
 if(!Number.isInteger(fractionPpm)||fractionPpm<=0||fractionPpm>1000000)throw Error('V6_BAD_FRACTION');
 const p=decimal(exitPrice),fill=quantize({n:p.n*BigInt(1000000-side*slippagePpm),d:p.d*BigInt(1000000)},12,28);
 const qty=round(position.quantityAtoms*BigInt(fractionPpm),BigInt(1000000)),margin=round(position.marginAtoms*BigInt(fractionPpm),BigInt(1000000));
 if(qty<=BigInt(0)||margin<=BigInt(0)||(fractionPpm<1000000&&(qty>=position.quantityAtoms||margin>=position.marginAtoms)))throw Error('V6_PARTIAL_CLOSE_BELOW_PRECISION');
 const pnl=round(BigInt(side)*qty*(fill-position.priceAtoms),BigInt(10)**BigInt(16)),fee=round(qty*fill*BigInt(6),BigInt(10)**BigInt(20)),raw=margin+pnl-fee;
 for(const x of [pnl,fee,raw,raw<BigInt(0)?-raw:BigInt(0)])checkCashAtoms(x);
 return {quantityAtoms:qty,marginAtoms:margin,pnlAtoms:pnl,feeAtoms:fee,creditAtoms:raw>BigInt(0)?raw:BigInt(0),badDebtAtoms:raw<BigInt(0)?-raw:BigInt(0)};
}
export function walletUnits(tcAtoms:bigint){return {wholeHoo:tcAtoms/BigInt(100000000000),remainderTCAtoms:tcAtoms%BigInt(100000000000)};}

/** Reference recovered funding: signed 8bp per 480 market minutes; production policy not activated. */
export function fundingExact(position:ReturnType<typeof safeOrder>,mark:string|number,side:1|-1){
 if(![1,-1].includes(side))throw Error('V6_INVALID_ORDER_POLICY');const p=quantize(decimal(mark),12,28);
 const f=round(position.quantityAtoms*p*BigInt(8),BigInt(10)**BigInt(21)),charged=side===1?(f<position.marginAtoms?f:position.marginAtoms):-f;
 checkCashAtoms(charged);checkCashAtoms(position.marginAtoms-charged);
 return {fundingAtoms:charged,remainingMarginAtoms:position.marginAtoms-charged};
}

/** Numeric(24,8) reference money boundary, including wallet totals (not only order margin). */
export function checkCashAtoms(value:bigint){if(typeof value!=='bigint'||value<=-(BigInt(10)**BigInt(24))||value>=BigInt(10)**BigInt(24))throw Error('V6_CASH_RANGE_TRANSACTION_MUST_ROLL_BACK');return value;}
export function checkedWalletDelta(balance:bigint,reserved:bigint,delta:bigint,reserveDelta:bigint){
 for(const x of [balance,reserved,delta,reserveDelta])checkCashAtoms(x);const nextBalance=checkCashAtoms(balance+delta),nextReserved=checkCashAtoms(reserved+reserveDelta);
 if(nextBalance<BigInt(0)||nextReserved<BigInt(0)||nextBalance<nextReserved)throw Error('V6_INSUFFICIENT_AVAILABLE_BALANCE');return {balance:nextBalance,reserved:nextReserved};
}
