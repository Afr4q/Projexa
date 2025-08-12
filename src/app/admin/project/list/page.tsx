"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../../supabaseClient";
import toast, { Toaster } from "react-hot-toast";

interface Project {
  pid: string;
  title: string;
  description: string;
  group: boolean;
  sid: string | null;
  gid: string;
  status: string;
  gpid: string | null;
}

export default function ProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    gid: "",
    status: "incomplete"
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("pid");

      if (error) {
        toast.error("Failed to fetch projects: " + error.message);
      } else {
        setProjects(data || []);
      }
    } catch (error) {
      toast.error("Failed to fetch projects: " + error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "finished": return "#10b981";
      case "incomplete": return "#f59e0b";
      default: return "#f59e0b";
    }
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setEditForm({
      title: project.title,
      gid: project.gid,
      status: project.status
    });
  };

  const handleSaveEdit = async () => {
    if (!editingProject) return;

    try {
      const { error } = await supabase
        .from("projects")
        .update({
          title: editForm.title,
          gid: editForm.gid,
          status: editForm.status
        })
        .eq("pid", editingProject.pid);

      if (error) {
        toast.error("Failed to update project: " + error.message);
      } else {
        toast.success("Project updated successfully!");
        setEditingProject(null);
        fetchProjects(); // Refresh the list
      }
    } catch (error) {
      toast.error("Failed to update project: " + error);
    }
  };

  const handleCancelEdit = () => {
    setEditingProject(null);
    setEditForm({ title: "", gid: "", status: "incomplete" });
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#23272f" }}>
        <div style={{ color: "#fff", fontSize: "1.2rem" }}>Loading projects...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#23272f", padding: "20px", paddingTop: "80px" }}>
      <Toaster position="top-center" />
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <h1 style={{ color: "#fff", marginBottom: "30px", textAlign: "center" }}>Projects List</h1>
        
        {projects.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: "12px", padding: "40px", textAlign: "center" }}>
            <p style={{ color: "#666", fontSize: "1.1rem" }}>No projects found.</p>
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: "12px", overflow: "hidden", boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Project ID</th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Title</th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Description</th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Type</th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Student/Group</th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Guide ID</th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Status</th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project, index) => (
                    <tr key={project.pid} style={{ borderBottom: "1px solid #f1f5f9", background: index % 2 === 0 ? "#fff" : "#f8fafc" }}>
                      <td style={{ padding: "12px", color: "#1f2937", fontWeight: "500" }}>{project.pid}</td>
                      <td style={{ padding: "12px", color: "#1f2937" }}>{project.title}</td>
                      <td style={{ padding: "12px", color: "#1f2937" }}>
                        <div style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {project.description || "No description"}
                        </div>
                      </td>
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
                      <td style={{ padding: "12px", color: "#1f2937" }}>
                        {project.group ? project.gpid : project.sid}
                      </td>
                      <td style={{ padding: "12px", color: "#1f2937" }}>{project.gid}</td>
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
                      <td style={{ padding: "12px" }}>
                        <button
                          onClick={() => handleEdit(project)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "6px",
                            background: "#2563eb",
                            color: "#fff",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "0.75rem",
                            fontWeight: "500"
                          }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingProject && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: "#fff",
            borderRadius: "12px",
            padding: "24px",
            minWidth: "400px",
            maxWidth: "500px"
          }}>
            <h3 style={{ marginBottom: "20px", color: "#1f2937" }}>Edit Project: {editingProject.pid}</h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", color: "#374151" }}>Title:</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "14px" }}
                />
              </div>
              
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", color: "#374151" }}>Guide ID:</label>
                <input
                  type="text"
                  value={editForm.gid}
                  onChange={e => setEditForm({ ...editForm, gid: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "14px" }}
                />
              </div>
              
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", color: "#374151" }}>Status:</label>
                <select
                  value={editForm.status}
                  onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "14px" }}
                >
                  <option value="incomplete">Incomplete</option>
                  <option value="finished">Finished</option>
                </select>
              </div>
            </div>
            
            <div style={{ display: "flex", gap: "12px", marginTop: "24px", justifyContent: "flex-end" }}>
              <button
                onClick={handleCancelEdit}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  background: "#6b7280",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "14px"
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  background: "#2563eb",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "14px"
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 