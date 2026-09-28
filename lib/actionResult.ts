// expected errors are returned, not thrown: prod builds hide thrown messages from the browser
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionError(message: string): ActionResult<never> {
  return { ok: false, error: message };
}
