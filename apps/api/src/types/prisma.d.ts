// Ambient fallback declaration for @prisma/client until dependencies are installed & generated
declare module '@prisma/client' {
  export class PrismaClient {
    constructor(options?: unknown);
    $connect(): Promise<void>;
    $disconnect(): Promise<void>;
    $on(event: string, callback: (...args: unknown[]) => void): void;
    [key: string]: unknown;
  }
}
