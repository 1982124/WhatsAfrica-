const { test, expect } = require('@playwright/test');

const routes = ['/', '/marche', '/auth', '/smartlink', '/inbox', '/cart', '/jose-abada', '/wassafrica'];

for (const route of routes) {
  test(`route ${route} responds without a server error`, async ({ request }) => {
    const response = await request.get(route);
    expect(response.status(), route).toBeLessThan(500);
    expect((await response.text()).length, route).toBeGreaterThan(0);
  });
}
