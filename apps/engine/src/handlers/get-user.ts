export function getUserById(userId: string) {
  const user = users.get(userId);

  if (!user) {
    return;
  }

  return user;
}
