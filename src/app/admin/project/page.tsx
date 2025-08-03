"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProjectPage() {
  const router = useRouter();
  const [showNewProjectOptions, setShowNewProjectOptions] = useState(false);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#23272f" }}>
      <div style={{ background: "#fff", borderRadius: 24, padding: 40, minWidth: 320, boxShadow: "0 4px 32px rgba(0,0,0,0.10)", display: "flex", flexDirection: "column", gap: 18, alignItems: "center" }}>
        <h2 style={{ color: "#23272f", marginBottom: 12 }}>Projects</h2>
        <button
          style={{ width: "100%", margin: 8, padding: 14, borderRadius: 24, background: "#2563eb", color: "#fff", fontWeight: 600, fontSize: 18, border: "none", cursor: "pointer", transition: "background 0.2s" }}
          onClick={() => router.push("/admin/project/details")}
        >
          Show Project Details
        </button>
        <button
          style={{ width: "100%", margin: 8, padding: 14, borderRadius: 24, background: "#2563eb", color: "#fff", fontWeight: 600, fontSize: 18, border: "none", cursor: "pointer", transition: "background 0.2s" }}
          onClick={() => setShowNewProjectOptions(v => !v)}
        >
          New Project
        </button>
        {showNewProjectOptions && (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
            <button
              style={{ width: "100%", padding: 12, borderRadius: 20, background: "#1746a2", color: "#fff", fontWeight: 500, fontSize: 16, border: "none", cursor: "pointer", transition: "background 0.2s" }}
              onClick={() => router.push("/admin/project/individual")}
            >
              Individual Project
            </button>
            <button
              style={{ width: "100%", padding: 12, borderRadius: 20, background: "#1746a2", color: "#fff", fontWeight: 500, fontSize: 16, border: "none", cursor: "pointer", transition: "background 0.2s" }}
              onClick={() => router.push("/admin/project/group")}
            >
              Group Project
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 