import type { UserRole } from '@aven/contracts';

/**
 * Trusted identity attached only after token verification and a current
 * active-account lookup. Route authorization builds on this actor in Stage 026.
 */
export interface AuthenticatedActor {
  userId: string;
  role: UserRole;
  hospitalId: string | null;
}
