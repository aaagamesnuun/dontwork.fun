import { t } from './i18n';
export const GITHUB_URL='https://github.com/aaagamesnuun/dontwork.fun';
export const CREATOR_URL='https://x.com/realnuun';
export function CommunityLinks(){return <div className="community-links"><a className="secondary" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">GitHub ↗</a><p>{t('自由にフォークして、自分のdontwork.funを作れます。')}<br/>{t('作ったら教えてください。')} <a href={CREATOR_URL} target="_blank" rel="noopener noreferrer">X @realnuun ↗</a></p></div>}
