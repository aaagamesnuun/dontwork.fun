import { t } from "./i18n";
export function RankingWork({ count }: { count?: number | null }) {
  const known=typeof count==='number' && Number.isSafeInteger(count) && count>=0;
  return <small className="score-work">{known?t("WORK {0}回",count.toLocaleString()):"WORK —"}</small>;
}
