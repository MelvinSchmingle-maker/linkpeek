/**
 * Removes a finished request from the in-flight map. The request succeeds or
 * fails, and either way its entry goes, but only if the entry is still this
 * request: a newer one for the same key may have replaced it.
 *
 * The rejection is handled here on purpose. Without that, a failed request
 * would also leave an unhandled rejection behind; its caller still sees the
 * error when it awaits the request.
 */
export function forget<T>(flights: Map<string, Promise<T>>, key: string, done: Promise<T>): void {
  const clear = () => {
    if (flights.get(key) === done) flights.delete(key);
  };
  done.then(clear, clear);
}
