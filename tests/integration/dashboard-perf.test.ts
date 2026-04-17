/**
 * Integration test for Phase 8: Dashboard performance budget.
 * SPEC §13 "Performance & Load Tests":
 *   - Seed workload: 5 sprints × 30 todos each × 50 activity events.
 *   - Call getDashboardData({ actor }), measure wall-clock duration.
 *   - Assert duration < 500ms (SPEC §10 p95 target).
 *   - In CI relax to 1500ms with a comment noting the p95 budget.
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createMember, resetDbClient, getDb } from '../support/fixtures';
import { resetPrismaClient } from '@/server/db/client';

let container: StartedPostgreSqlContainer;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15').start();
  const connectionUri = container.getConnectionUri();

  process.env['DATABASE_URL'] = connectionUri;
  process.env['DIRECT_URL'] = connectionUri;

  resetDbClient();
  resetPrismaClient();

  execSync('pnpm prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: connectionUri, DIRECT_URL: connectionUri },
    stdio: 'pipe',
    cwd: process.cwd(),
  });
}, 120_000);

afterAll(async () => {
  const db = getDb();
  await db.$disconnect();
  await container?.stop();
});

describe('Performance: getDashboardData ≤ 500ms p95', () => {
  test(
    'returns in < 1500ms on a seeded workload (p95 budget: 500ms; relaxed for CI cold start)',
    async () => {
      const { getDashboardData } = await import('@/server/db/dashboard');
      const db = getDb();
      const actor = await createMember();

      // ── Seed: 1 active sprint with goals ─────────────────────────────────
      const sprint = await db.sprint.create({
        data: {
          name: 'Perf Test Sprint',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-14'),
          status: 'active',
          createdByUserId: actor.id,
        },
      });

      const goals = await db.sprintGoal.createManyAndReturn({
        data: Array.from({ length: 5 }, (_, i) => ({
          sprintId: sprint.id,
          name: `Goal ${i + 1}`,
          position: i,
          createdAt: new Date(),
        })),
      });

      // ── Seed 4 more planned sprints (30 todos each) ───────────────────────
      for (let s = 0; s < 4; s++) {
        const plannedSprint = await db.sprint.create({
          data: {
            name: `Planned Sprint ${s + 1}`,
            startDate: new Date(`2026-02-0${s + 1}`),
            endDate: new Date(`2026-02-1${s + 4}`),
            status: 'planned',
            createdByUserId: actor.id,
          },
        });

        await db.todo.createMany({
          data: Array.from({ length: 30 }, (_, i) => ({
            title: `Todo ${s}-${i}`,
            status: i % 3 === 0 ? 'done' : i % 3 === 1 ? 'in_progress' : 'todo',
            priority: 'medium',
            sprintId: plannedSprint.id,
            createdByUserId: actor.id,
          })),
        });
      }

      // ── Seed 30 todos attached to the active sprint ───────────────────────
      const statuses = ['todo', 'in_progress', 'done'] as const;
      const today = new Date();
      const in3Days = new Date(today);
      in3Days.setDate(today.getDate() + 3);

      for (let i = 0; i < 30; i++) {
        await db.todo.create({
          data: {
            title: `Active sprint todo ${i}`,
            status: statuses[i % 3]!,
            priority: 'medium',
            sprintId: sprint.id,
            sprintGoalId: goals[i % goals.length]!.id,
            assigneeUserId: i < 10 ? actor.id : null,
            dueDate: i < 5 ? in3Days : null,
            createdByUserId: actor.id,
          },
        });
      }

      // ── Seed 50 activity events ───────────────────────────────────────────
      await db.activityEvent.createMany({
        data: Array.from({ length: 50 }, (_, i) => ({
          actorUserId: actor.id,
          kind: 'todo_created',
          payloadJson: {},
          createdAt: new Date(Date.now() - i * 1000),
        })),
      });

      // ── Measure ───────────────────────────────────────────────────────────
      const start = performance.now();
      const data = await getDashboardData({ actor });
      const elapsed = performance.now() - start;

      console.log(`getDashboardData elapsed: ${elapsed.toFixed(1)}ms`);

      // Sanity checks
      expect(data.activeSprint).not.toBeNull();
      expect(data.activity.length).toBeGreaterThan(0);

      // Performance gate:
      //   p95 production target is 500ms (SPEC §10).
      //   CI Testcontainers adds cold-start overhead; relax to 1500ms.
      //   If this flakes above 1500ms, the query plan or index is likely missing.
      const budget = process.env['CI'] ? 1500 : 500;
      expect(elapsed).toBeLessThan(budget);
    },
    // Allow up to 60s for the test itself (most of that is seed inserts)
    60_000,
  );
});
