"use client";
import styles from "./login.module.css";
import { FaApple, FaGoogle, FaFacebook } from "react-icons/fa";
import { useState } from "react";
import { supabase } from "../../supabaseClient";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";

export default function GuideLogin() {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Query the users table for matching id, password, and guide role
    const { data, error } = await supabase
      .from("users")
      .select("uid, password, role")
      .eq("uid", id)
      .eq("password", password)
      .eq("role", "guide")
      .single();
    setLoading(false);
    if (error || !data) {
      toast.error("Login failed");
    } else {
      // Store user info in localStorage for session management
      localStorage.setItem('user', JSON.stringify({
        id: id,
        role: 'guide'
      }));
      toast.success("Login successful!");
      setTimeout(() => { window.location.href = "/guide/dashboard"; }, 1000);
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
              name="guide_id"
            />
            <input
              className={styles.input}
              type="password"
              placeholder="Password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              name="guide_password"
            />
            <button className={styles.button} type="submit" disabled={loading}>
              {loading ? <span style={{ display: 'inline-block', width: 18, height: 18, border: '3px solid #fff', borderTop: '3px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : "Login"}
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

<style jsx global>{`
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`}</style> 