export function formatUnreadBadgeCount(count: number) {
  if (count <= 0) {
    return null;
  }

  return count > 99 ? "99+" : String(count);
}