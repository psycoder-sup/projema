/**
 * Weekly Active Users rollup job.
 * Phase 7: MVP computes WAU on-demand in adminGetWau; this cron hook stays
 * in place for future materialized-view optimization. For now it is a no-op
 * that records a last-run timestamp via the job itself.
 *
 * Future: write an aggregated count into a summary table so adminGetWau can
 * read from that table instead of scanning sessions_log on every request.
 */

export async function rollupWeeklyActive(): Promise<{ ok: true; message: string }> {
  // MVP: WAU is computed on-demand. The cron entry keeps the infra hook live
  // so that materialising the count in v1.1 is a drop-in change here.
  return { ok: true, message: 'WAU computed on-demand (no materialization in v1)' };
}
