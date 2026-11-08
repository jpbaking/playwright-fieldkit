import { test as base } from '@playwright/test';
import { randomUUID } from 'node:crypto';

type TestData = { entity: { id: string; email: string } };

export const test = base.extend<TestData>({
  entity: async ({ request }, use) => {
    const id = randomUUID();
    const entity = { id, email: `qe+${id}@example.test` };

    // Arrange through the application's API rather than unrelated UI steps.
    // await request.post('/api/entities', { data: entity });
    await use(entity);

    // Cleanup must be idempotent because the test may fail midway.
    // await request.delete(`/api/entities/${id}`);
  },
});
