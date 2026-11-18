// Checks one part of a request ("body", "query" or "params") against a schema.
// Valid, cleaned data is placed on req.valid; invalid requests get a 400 reply.
export function validate(part, schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req[part] ?? {});
    if (!result.success) {
      return res.status(400).json({
        error: {
          message: 'Invalid request',
          details: result.error.issues.map((issue) => ({
            field: issue.path.join('.') || part,
            message: issue.message,
          })),
        },
      });
    }
    req.valid = { ...req.valid, [part]: result.data };
    next();
  };
}
