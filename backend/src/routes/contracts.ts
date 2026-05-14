import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import db from '../db';
import type { Contract, ContractStatus } from '../types';

const router = Router();

const VALID_STATUSES: ContractStatus[] = ['draft', 'active', 'expired', 'terminated'];
const MAX_TEXT_LEN = 200;
const MAX_CONTENT_LEN = 100_000;

type ValidationResult =
  | { error: string }
  | { title: string; customer_name: string; status: ContractStatus; content: string };

/** Validate the four mutable contract fields for a POST (status/content have defaults). */
function validateCreate(body: Record<string, unknown>): ValidationResult {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const customer_name = typeof body.customer_name === 'string' ? body.customer_name.trim() : '';
  const status = (body.status as ContractStatus | undefined) ?? 'draft';
  const content = typeof body.content === 'string' ? body.content : '';

  if (!title) return { error: 'title is required and must be a non-empty string' };
  if (title.length > MAX_TEXT_LEN) return { error: `title must be at most ${MAX_TEXT_LEN} characters` };

  if (!customer_name) return { error: 'customer_name is required and must be a non-empty string' };
  if (customer_name.length > MAX_TEXT_LEN) return { error: `customer_name must be at most ${MAX_TEXT_LEN} characters` };

  if (!VALID_STATUSES.includes(status)) {
    return { error: `status must be one of: ${VALID_STATUSES.join(', ')}` };
  }

  if (content.length > MAX_CONTENT_LEN) {
    return { error: `content must be at most ${MAX_CONTENT_LEN} characters` };
  }

  return { title, customer_name, status, content };
}

/** Validate the four mutable contract fields for a PUT — all fields are required; no silent defaults. */
function validateUpdate(body: Record<string, unknown>): ValidationResult {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const customer_name = typeof body.customer_name === 'string' ? body.customer_name.trim() : '';

  if (!title) return { error: 'title is required and must be a non-empty string' };
  if (title.length > MAX_TEXT_LEN) return { error: `title must be at most ${MAX_TEXT_LEN} characters` };

  if (!customer_name) return { error: 'customer_name is required and must be a non-empty string' };
  if (customer_name.length > MAX_TEXT_LEN) return { error: `customer_name must be at most ${MAX_TEXT_LEN} characters` };

  // status is required in a PUT — no default fallback
  if (body.status === undefined || body.status === null) {
    return { error: 'status is required' };
  }
  const status = body.status as ContractStatus;
  if (!VALID_STATUSES.includes(status)) {
    return { error: `status must be one of: ${VALID_STATUSES.join(', ')}` };
  }

  // content is required in a PUT — must be explicitly provided (empty string is fine)
  if (body.content === undefined || body.content === null) {
    return { error: 'content is required' };
  }
  if (typeof body.content !== 'string') {
    return { error: 'content must be a string' };
  }
  if (body.content.length > MAX_CONTENT_LEN) {
    return { error: `content must be at most ${MAX_CONTENT_LEN} characters` };
  }

  return { title, customer_name, status, content: body.content };
}

// GET /api/contracts — list all contracts, newest first
router.get('/', (_req: Request, res: Response) => {
  const contracts = db
    .prepare('SELECT * FROM contracts ORDER BY created_at DESC')
    .all() as Contract[];
  res.json(contracts);
});

// POST /api/contracts — create a new contract
router.post('/', (req: Request, res: Response) => {
  const result = validateCreate(req.body as Record<string, unknown>);
  if ('error' in result) {
    res.status(400).json({ error: result.error });
    return;
  }

  const { title, customer_name, status, content } = result;
  const id = randomUUID();
  const created_at = new Date().toISOString();

  db.prepare(
    'INSERT INTO contracts (id, title, customer_name, status, created_at, content) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, title, customer_name, status, created_at, content);

  const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(id) as Contract;
  res.status(201).json(contract);
});

// GET /api/contracts/:id — get a single contract
router.get('/:id', (req: Request, res: Response) => {
  const contract = db
    .prepare('SELECT * FROM contracts WHERE id = ?')
    .get(req.params.id) as Contract | undefined;

  if (!contract) {
    res.status(404).json({ error: 'Contract not found' });
    return;
  }

  res.json(contract);
});

// PUT /api/contracts/:id — full update of mutable fields
router.put('/:id', (req: Request, res: Response) => {
  const existing = db
    .prepare('SELECT * FROM contracts WHERE id = ?')
    .get(req.params.id) as Contract | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Contract not found' });
    return;
  }

  const result = validateUpdate(req.body as Record<string, unknown>);
  if ('error' in result) {
    res.status(400).json({ error: result.error });
    return;
  }

  const { title, customer_name, status, content } = result;

  db.prepare(
    'UPDATE contracts SET title = ?, customer_name = ?, status = ?, content = ? WHERE id = ?'
  ).run(title, customer_name, status, content, req.params.id);

  const updated = db
    .prepare('SELECT * FROM contracts WHERE id = ?')
    .get(req.params.id) as Contract;
  res.json(updated);
});

// DELETE /api/contracts/:id — delete a contract
router.delete('/:id', (req: Request, res: Response) => {
  const existing = db
    .prepare('SELECT * FROM contracts WHERE id = ?')
    .get(req.params.id) as Contract | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Contract not found' });
    return;
  }

  db.prepare('DELETE FROM contracts WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

export default router;
