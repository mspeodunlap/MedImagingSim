export const roles = ["student", "instructor", "admin"];

export function canUseWorkspace(user, workspace) {
  return Boolean(user && (user.role === "admin" || user.role === workspace));
}
