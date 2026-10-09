// Express Request type augmentation for Aven API
declare global {
  namespace Express {
    interface Request {
      id?: string;
      requestId?: string;
    }
  }
}

export {};
