import { t as _t } from "./i18n";
import { money } from "./game/engine";
export function UpgradeSpend({ spent }: {
    spent: number;
}) {
    return (<dl className="upgrade-spend">
      <dt>{_t("アップグレード累計")}</dt>
      <dd title={`$${spent.toLocaleString("en-US", { maximumFractionDigits: 2 })}`}>
        {money(spent)}
      </dd>
    </dl>);
}
