/** Node worker bootstrap. Only this loader may construct a production candidate engine.
 * It hashes the ACTUAL bundled executable bytes (all engine dependencies bundled), then imports
 * a read-only content-addressed copy. Runtime policy/ABI is part of checkpoint identity.
 * Next/serverless deployments must invoke this worker boundary; raw source import is unsupported.
 */
import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import {createHash}from 'node:crypto';import {pathToFileURL}from 'node:url';import {join}from 'node:path';
export const RUNTIME_ABI='hoo-v6-node-worker-abi-1';
export async function loadVerifiedBuild(bundlePath:string,cacheDirectory:string,expectedDigest?:string){
 const bytes=await readFile(bundlePath),digest=createHash('sha256').update(RUNTIME_ABI+'\0').update(bytes).digest('hex');
 if(expectedDigest&&digest!==expectedDigest)throw Error('V6_BUILD_DIGEST_NOT_APPROVED');
 await mkdir(cacheDirectory,{recursive:true});const target=join(cacheDirectory,digest+'.mjs');
 try{await writeFile(target,bytes,{flag:'wx',mode:0o400});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;const existing=await readFile(target);if(!existing.equals(bytes))throw Error('V6_EXECUTABLE_CACHE_CORRUPT');}
 await chmod(target,0o400);const module=await import(pathToFileURL(target).href);return {digest,create:(options:Record<string,unknown>)=>new module.V6Engine({...options,buildDigest:digest})};
}
