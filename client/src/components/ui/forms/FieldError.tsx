export function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="form-error">{error}</p>;
}
