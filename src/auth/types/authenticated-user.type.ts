import { UserRole } from '@prisma/client';

export type AuthenticatedUser = {
  id: string;
  companyId: string;
  name: string;
  email: string;
  role: UserRole;
};

export type JwtPayload = {
  sub: string;
  companyId: string;
  name: string;
  email: string;
  role: UserRole;
};
