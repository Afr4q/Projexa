"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../supabaseClient";
import toast, { Toaster } from "react-hot-toast";

export default function StudentRegistration() {
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase
      .from("students")
      .insert([{ name, id, password }]);
    setLoading(false);
    if (error) {
      toast.error("Registration failed: " + error.message);
    } else {
      toast.success("Student registered successfully!");
      setName("");
      setId("");
      setPassword("");
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#23272f" }}>
      <Toaster position="top-center" />
      <form onSubmit={handleSubmit} style={{ background: "#fff", borderRadius: 24, padding: 40, minWidth: 320, boxShadow: "0 4px 32px rgba(0,0,0,0.10)", display: "flex", flexDirection: "column", gap: 18 }}>
        <h2 style={{ color: "#23272f", marginBottom: 12 }}>Register Student</h2>
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          style={{ padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 16 }}
        />
        <input
          type="text"
          placeholder="ID"
          value={id}
          onChange={e => setId(e.target.value)}
          required
          style={{ padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 16 }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          style={{ padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 16 }}
        />
        <button type="submit" disabled={loading} style={{ marginTop: 10, padding: 14, borderRadius: 24, background: "#2563eb", color: "#fff", fontWeight: 600, fontSize: 18, border: "none", cursor: "pointer", transition: "background 0.2s", opacity: loading ? 0.7 : 1 }}>
          {loading ? <span style={{ display: 'inline-block', width: 18, height: 18, border: '3px solid #fff', borderTop: '3px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : "Register"}
        </button>
      </form>
    </div>
  );
}

<style jsx global>{`
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`}</style> 