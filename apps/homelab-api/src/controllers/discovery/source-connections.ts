import { pipeline } from 'node:stream/promises';
import * as discoveryService from '../../services/discovery';
import { actorOf } from '../../lib/actor';
import { handle } from './handle';
import type { Operation } from '../operation';
import type {
  PreviewQuery,
  SaveSourceConnectionBody,
  SourceIdParams,
} from '../../schemas/discovery';

// Does: show how a source's files are reached (never the password).
// Who: human (home-hud edit-source modal). No MCP tool.
export const getSourceConnectionOperation = {
  summary: 'Get a source’s connection',
  description:
    'Returns the connection type, username, domain and settings, and `hasPassword`. The password is never returned.',
  hud: '/exodus/sources',
} satisfies Operation;

export const getSourceConnection = handle(
  'GET /sources/:id/connection',
  async (req, res) => {
    const { id } = req.params as SourceIdParams;
    res.status(200).json(await discoveryService.getConnection(id));
  },
);

// Does: create or replace a source's connection.
// Who: human (home-hud edit-source modal). No MCP tool.
export const saveSourceConnectionOperation = {
  summary: 'Save a source’s connection',
  description:
    'Creates or replaces the connection. The password is encrypted before it is stored; omit it when editing to keep the stored one. Saving clears the last test result. Needs `EXODUS_CREDENTIAL_KEY` (503 otherwise).',
  hud: '/exodus/sources',
} satisfies Operation;

export const saveSourceConnection = handle(
  'PUT /sources/:id/connection',
  async (req, res) => {
    const { id } = req.params as SourceIdParams;
    const body = req.body as SaveSourceConnectionBody;
    res
      .status(200)
      .json(await discoveryService.saveConnection(id, body, actorOf(res)));
  },
);

// Does: remove a source's connection and its stored password.
// Who: human (home-hud edit-source modal). No MCP tool.
export const deleteSourceConnectionOperation = {
  summary: 'Delete a source’s connection',
  hud: '/exodus/sources',
} satisfies Operation;

export const deleteSourceConnection = handle(
  'DELETE /sources/:id/connection',
  async (req, res) => {
    const { id } = req.params as SourceIdParams;
    await discoveryService.deleteConnection(id, actorOf(res));
    res.status(204).end();
  },
);

// Does: check that the stored credentials can reach the source's files.
// Who: human (home-hud edit-source modal). No MCP tool.
export const testSourceConnectionOperation = {
  summary: 'Test a source’s connection',
  description:
    'Logs in with the stored credentials and lists each configured share, then records the result on the connection. A failed login is a `200` with `lastTestOk: false`.',
  hud: '/exodus/sources',
} satisfies Operation;

export const testSourceConnection = handle(
  'POST /sources/:id/connection/test',
  async (req, res) => {
    const { id } = req.params as SourceIdParams;
    res.status(200).json(await discoveryService.testConnection(id));
  },
);

// Does: stream one file of the source for an inline preview.
// Who: human (home-hud preview modal, through its /exodus/preview proxy). No MCP tool.
export const previewSourceFileOperation = {
  summary: 'Preview a file from a source',
  description:
    'Streams an image, PDF or text file over the source’s connection. Only paths discovery recorded for the source (inside an inventory item, or a skipped path) can be read. Text is returned as UTF-8 `text/plain`, cut at 1 MB with `X-Preview-Truncated: true`; other types are limited to 25 MB.',
  hud: '/exodus/inventory',
} satisfies Operation;

export const previewSourceFile = handle(
  'GET /sources/:id/preview',
  async (req, res) => {
    const { id } = req.params as SourceIdParams;
    const { path } = req.query as PreviewQuery;
    const preview = await discoveryService.openPreview(id, path);

    res.status(200);
    res.setHeader('Content-Type', preview.type.contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    // A PDF viewer will not run inside a sandboxed document.
    if (preview.type.kind !== 'pdf') {
      res.setHeader('Content-Security-Policy', 'sandbox');
    }

    if (Buffer.isBuffer(preview.body)) {
      if (preview.truncated) res.setHeader('X-Preview-Truncated', 'true');
      res.setHeader('Content-Length', preview.body.length);
      res.end(preview.body);
      return;
    }

    res.setHeader('Content-Length', preview.size);
    await pipeline(preview.body, res);
  },
);
