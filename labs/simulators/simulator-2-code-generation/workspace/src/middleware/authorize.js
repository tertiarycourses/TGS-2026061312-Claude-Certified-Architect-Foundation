// Homegrown authorization: role lists hard-coded per permission.
const ROLES = {
  "orders:read": ["admin", "support", "customer"],
  "orders:refund": ["admin", "support"],
  "users:delete": ["admin"],
};

export function authorize(user, permission) {
  if (!user) return false;
  return (ROLES[permission] || []).includes(user.role);
}
