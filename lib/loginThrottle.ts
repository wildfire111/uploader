import "server-only";
import { pool } from "./db";

// caps how many login emails go out per address and overall
export const WINDOW_SECONDS = 10 * 60;
const MAX_LINKS_PER_EMAIL = 3;
const MAX_LINKS_TOTAL = 30;

// Counts the links sent in the window, including the current request, and says whether another
// may go out. Relies on the magic-link plugin storing {"email": ...} in the verification value.
export async function isLoginLinkAllowed(
  normalisedEmail: string
): Promise<{ allowed: boolean; forEmail: number; total: number }> {
  const result = await pool.query<{ for_email: string; total: string }>(
    `select
       count(*) filter (where lower(value::jsonb ->> 'email') = $1) as for_email,
       count(*) as total
     from verification
     where "createdAt" > now() - make_interval(secs => $2)`,
    [normalisedEmail, WINDOW_SECONDS]
  );
  const forEmail = Number(result.rows[0].for_email);
  const total = Number(result.rows[0].total);
  return {
    allowed: forEmail <= MAX_LINKS_PER_EMAIL && total <= MAX_LINKS_TOTAL,
    forEmail,
    total,
  };
}
