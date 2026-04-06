/**
 * After Supabase auth, send the user to the customer portal with their auth id.
 * (`auth.users.id` === `uid` query param for `/api/at/bundle`.)
 */
export function postAuthHref(userId: string): string {
  return `/at/profile?uid=${encodeURIComponent(userId)}`;
}
