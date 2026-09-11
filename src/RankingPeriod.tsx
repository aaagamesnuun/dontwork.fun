import { t, language } from "./i18n";
export type RankingPeriod = "all" | "day" | "week";
export interface PeriodInfo { period: RankingPeriod; periodStart: string | null; periodEnd: string | null }
export function RankingPeriods({ value, onChange }: {value:RankingPeriod;onChange:(p:RankingPeriod)=>void}) {
  return <div className="ranking-periods" role="group" aria-label={t("集計期間")}>
    {([['day','日次'],['week','週次'],['all','全体']] as const).map(([id,label]) => <button key={id} className={value===id?'selected':''} aria-pressed={value===id} onClick={()=>onChange(id)}>{t(label)}</button>)}
  </div>;
}
export function RankingSummary({ page, label, value }: {page:PeriodInfo & {total:number};label:string;value:string}) {
  const date=(v:string)=>new Intl.DateTimeFormat(language()==='ja'?'ja-JP':'en-US',{timeZone:'Asia/Tokyo',month:'short',day:'numeric'}).format(new Date(v));
  return <div className="ranking-summary">
    <div><span>{label}</span><strong>{value}</strong></div><div><span>{t("記録数")}</span><strong>{page.total.toLocaleString()}</strong></div>
    <small>{page.periodStart&&page.periodEnd ? `${date(page.periodStart)} – ${date(new Date(Date.parse(page.periodEnd)-1).toISOString())} · ` : ''}{t("登録日時で集計・日本時間。週は月曜始まり。")}</small>
  </div>;
}
