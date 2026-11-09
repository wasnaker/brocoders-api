import { beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { ADMIN_EMAIL, ADMIN_PASSWORD, APP_URL } from '../utils/constants';

describe('Module lifecycle and cross-module contracts', () => {
  const app = APP_URL;
  let token: string;

  beforeAll(async () => {
    const response = await request(app)
      .post('/api/v1/auth/email/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);
    token = response.body.token;
  });

  it('persists module lifecycle state and gates API access on deactivation', async () => {
    const lifecycle = await request(app)
      .get('/api/v1/modules/lifecycle')
      .auth(token, { type: 'bearer' })
      .expect(200);

    expect(
      lifecycle.body.find((item: { moduleId: string }) => item.moduleId === 'equipment')
        ?.status,
    ).toBe('active');

    await request(app)
      .post('/api/v1/modules/equipment/deactivate')
      .auth(token, { type: 'bearer' })
      .expect(200);

    const denied = await request(app)
      .get('/api/v1/equipment/groups')
      .auth(token, { type: 'bearer' });
    expect(denied.status).toBe(403);

    await request(app)
      .post('/api/v1/modules/equipment/activate')
      .auth(token, { type: 'bearer' })
      .expect(200);

    await request(app)
      .get('/api/v1/equipment/groups')
      .auth(token, { type: 'bearer' })
      .expect(200);
  });

  it('resolves Customer Branch through Equipment public service contract', async () => {
    const branches = await request(app)
      .get('/api/v1/customer/branches?limit=1')
      .auth(token, { type: 'bearer' })
      .expect(200);

    const branch = branches.body.data?.[0];
    expect(branch?.id).toBeDefined();

    const context = await request(app)
      .get(`/api/v1/equipment/customer-branches/${branch.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200);

    expect(context.body).toMatchObject({
      id: String(branch.id),
      customerId: String(branch.customerId),
    });
  });
});
