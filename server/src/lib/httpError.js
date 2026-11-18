// An error that knows which HTTP status code it should produce.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Supabase returns { data, error }. This turns a database error into an
// HttpError with a sensible status, and otherwise hands back the data.
const DATABASE_ERRORS = {
  23503: [404, 'A referenced item does not exist'], // foreign key (e.g. unknown song)
  23505: [409, 'That already exists'], // duplicate
  23514: [400, 'The data did not pass a database check'],
  '22P02': [400, 'Invalid identifier'],
  42501: [403, 'Not allowed'],
  PGRST116: [404, 'Not found'],
};

export function unwrap({ data, error }, overrides = {}) {
  if (!error) return data;
  const [status, message] = overrides[error.code] ?? DATABASE_ERRORS[error.code] ?? [502, 'The database could not complete the request'];
  if (status >= 500) console.error('Database error:', error.code, error.message);
  throw new HttpError(status, message);
}
