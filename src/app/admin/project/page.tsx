"use client";
import { useRouter } from "next/navigation";

export default function ProjectPage() {
  const router = useRouter();
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#23272f", paddingTop: "80px" }}>
      <div style={{ background: "#fff", borderRadius: 24, padding: 40, minWidth: 320, maxWidth: 340, boxShadow: "0 4px 32px rgba(0,0,0,0.10)", display: "flex", flexDirection: "column", gap: 18, alignItems: "center" }}>
        <h2 style={{ color: "#23272f", marginBottom: 12 }}>Projects</h2>
        <button
          style={{ width: "100%", margin: 8, padding: 14, borderRadius: 24, background: "#2563eb", color: "#fff", fontWeight: 600, fontSize: 18, border: "none", cursor: "pointer", transition: "background 0.2s" }}
          onClick={() => router.push("/admin/project/list")}
        >
          Projects List
        </button>
        <button
          style={{ width: "100%", margin: 8, padding: 14, borderRadius: 24, background: "#2563eb", color: "#fff", fontWeight: 600, fontSize: 18, border: "none", cursor: "pointer", transition: "background 0.2s" }}
          onClick={() => router.push("/admin/project/registration")}
        >
          Project Registration
        </button>
      </div>
    </div>
  );
} 