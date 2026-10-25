import {notFound} from 'next/navigation';
import R4PreviewClient from './R4PreviewClient';
export const dynamic='force-dynamic';

export default function R4PreviewPage(){
  // NODE_ENV is checked independently: this page can never be shown by `next start`.
  if(process.env.NODE_ENV==='production' || process.env.HOO_R4_SR_PREVIEW_ENABLED!=='true')notFound();
  return <R4PreviewClient/>;
}
