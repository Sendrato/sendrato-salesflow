import { TRPCError } from "@trpc/server";
import type { User } from "../../drizzle/schema";

/** Return the user's allowed countries array, or null if unrestricted. */
export function getUserAllowedCountries(user: User | null): string[] | null {
  if (!user) return null;
  if (user.role === "admin") return null;
  return user.allowedCountries ?? null;
}

export function assertCountryAuthorized(
  user: User,
  country: string | undefined | null
) {
  const allowed = getUserAllowedCountries(user);
  if (!allowed) return;
  if (country && !allowed.includes(country)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Not authorized for this country",
    });
  }
}
