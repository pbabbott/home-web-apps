describe('E2E: GET /healthz', () => {
  const BASE_URL = 'http://localhost:4000';

  it('should return 200 status when healthz endpoint is called', async () => {
    const response = await fetch(`${BASE_URL}/healthz`);

    console.log('response', response);
    expect(response.status).toBe(200);

    const data = (await response.json()) as { status: string };
    expect(data.status).toBe('ok');
  });
});
