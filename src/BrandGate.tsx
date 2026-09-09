import { t as _t } from "./i18n";
import { useEffect, useState } from 'react';
import { DesktopHost } from './DesktopHost';
import { oldGameOrigin, recoverMigration, withMigrationLock, withoutRetiredMigrationHash, NEW_ORIGIN, MIGRATION_PENDING } from './domainMigration';

export function BrandGate() {
    // A previous release may have closed during a migration. Recover its local
    // journal before mounting the game, even though transfers have been retired.
    const [recover, setRecover] = useState(() => { try {
        return !!localStorage.getItem(MIGRATION_PENDING);
    }
    catch {
        return false;
    } }), [error, setError] = useState('');
    useEffect(() => {
        const hash = withoutRetiredMigrationHash(location.hash);
        if (hash !== location.hash)
            history.replaceState(null, '', location.pathname + location.search + hash);
    }, []);
    useEffect(() => { if (recover)
        void withMigrationLock(async () => recoverMigration(localStorage)).then(() => setRecover(false)).catch(e => setError(e instanceof Error ? e.message : _t("セーブを復元できませんでした。"))); }, [recover]);
    if (recover)
        return <main className="domain-migration"><section><h1>dontwork.fun</h1><p>{error || _t("移行前のセーブを復元しています…")}</p>{error && <button className="primary" onClick={() => location.reload()}>{_t("もう一度試す")}</button>}</section></main>;
    if (oldGameOrigin(location.origin))
        return <main className="domain-migration"><section><img src="/icons/dontwork.svg" alt="" width="76" height="76"/><h1>dontwork<span>.fun</span></h1><p className="migration-lead">{_t("BeBullish.funは")}<br />{_t("dontwork.funになりました。")}</p><p>{_t("ランキングは引き続き利用できます。")}</p><a className="primary" href={NEW_ORIGIN + '/'}>{_t("dontwork.funへ →")}</a></section></main>;
    return <DesktopHost />;
}
