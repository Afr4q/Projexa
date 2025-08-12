"use client";
import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import toast, { Toaster } from "react-hot-toast";

interface Project {
  pid: string;
  title: string;
  status: string;
  group: boolean;
  sid: string | null;
  gpid: string | null;
}

interface User {
  uid: string;
  name: string;
  role: string;
}

export default function Leaderboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch projects
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .order("pid");

      if (projectError) {
        toast.error("Failed to fetch projects: " + projectError.message);
      } else {
        setProjects(projectData || []);
      }

      // Fetch users
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .order("uid");

      if (userError) {
        toast.error("Failed to fetch users: " + userError.message);
      } else {
        setUsers(userData || []);
      }
    } catch (error) {
      toast.error("Failed to fetch data: " + error);
    } finally {
      setLoading(false);
    }
  };

  const getUserName = (uid: string) => {
    const user = users.find(u => u.uid === uid);
    return user ? user.name : uid;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "finished": return "#10b981";
      case "incomplete": return "#f59e0b";
      default: return "#6b7280";
    }
  };

  const getProjectScore = (project: Project) => {
    switch (project.status) {
      case "finished": return 100;
      case "incomplete": return 50;
      default: return 0;
    }
  };

  const getRankedProjects = () => {
    return projects
      .map(project => ({
        ...project,
        score: getProjectScore(project),
        participantName: project.group 
          ? `Group: ${project.gpid}` 
          : getUserName(project.sid || "")
      }))
      .sort((a, b) => b.score - a.score);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#23272f" }}>
        <div style={{ color: "#fff", fontSize: "1.2rem" }}>Loading leaderboard...</div>
      </div>
    );
  }

  const rankedProjects = getRankedProjects();

  return (
    <div style={{ minHeight: "100vh", background: "#23272f", padding: "20px", paddingTop: "80px" }}>
      <Toaster position="top-center" />
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <h1 style={{ color: "#fff", marginBottom: "30px", textAlign: "center" }}>Project Leaderboard</h1>
        
        {rankedProjects.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: "12px", padding: "40px", textAlign: "center" }}>
            <p style={{ color: "#666", fontSize: "1.1rem" }}>No projects found.</p>
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: "12px", overflow: "hidden", boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Rank</th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Project</th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Participant</th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Type</th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Status</th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedProjects.map((project, index) => (
                    <tr key={project.pid} style={{ 
                      borderBottom: "1px solid #f1f5f9", 
                      background: index % 2 === 0 ? "#fff" : "#f8fafc",
                      ...(index < 3 && { background: index === 0 ? "#fef3c7" : index === 1 ? "#f3f4f6" : "#fef2f2" })
                    }}>
                      <td style={{ padding: "12px", color: "#1f2937", fontWeight: "600" }}>
                        {index === 0 && "🥇"}
                        {index === 1 && "🥈"}
                        {index === 2 && "🥉"}
                        {index > 2 && `#${index + 1}`}
                      </td>
                      <td style={{ padding: "12px", color: "#1f2937", fontWeight: "500" }}>{project.title}</td>
                      <td style={{ padding: "12px", color: "#1f2937" }}>{project.participantName}</td>
                      <td style={{ padding: "12px" }}>
                        <span style={{ 
                          padding: "4px 8px", 
                          borderRadius: "12px", 
                          fontSize: "0.75rem", 
                          fontWeight: "500",
                          background: project.group ? "#dbeafe" : "#fef3c7",
                          color: project.group ? "#1e40af" : "#92400e"
                        }}>
                          {project.group ? "Group" : "Individual"}
                        </span>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <span style={{ 
                          padding: "4px 8px", 
                          borderRadius: "12px", 
                          fontSize: "0.75rem", 
                          fontWeight: "500",
                          background: `${getStatusColor(project.status)}20`,
                          color: getStatusColor(project.status)
                        }}>
                          {project.status}
                        </span>
                      </td>
                      <td style={{ padding: "12px", color: "#1f2937", fontWeight: "600" }}>
                        {project.score}/100
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Statistics */}
        <div style={{ marginTop: "20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "8px", padding: "16px", textAlign: "center" }}>
            <h3 style={{ color: "#1f2937", marginBottom: "8px" }}>Total Projects</h3>
            <p style={{ color: "#2563eb", fontSize: "1.5rem", fontWeight: "600" }}>{projects.length}</p>
          </div>
          <div style={{ background: "#fff", borderRadius: "8px", padding: "16px", textAlign: "center" }}>
            <h3 style={{ color: "#1f2937", marginBottom: "8px" }}>Completed</h3>
            <p style={{ color: "#10b981", fontSize: "1.5rem", fontWeight: "600" }}>
              {projects.filter(p => p.status === "finished").length}
            </p>
          </div>
          <div style={{ background: "#fff", borderRadius: "8px", padding: "16px", textAlign: "center" }}>
            <h3 style={{ color: "#1f2937", marginBottom: "8px" }}>In Progress</h3>
            <p style={{ color: "#f59e0b", fontSize: "1.5rem", fontWeight: "600" }}>
              {projects.filter(p => p.status === "incomplete").length}
            </p>
          </div>
          <div style={{ background: "#fff", borderRadius: "8px", padding: "16px", textAlign: "center" }}>
            <h3 style={{ color: "#1f2937", marginBottom: "8px" }}>Completion Rate</h3>
            <p style={{ color: "#2563eb", fontSize: "1.5rem", fontWeight: "600" }}>
              {projects.length > 0 ? Math.round((projects.filter(p => p.status === "finished").length / projects.length) * 100) : 0}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 