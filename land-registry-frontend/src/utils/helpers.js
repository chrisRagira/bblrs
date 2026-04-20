/** Format a number as Kenyan Shillings */
export const formatKES = (amount) =>
  amount > 0
    ? `KES ${Number(amount).toLocaleString("en-KE")}`
    : "—";

/** Truncate a blockchain hash/CID for display */
export const shortHash = (hash = "", len = 8) =>
  hash.length > len * 2 + 3
    ? `${hash.slice(0, len)}...${hash.slice(-len)}`
    : hash;

/** Format ISO date string → "15 Mar 2024" */
export const formatDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric", month: "short", year: "numeric",
  });
};

/** Get initials from a full name */
export const initials = (name = "") =>
  name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

/** Derive role-specific redirect after login */
export const homeRouteForRole = (role) => {
  switch (role) {
    case "REGISTRAR": return "/registrar/queue";
    case "ADMIN":     return "/admin/users";
    default:          return "/dashboard";
  }
};
