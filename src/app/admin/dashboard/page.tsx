"use client";
import { useRouter } from "next/navigation";
import styles from "./dashboard.module.css";

export default function AdminDashboard() {
  const router = useRouter();
  return (
    <div className={styles.bg} style={{ paddingTop: "80px" }}>
      <div className={styles.cardSingle}>
        <div className={styles.left}>
          <h1 className={styles.headingBlack}>Admin Dashboard</h1>
          <button className={styles.button} onClick={() => router.push("/admin/user-registration")}>User Registration</button>
          <button className={styles.button} onClick={() => router.push("/admin/user-edit")}>Edit User</button>
          <button className={styles.button} onClick={() => router.push("/admin/project")}>Project</button>
          <button className={styles.button} onClick={() => router.push("/leaderboard")}>Show Leaderboard</button>
        </div>
      </div>
    </div>
  );
} 