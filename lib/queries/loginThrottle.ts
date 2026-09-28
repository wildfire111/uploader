import "server-only";
import { pool } from "../db";

// relies on the magic-link plugin storing {"email": ...} in value
export async function countRecentLoginLinks(
  normalisedEmail: string,
  withinSeconds: number
): Promise<{ forEmail: number; total: number }> {
  const result = await pool.query<{ for_email: string; total: string }>(
    `select
       count(*) filter (where lower(value::jsonb ->> 'email') = $1) as for_email,
       count(*) as total
     from verification
     where "createdAt" > now() - make_interval(secs => $2)`,
    [normalisedEmail, withinSeconds]
  );
  return {
    forEmail: Number(result.rows[0].for_email),
    total: Number(result.rows[0].total),
  };
}
