"use client";
import styles from "./login.module.css";
import { FaApple, FaGoogle, FaFacebook } from "react-icons/fa";
import { useState } from "react";
import { supabase } from "../../supabaseClient";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";

export default function StudentLogin() {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Query the users table for matching user_id, password, and student role
    const { data, error } = await supabase
      .from("users")
      .select("uid, name, password, email, role")
      .eq("uid", id)
      .eq("password", password)
      .eq("role", "student")
      .single();
    setLoading(false);
    if (error || !data) {
      alert("Login failed");
    } else {
      // Store user info in localStorage for session management
      localStorage.setItem('user', JSON.stringify({
        id: id,
        role: 'student'
      }));
      router.push("/student/welcome");
    }
  };

  return (
    <div className={styles.bg}>
      <Toaster position="top-center" />
      <div className={styles.cardSingle}>
        <div className={styles.left}>
          <form className={styles.form} onSubmit={handleSubmit} autoComplete="off">
            <input
              className={styles.input}
              type="text"
              placeholder="ID"
              required
              value={id}
              onChange={e => setId(e.target.value)}
              autoComplete="off"
              name="student_id"
            />
            <input
              className={styles.input}
              type="password"
              placeholder="Password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              name="student_password"
            />
            <button className={styles.button} type="submit" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
            <div className={styles.or}>or</div>
            <div className={styles.socials}>
              <button type="button" className={`${styles.social} ${styles.socialApple}`}><FaApple /></button>
              <button type="button" className={`${styles.social} ${styles.socialGoogle}`}><FaGoogle /></button>
              <button type="button" className={`${styles.social} ${styles.socialFacebook}`}><FaFacebook /></button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 