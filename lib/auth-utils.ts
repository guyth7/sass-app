import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/**
 * Protect a page/route by requiring authentication
 * Returns user data if authenticated, otherwise redirects to sign-in
 *
 * Usage in a Server Component or page.tsx:
 * const user = await requireAuth();
 */
export async function requireAuth() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return { userId };
}

/**
 * Check if user is authenticated without redirecting
 * Returns null if not authenticated
 *
 * Usage:
 * const user = await checkAuth();
 * if (!user) {
 *   // User is not authenticated
 * }
 */
export async function checkAuth() {
  try {
    const { userId } = await auth();
    return userId ? { userId } : null;
  } catch {
    return null;
  }
}

/**
 * Get current authenticated user
 * Returns null if not authenticated
 */
export async function getCurrentUser() {
  try {
    const { userId } = await auth();
    if (!userId) return null;

    // You can extend this to fetch additional user data from Supabase if needed
    return { userId };
  } catch {
    return null;
  }
}
