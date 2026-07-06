export function splitName(full: string): {
  firstName: string;
  lastName: string;
} {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  const firstName = parts.shift() ?? "";
  const lastName = parts.join(" ");
  return { firstName, lastName };
}

export function composeName(firstName: string, lastName: string): string {
  return [firstName, lastName]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" ");
}
