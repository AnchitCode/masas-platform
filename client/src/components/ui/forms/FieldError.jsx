export function FieldError({ error }) {
  if (!error) return null;
  return <p className="form-error">{error}</p>;
}
