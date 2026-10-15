import type { AuthenticatedActor } from '../modules/auth/auth.types';

// Express Request type augmentation for Aven API
declare global {
  namespace Express {
    interface Request {
      id?: string;
      requestId?: string;
      actor?: AuthenticatedActor;
    }
  }
}

export {};
