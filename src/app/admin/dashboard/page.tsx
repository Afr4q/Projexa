"use client";
import styles from "./dashboard.module.css";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const router = useRouter();
  return (
    <div className={styles.bg}>
      <div className={styles.cardSingle}>
        <div className={styles.left}>
          <h1 className={styles.headingBlack}>Admin Dashboard</h1>
          <button className={styles.button} onClick={() => router.push("/admin/student-registration")}>Student Registration</button>
          <button className={styles.button} onClick={() => router.push("/admin/project")}>Project</button>
          <button className={styles.button} onClick={() => router.push("/admin/guide-registration")}>Guide Registration</button>
          <button className={styles.button} onClick={() => router.push("/admin/leaderboard")}>Show Leaderboard</button>
        </div>
      </div>
    </div>
  );
} 