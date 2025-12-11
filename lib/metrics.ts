// lib/metrics.ts
import { prisma } from '@/lib/prisma';

/**
 * Helper: last N days as YYYY-MM-DD labels (UTC)
 */
function lastNDaysLabels(days = 14): string[] {
  const out: string[] = [];
  const today = new Date();
  // normalize to UTC midnight
  today.setUTCHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Redemptions timeseries for the last N days, plus pct change vs prior window.
 * Runs queries SEQUENTIALLY (important for low connection limits).
 */
export async function redemptionSeriesWithTrend(merchantId: string, days = 14) {
  const labels = lastNDaysLabels(days);
  const start = new Date(labels[0] + 'T00:00:00.000Z');
  const prevStart = new Date(start);
  prevStart.setUTCDate(prevStart.getUTCDate() - days);

  // Current window
  const currRows = await prisma.redemption.findMany({
    where: { merchantId, createdAt: { gte: start } },
    select: { createdAt: true },
  });

  // Previous window
  const prevRows = await prisma.redemption.findMany({
    where: { merchantId, createdAt: { gte: prevStart, lt: start } },
    select: { createdAt: true },
  });

  // Aggregate per day
  const buckets = new Map<string, number>();
  labels.forEach((k) => buckets.set(k, 0));
  for (const r of currRows) {
    const key = r.createdAt.toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
  }

  const data = labels.map((k) => buckets.get(k) || 0);
  const total = data.reduce((a, b) => a + b, 0);
  const prevTotal = prevRows.length;
  const deltaPct = prevTotal === 0 ? 100 : ((total - prevTotal) / prevTotal) * 100;

  return { labels, data, total, prevTotal, deltaPct };
}

/**
 * Deals-created timeseries for the last N days, plus pct change vs prior window.
 * Runs queries SEQUENTIALLY (important for low connection limits).
 */
export async function dealCreatedSeriesWithTrend(merchantId: string, days = 14) {
  const labels = lastNDaysLabels(days);
  const start = new Date(labels[0] + 'T00:00:00.000Z');
  const prevStart = new Date(start);
  prevStart.setUTCDate(prevStart.getUTCDate() - days);

  // Current window
  const currRows = await prisma.deal.findMany({
    where: { merchantId, createdAt: { gte: start } },
    select: { createdAt: true },
  });

  // Previous window
  const prevRows = await prisma.deal.findMany({
    where: { merchantId, createdAt: { gte: prevStart, lt: start } },
    select: { createdAt: true },
  });

  // Aggregate per day
  const buckets = new Map<string, number>();
  labels.forEach((k) => buckets.set(k, 0));
  for (const r of currRows) {
    const key = r.createdAt.toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
  }

  const data = labels.map((k) => buckets.get(k) || 0);
  const total = data.reduce((a, b) => a + b, 0);
  const prevTotal = prevRows.length;
  const deltaPct = prevTotal === 0 ? 100 : ((total - prevTotal) / prevTotal) * 100;

  return { labels, data, total, prevTotal, deltaPct };
}
