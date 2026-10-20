import {
  FinalizeDocumentUploadSchema,
  InitiateDocumentUploadSchema,
  UuidSchema,
} from '@aven/contracts';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { authenticate } from '../auth/auth.middleware';
import { sendCreated, sendSuccess } from '../../utils/response';
import { ValidationError } from '../../errors/app-error';
import {
  finalizeUpload,
  getDocumentDownload,
  initiateUpload,
  listDocuments,
} from './document.service';

export const documentRouter = Router({ mergeParams: true });
documentRouter.use(authenticate);

documentRouter.post('/uploads', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const claimId = UuidSchema.parse(req.params.claimId);
    const result = await initiateUpload(
      req.actor!,
      claimId,
      InitiateDocumentUploadSchema.parse(req.body),
    );
    res.setHeader('Cache-Control', 'no-store');
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

documentRouter.post(
  '/uploads/finalize',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const claimId = UuidSchema.parse(req.params.claimId);
      const { uploadToken } = FinalizeDocumentUploadSchema.parse(req.body);
      const document = await finalizeUpload(req.actor!, claimId, uploadToken);
      res.setHeader('Cache-Control', 'no-store');
      sendCreated(res, document);
    } catch (error) {
      next(error);
    }
  },
);

documentRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const documents = await listDocuments(req.actor!, UuidSchema.parse(req.params.claimId));
    res.setHeader('Cache-Control', 'no-store');
    sendSuccess(res, documents);
  } catch (error) {
    next(error);
  }
});

documentRouter.get(
  '/:documentId/versions/:version/download',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const claimId = UuidSchema.parse(req.params.claimId);
      const documentId = UuidSchema.parse(req.params.documentId);
      const version = Number(req.params.version);
      if (!Number.isSafeInteger(version) || version < 1)
        throw new ValidationError('Invalid document version.');
      const result = await getDocumentDownload(req.actor!, claimId, documentId, version);
      res.setHeader('Cache-Control', 'no-store');
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },
);
