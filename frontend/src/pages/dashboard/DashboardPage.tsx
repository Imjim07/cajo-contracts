import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { POLL_INTERVAL_MS } from '../../config';
import { BELOW_DESKTOP_QUERY, MOBILE_QUERY, useMediaQuery } from '../../hooks/useMediaQuery';
import { usePolledResource } from '../../hooks/usePolledResource';
import { fetchOverview } from '../../lib/cajo';
import { DetailSheet } from './DetailSheet';
import { GroupDetail } from './GroupDetail';
import { GroupList } from './GroupList';
import { SummaryStrip } from './SummaryStrip';

export function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const selected = params.get('group');
  const overview = usePolledResource('overview', fetchOverview, POLL_INTERVAL_MS);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const isStacked = useMediaQuery(BELOW_DESKTOP_QUERY) && !isMobile;
  const detailRef = useRef<HTMLDivElement>(null);

  // The selected group lives in the URL (?group=ID), so it can be shared and Back closes it.
  const selectGroup = useCallback((id: string) => setParams({ group: id }), [setParams]);
  const clearGroup = useCallback(() => setParams({}), [setParams]);

  useEffect(() => {
    if (selected && isStacked) detailRef.current?.scrollIntoView({ block: 'start' });
  }, [selected, isStacked]);

  return (
    <div className="dashboard container">
      <div className="dash-head">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="dash-title">Groups on BSC Testnet</h1>
        </div>
        <p className="readonly-banner" role="note">
          Read-only preview. Joining and contributing are not available in this version.
        </p>
      </div>

      <SummaryStrip overview={overview} />

      <div className="dash-body">
        <GroupList overview={overview} selectedId={selected} onSelect={selectGroup} />

        {!isMobile && (
          <div ref={detailRef} className="dash-detail">
            {selected ? (
              <GroupDetail idParam={selected} />
            ) : (
              <div className="state-block detail-placeholder">
                <h2 className="card-title">No group selected</h2>
                <p className="muted">Pick a group to see its round progress, deadlines and payout slots.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {isMobile && selected && (
        <DetailSheet onClose={clearGroup}>
          <GroupDetail idParam={selected} />
        </DetailSheet>
      )}
    </div>
  );
}
