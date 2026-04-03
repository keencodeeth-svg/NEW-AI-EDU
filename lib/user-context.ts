import { getCurrentUser, getUserById } from "./auth";

export async function getStudentContext() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role === "student") return user;
  if (user.role === "parent" && user.studentId) {
    const student = await getUserById(user.studentId);
    if (!student) return null;
    const { password, ...safeStudent } = student;
    return safeStudent as typeof user;
  }
  return null;
}
