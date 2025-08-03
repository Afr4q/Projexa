"use client";
import { useState } from "react";
import { supabase } from "../../../supabaseClient";

export default function IndividualProject() {
  const [studentId, setStudentId] = useState("");
  const [guideId, setGuideId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const { error } = await supabase
      .from("individual_projects")
      .insert([{ student_id: studentId, guide_id: guideId }]);
    setLoading(false);
    if (error) {
      setMessage("Registration failed: " + error.message);
    } else {
      setMessage("Individual project registered successfully!");
      setStudentId("");
      setGuideId("");
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#23272f" }}>
      <form onSubmit={handleSubmit} style={{ background: "#fff", borderRadius: 24, padding: 40, minWidth: 320, boxShadow: "0 4px 32px rgba(0,0,0,0.10)", display: "flex", flexDirection: "column", gap: 18 }}>
        <h2 style={{ color: "#23272f", marginBottom: 12 }}>Register Individual Project</h2>
        <input
          type="text"
          placeholder="Student ID"
          value={studentId}
          onChange={e => setStudentId(e.target.value)}
          required
          style={{ padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 16 }}
        />
        <input
          type="text"
          placeholder="Guide ID"
          value={guideId}
          onChange={e => setGuideId(e.target.value)}
          required
          style={{ padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 16 }}
        />
        <button type="submit" disabled={loading} style={{ marginTop: 10, padding: 14, borderRadius: 24, background: "#2563eb", color: "#fff", fontWeight: 600, fontSize: 18, border: "none", cursor: "pointer", transition: "background 0.2s" }}>
          {loading ? "Registering..." : "Register"}
        </button>
        {message && <div style={{ marginTop: 12, color: message.includes("successfully") ? "green" : "red" }}>{message}</div>}
      </form>
    </div>
  );
} 