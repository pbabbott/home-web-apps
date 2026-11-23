import { Request, Response } from 'express';
import {
  countFilterAuditEntriesByRule,
  createFilterSelection,
  deleteFilterSelection,
  getFilterSelection,
  getYnabReference,
  listFilterAuditEntries,
  listFilterSelections,
  previewFilterSelection,
  updateFilterSelection,
} from '@abbottland/budget-db';
import { db } from '../db';
import type {
  FilterSelectionBody,
  ListAuditQuery,
  PreviewBody,
  ReferenceQuery,
} from '../schemas/filter-selections';

const fail = (res: Response, route: string, err: unknown) => {
  console.error(`${route} failed:`, err);
  res.status(500).json({ message: 'internal server error' });
};

const toInput = (body: FilterSelectionBody) => ({
  name: body.name,
  enabled: body.enabled,
  planId: body.planId,
  accountId: body.accountId ?? null,
  payeeId: body.payeeId ?? null,
  payeeMatchType: body.payeeMatchType ?? null,
  payeePattern: body.payeePattern ?? null,
  amountMinMilliunits: body.amountMinMilliunits ?? null,
  amountMaxMilliunits: body.amountMaxMilliunits ?? null,
  categoryId: body.categoryId ?? null,
  autoApprove: body.autoApprove,
});

export const listSelections = async (_req: Request, res: Response) => {
  try {
    const [rules, counts] = await Promise.all([
      listFilterSelections(db),
      countFilterAuditEntriesByRule(db),
    ]);

    res.status(200).json({
      filterSelections: rules.map((rule) => ({
        ...rule,
        auditEntryCount: counts.get(rule.id)?.total ?? 0,
        auditAppliedCount: counts.get(rule.id)?.applied ?? 0,
      })),
    });
  } catch (err) {
    fail(res, 'GET /filter-selections', err);
  }
};

export const getSelection = async (req: Request, res: Response) => {
  try {
    const row = await getFilterSelection(db, req.params.id);

    if (!row)
      return res.status(404).json({ message: 'filter selection not found' });

    res.status(200).json(row);
  } catch (err) {
    fail(res, 'GET /filter-selections/:id', err);
  }
};

export const postSelection = async (req: Request, res: Response) => {
  try {
    const row = await createFilterSelection(
      db,
      toInput(req.body as FilterSelectionBody),
    );

    res.status(201).json(row);
  } catch (err) {
    fail(res, 'POST /filter-selections', err);
  }
};

export const putSelection = async (req: Request, res: Response) => {
  try {
    const row = await updateFilterSelection(
      db,
      req.params.id,
      toInput(req.body as FilterSelectionBody),
    );

    if (!row)
      return res.status(404).json({ message: 'filter selection not found' });

    res.status(200).json(row);
  } catch (err) {
    fail(res, 'PUT /filter-selections/:id', err);
  }
};

export const removeSelection = async (req: Request, res: Response) => {
  try {
    const removed = await deleteFilterSelection(db, req.params.id);

    if (!removed)
      return res.status(404).json({ message: 'filter selection not found' });

    res.status(204).end();
  } catch (err) {
    fail(res, 'DELETE /filter-selections/:id', err);
  }
};

export const postPreview = async (req: Request, res: Response) => {
  const { planId, ...filters } = req.body as PreviewBody;

  try {
    res.status(200).json(
      await previewFilterSelection(db, planId, {
        accountId: filters.accountId ?? null,
        payeeId: filters.payeeId ?? null,
        payeeMatchType: filters.payeeMatchType ?? null,
        payeePattern: filters.payeePattern ?? null,
        amountMinMilliunits: filters.amountMinMilliunits ?? null,
        amountMaxMilliunits: filters.amountMaxMilliunits ?? null,
      }),
    );
  } catch (err) {
    fail(res, 'POST /filter-selections/preview', err);
  }
};

export const listAudit = async (req: Request, res: Response) => {
  try {
    res.status(200).json({
      entries: await listFilterAuditEntries(db, req.query as ListAuditQuery),
    });
  } catch (err) {
    fail(res, 'GET /filter-selections/audit', err);
  }
};

export const getReference = async (req: Request, res: Response) => {
  const { planId } = req.query as ReferenceQuery;

  try {
    res.status(200).json(await getYnabReference(db, planId));
  } catch (err) {
    fail(res, 'GET /ynab/reference', err);
  }
};
