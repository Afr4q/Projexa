"use client";
import styles from "./login.module.css";
import { FaApple, FaGoogle, FaFacebook } from "react-icons/fa";
import { useState } from "react";

export default function GuideLogin() {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Add your login logic here
    setLoading(false);
  };

  return (
    <div className={styles.bg}>
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