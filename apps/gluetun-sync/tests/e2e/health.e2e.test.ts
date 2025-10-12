describe('E2E: GET /healthz', () => {
  const BASE_URL = 'http://localhost:4000';

  it('should return 200 status when healthz endpoint is called', async () => {
    const response = await fetch(`${BASE_URL}/healthz`);

    console.log('response', response);
    console.log('response.status', response.status);
    const body = await response.json();
    console.log('response.body', body);
    expect(response.status).toBe(200);

    const data = body as { status: string };
    expect(data.status).toBe('ok');
  });
});
