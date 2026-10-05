import { Trophy, ShieldCheck, Eye, Bell } from 'lucide-react';

interface LeaderboardEntry {
  pharmacyId: string;
  pharmacyName: string;
  healthScore: number;
  healthTier: string;
  totalSkus: number;
  searchImpressions: number;
  alertsTriggered: number;
}

interface PharmacyLeaderboardProps {
  data: LeaderboardEntry[];
  loading: boolean;
}

function tierColor(tier: string): string {
  switch (tier) {
    case 'excellent': return '#22c55e';
    case 'strong': return '#eab308';
    case 'watch': return '#f97316';
    case 'critical': return '#ef4444';
    default: return 'var(--muted)';
  }
}

function rankMedal(rank: number) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `${rank}`;
}

/**
 * PharmacyLeaderboard — Top pharmacies sorted by health score.
 */
export default function PharmacyLeaderboard({ data, loading }: PharmacyLeaderboardProps) {
  if (loading) {
    return <div className="analytics-loading">Loading leaderboard...</div>;
  }

  if (data.length === 0) {
    return (
      <div className="analytics-empty-chart">
        <Trophy style={{ width: 24, height: 24, opacity: 0.4, marginBottom: 8 }} />
        <p>No pharmacy data available yet. Leaderboard populates after the first daily aggregation.</p>
      </div>
    );
  }

  return (
    <div className="analytics-health-table-wrap">
      <table className="analytics-health-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th>Pharmacy</th>
            <th>Health Score</th>
            <th>SKUs</th>
            <th>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Eye style={{ width: 12, height: 12 }} /> Impressions
              </span>
            </th>
            <th>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Bell style={{ width: 12, height: 12 }} /> Alerts
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry, i) => (
            <tr key={entry.pharmacyId}>
              <td style={{ fontSize: 16, textAlign: 'center' }}>{rankMedal(i + 1)}</td>
              <td>
                <span className="analytics-med-name">{entry.pharmacyName}</span>
              </td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck style={{ width: 14, height: 14, color: tierColor(entry.healthTier) }} />
                  <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {entry.healthScore}
                  </span>
                  <span
                    className="analytics-status-badge"
                    style={{
                      color: tierColor(entry.healthTier),
                      background: `${tierColor(entry.healthTier)}15`,
                    }}
                  >
                    {entry.healthTier}
                  </span>
                </div>
              </td>
              <td className="analytics-qty">{entry.totalSkus}</td>
              <td className="analytics-qty">{entry.searchImpressions}</td>
              <td className="analytics-qty">{entry.alertsTriggered}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
