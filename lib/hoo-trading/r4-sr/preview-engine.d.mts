export type R4SrBar={t:number;open:number;high:number;low:number;close:number;volume:number};
export type R4SrPreview={mode:'LOCAL_OFFLINE_PREVIEW_ONLY';engine:string;symbol:'HOO'|'EGG'|'COAL';timeframe:number;simulated:true;livePrice:false;canTrade:false;walletConnected:false;bars:R4SrBar[]};
export declare function getR4SrPreview(symbol:string,timeframe:number):R4SrPreview;
