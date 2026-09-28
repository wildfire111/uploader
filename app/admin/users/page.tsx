import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  addAllowedUserAction,
  removeAllowedUserAction,
  toggleAdminAction,
} from "@/lib/actions/allowedUsers";
import { getCurrentUser } from "@/lib/auth";
import { listAllowedUsers } from "@/lib/queries/allowedUsers";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser(await headers());
  if (!user || !user.isAdmin) {
    redirect("/");
  }

  const users = await listAllowedUsers();
  const { error } = await searchParams;

  return (
    <main>
      <p>
        <Link href="/">&larr; Events</Link>
      </p>
      <div className="page-header">
        <h1>Users</h1>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Admin</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((allowedUser) => (
            <tr key={allowedUser.email}>
              <td>{allowedUser.email}</td>
              <td>{allowedUser.isAdmin ? "Yes" : "No"}</td>
              <td>
                {allowedUser.email === user.email ? (
                  <span>(you)</span>
                ) : (
                  <div className="button-row">
                    <form action={toggleAdminAction} className="form-inline">
                      <input type="hidden" name="email" value={allowedUser.email} />
                      <input type="hidden" name="isAdmin" value={String(allowedUser.isAdmin)} />
                      <button type="submit">
                        {allowedUser.isAdmin ? "Remove admin" : "Make admin"}
                      </button>
                    </form>
                    <form action={removeAllowedUserAction} className="form-inline">
                      <input type="hidden" name="email" value={allowedUser.email} />
                      <button type="submit" data-variant="danger">
                        Remove
                      </button>
                    </form>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {users.length === 0 ? (
            <tr>
              <td colSpan={3}>No whitelisted users yet.</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <h2>Add user</h2>
      <form action={addAllowedUserAction}>
        <label htmlFor="email">Email</label>
        <input type="email" id="email" name="email" required />
        <label className="checkbox-label">
          <input type="checkbox" name="isAdmin" /> Admin
        </label>
        <button type="submit" data-variant="primary">
          Add
        </button>
      </form>
    </main>
  );
}
