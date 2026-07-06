import type { User } from "@workspace/db";

/** Map a DB user row to the public API User shape. */
export function toApiUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    startDate: user.startDate,
    active: user.active,
    annualEntitlement: user.annualEntitlement,
    sickEntitlement: user.sickEntitlement,
    balanceAdjustment: user.balanceAdjustment,
    profileComplete: user.nameManuallySet,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
