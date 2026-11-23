import { getRequest } from '../jest.integration.setup';

const body = {
  name: 'Mortgage',
  planId: 'plan-1',
  accountId: 'acct',
  payeeId: 'payee',
  amountMinMilliunits: -2500000,
  amountMaxMilliunits: -2000000,
  categoryId: 'cat',
  autoApprove: true,
};

describe('/filter-selections', () => {
  it('creates, fetches, updates, lists and deletes a rule', async () => {
    const created = await getRequest()
      .post('/filter-selections')
      .send(body)
      .expect(201);

    expect(created.body).toMatchObject({ name: 'Mortgage', enabled: true });

    const id = created.body.id;

    await getRequest().get(`/filter-selections/${id}`).expect(200);
    await getRequest()
      .put(`/filter-selections/${id}`)
      .send({ ...body, name: 'Mortgage v2', enabled: false })
      .expect(200)
      .then((res) =>
        expect(res.body).toMatchObject({ name: 'Mortgage v2', enabled: false }),
      );

    const listed = await getRequest().get('/filter-selections').expect(200);

    expect(
      listed.body.filterSelections.some((r: { id: string }) => r.id === id),
    ).toBe(true);

    await getRequest().delete(`/filter-selections/${id}`).expect(204);
    await getRequest().get(`/filter-selections/${id}`).expect(404);
  });

  it('requires a filter, an action and a sane range', async () => {
    const noFilter = {
      name: body.name,
      planId: body.planId,
      categoryId: body.categoryId,
      autoApprove: true,
    };

    await getRequest().post('/filter-selections').send(noFilter).expect(400);
    await getRequest()
      .post('/filter-selections')
      .send({ ...body, categoryId: null, autoApprove: false })
      .expect(400);
    await getRequest()
      .post('/filter-selections')
      .send({ ...body, amountMinMilliunits: 5, amountMaxMilliunits: 1 })
      .expect(400);
  });

  it('accepts a payee text pattern and rejects half or mixed payee filters', async () => {
    const rest = { ...body, payeeId: undefined };
    const pattern = {
      ...rest,
      payeeMatchType: 'starts_with',
      payeePattern: 'Royal',
    };

    const created = await getRequest()
      .post('/filter-selections')
      .send(pattern)
      .expect(201);

    expect(created.body).toMatchObject({
      payeeId: null,
      payeeMatchType: 'starts_with',
      payeePattern: 'Royal',
    });
    await getRequest().delete(`/filter-selections/${created.body.id}`);

    await getRequest()
      .post('/filter-selections')
      .send({ ...rest, payeePattern: 'Royal' })
      .expect(400);
    await getRequest()
      .post('/filter-selections')
      .send({ ...pattern, payeeId: 'payee' })
      .expect(400);
    await getRequest()
      .post('/filter-selections')
      .send({ ...pattern, payeeMatchType: 'regex' })
      .expect(400);
    await getRequest()
      .post('/filter-selections/preview')
      .send({
        planId: 'nothing',
        payeeMatchType: 'contains',
        payeePattern: 'x',
      })
      .expect(200);
  });

  it('previews matches (empty when nothing synced) and validates input', async () => {
    const res = await getRequest()
      .post('/filter-selections/preview')
      .send({ planId: 'nothing', payeeId: 'x' })
      .expect(200);

    expect(res.body).toMatchObject({ matched: 0, actionable: 0, rows: [] });
    await getRequest()
      .post('/filter-selections/preview')
      .send({ planId: 'nothing' })
      .expect(400);
  });

  it('lists the audit log and reference data', async () => {
    await getRequest().get('/filter-selections/audit?limit=5').expect(200);
    await getRequest().get('/filter-selections/audit?status=nope').expect(400);

    const ref = await getRequest()
      .get('/ynab/reference?planId=nothing')
      .expect(200);

    expect(ref.body).toEqual({ accounts: [], payees: [], categories: [] });
    await getRequest().get('/ynab/reference').expect(400);
  });

  it('accepts an apply_filter_selections job', async () => {
    await getRequest()
      .post('/jobs')
      .send({ operation: 'apply_filter_selections', parameters: {} })
      .expect(201);
  });
});
