"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../supabaseClient";
import toast, { Toaster } from "react-hot-toast";

interface Project {
  pid: string;
  title: string;
  description: string;
  status: string;
  gid: string;
  sid: string | null;
  gpid: string | null;
  group: boolean;
}

interface Submission {
  subid: number;
  pid: string;
  phase: number;
  file_url: string;
  submitted_at: string;
  status: string;
  comment: string | null;
}

interface Phase {
  id: number;
  phase: string;
  deadline: string;
}

interface User {
  uid: string;
  name: string;
  role: string;
  email: string;
}

interface Notification {
  id: number;
  user_id: string;
  message: string;
  type: string;
  created_at: string;
  read: boolean;
}

export default function GuideDashboard() {
  const router = useRouter();
  const [assignedProjects, setAssignedProjects] = useState<Project[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [comment, setComment] = useState("");
  const [score, setScore] = useState("");
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [currentFileUrl, setCurrentFileUrl] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Get current user from localStorage
      const user = localStorage.getItem('user');
      if (!user) {
        router.push('/guide/login');
        return;
      }
      const userData = JSON.parse(user);

      // Fetch assigned projects (where guide ID matches current user)
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("gid", userData.id);

      if (projectError) {
        toast.error("Failed to fetch projects: " + projectError.message);
      } else {
        setAssignedProjects(projectData || []);
      }

      // Fetch submissions for assigned projects
      if (projectData && projectData.length > 0) {
        const projectIds = projectData.map(p => p.pid);
        const { data: submissionData, error: submissionError } = await supabase
          .from("submissions")
          .select("*")
          .in("pid", projectIds)
          .order("submitted_at", { ascending: false });

        if (submissionError) {
          toast.error("Failed to fetch submissions: " + submissionError.message);
        } else {
          setSubmissions(submissionData || []);
        }
      }

      // Fetch phases
      const { data: phaseData, error: phaseError } = await supabase
        .from("phases")
        .select("*")
        .order("id");

      if (phaseError) {
        toast.error("Failed to fetch phases: " + phaseError.message);
      } else {
        setPhases(phaseData || []);
      }

      // Fetch users
      const { data: allUsersData, error: userError } = await supabase
        .from("users")
        .select("*")
        .order("uid");

      if (userError) {
        toast.error("Failed to fetch users: " + userError.message);
      } else {
        setUsers(allUsersData || []);
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

  const getUserEmail = (uid: string) => {
    const user = users.find(u => u.uid === uid);
    return user ? user.email : "";
  };

  const getPhaseName = (phaseId: number) => {
    const phase = phases.find(p => p.id === phaseId);
    return phase ? phase.phase : `Phase ${phaseId}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "#10b981";
      case "rejected": return "#ef4444";
      case "pending": return "#f59e0b";
      default: return "#6b7280";
    }
  };

  const createNotification = async (userId: string, message: string, type: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .insert([{
          user_id: userId,
          message: message,
          type: type,
          read: false
        }]);

      if (error) {
        console.error("Failed to create notification:", error);
      }
    } catch (error) {
      console.error("Error creating notification:", error);
    }
  };

  const handleFileView = (fileUrl: string) => {
    setCurrentFileUrl(fileUrl);
    setFileViewerOpen(true);
  };

  const handleSubmissionAction = async (submissionId: number, action: string) => {
    try {
      const submission = submissions.find(s => s.subid === submissionId);
      if (!submission) return;

      // Find the project to get student ID
      const project = assignedProjects.find(p => p.pid === submission.pid);
      if (!project) return;

      const studentId = project.sid;
      if (!studentId) return;

      const updateData: any = { status: action };
      
      if (comment.trim()) {
        updateData.comment = comment;
      }

      if (score.trim()) {
        updateData.score = parseInt(score);
      }

      const { error } = await supabase
        .from("submissions")
        .update(updateData)
        .eq("subid", submissionId);

      if (error) {
        toast.error(`Failed to ${action} submission: ` + error.message);
      } else {
        // Create notification for student
        const actionText = action === "approved" ? "approved" : "rejected";
        const message = `Your submission for project ${submission.pid} (${getPhaseName(submission.phase)}) has been ${actionText}. ${comment.trim() ? `Comment: ${comment}` : ""}`;
        
        await createNotification(studentId, message, action);

        toast.success(`Submission ${action} successfully! Student has been notified.`);
        setSelectedSubmission(null);
        setComment("");
        setScore("");
        fetchData(); // Refresh data
      }
    } catch (error) {
      toast.error(`Failed to ${action} submission: ` + error);
    }
  };

  const deleteSubmission = async (submissionId: number) => {
    try {
      const { error } = await supabase
        .from("submissions")
        .delete()
        .eq("subid", submissionId);

      if (error) {
        toast.error("Failed to delete submission: " + error.message);
      } else {
        toast.success("Submission deleted successfully!");
        setSelectedSubmission(null);
        setComment("");
        setScore("");
        fetchData(); // Refresh data
      }
    } catch (error) {
      toast.error("Failed to delete submission: " + error);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#23272f", paddingTop: "100px" }}>
        <div style={{ color: "#fff", fontSize: "1.2rem" }}>Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#23272f", padding: "20px", paddingTop: "80px" }}>
      <Toaster position="top-center" />
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <h1 style={{ color: "#fff", marginBottom: "30px", textAlign: "center" }}>Guide Dashboard</h1>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
          {/* Assigned Projects */}
          <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)" }}>
            <h2 style={{ color: "#1f2937", marginBottom: "16px" }}>Assigned Projects</h2>
            {assignedProjects.length === 0 ? (
              <p style={{ color: "#666" }}>No projects assigned yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {assignedProjects.map(project => (
                  <div key={project.pid} style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px" }}>
                    <h3 style={{ color: "#1f2937", marginBottom: "4px" }}>{project.title}</h3>
                    <p style={{ color: "#6b7280", fontSize: "0.9rem", marginBottom: "8px" }}>{project.description}</p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
                      <span style={{ color: "#6b7280", fontSize: "0.9rem" }}>
                        {project.group ? `Group: ${project.gpid}` : `Student: ${getUserName(project.sid || "")}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submissions */}
          <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)" }}>
            <h2 style={{ color: "#1f2937", marginBottom: "16px" }}>Recent Submissions</h2>
            {submissions.length === 0 ? (
              <p style={{ color: "#666" }}>No submissions yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {submissions.slice(0, 5).map(submission => (
                  <div key={submission.subid} style={{ 
                    border: "1px solid #e5e7eb", 
                    borderRadius: "8px", 
                    padding: "12px",
                    cursor: "pointer"
                  }}
                  onClick={() => setSelectedSubmission(submission)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <span style={{ color: "#1f2937", fontWeight: "500" }}>Project: {submission.pid}</span>
                      <span style={{ 
                        padding: "4px 8px", 
                        borderRadius: "12px", 
                        fontSize: "0.75rem", 
                        fontWeight: "500",
                        background: `${getStatusColor(submission.status)}20`,
                        color: getStatusColor(submission.status)
                      }}>
                        {submission.status}
                      </span>
                    </div>
                    <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>
                      Phase: {getPhaseName(submission.phase)}
                    </p>
                    <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>
                      Submitted: {new Date(submission.submitted_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submission Review Modal */}
        {selectedSubmission && (
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
              minWidth: "500px",
              maxWidth: "600px",
              maxHeight: "80vh",
              overflowY: "auto"
            }}>
              <h3 style={{ marginBottom: "20px", color: "#1f2937" }}>Review Submission</h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", color: "#374151", fontWeight: "500" }}>Project ID:</label>
                  <p style={{ color: "#1f2937" }}>{selectedSubmission.pid}</p>
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", color: "#374151", fontWeight: "500" }}>Phase:</label>
                  <p style={{ color: "#1f2937" }}>{getPhaseName(selectedSubmission.phase)}</p>
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", color: "#374151", fontWeight: "500" }}>Submitted:</label>
                  <p style={{ color: "#1f2937" }}>{new Date(selectedSubmission.submitted_at).toLocaleString()}</p>
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", color: "#374151", fontWeight: "500" }}>File:</label>
                  <button
                    onClick={() => handleFileView(selectedSubmission.file_url)}
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
                    View Submission
                  </button>
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", color: "#374151", fontWeight: "500" }}>Comment:</label>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Add your feedback..."
                    rows={3}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "14px", resize: "vertical" }}
                  />
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", color: "#374151", fontWeight: "500" }}>Score (optional):</label>
                  <input
                    type="number"
                    value={score}
                    onChange={e => setScore(e.target.value)}
                    placeholder="Enter score (0-100)"
                    min="0"
                    max="100"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "14px" }}
                  />
                </div>
              </div>
              
              <div style={{ display: "flex", gap: "12px", marginTop: "24px", justifyContent: "flex-end" }}>
                <button
                  onClick={() => {
                    setSelectedSubmission(null);
                    setComment("");
                    setScore("");
                  }}
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
                  onClick={() => handleSubmissionAction(selectedSubmission.subid, "rejected")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    background: "#ef4444",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "14px"
                  }}
                >
                  Reject
                </button>
                <button
                  onClick={() => handleSubmissionAction(selectedSubmission.subid, "approved")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    background: "#10b981",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "14px"
                  }}
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        )}

        {/* File Viewer Modal */}
        {fileViewerOpen && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000
          }}>
            <div style={{
              position: "relative",
              maxWidth: "90vw",
              maxHeight: "90vh",
              background: "#fff",
              borderRadius: "12px",
              overflow: "hidden"
            }}>
              <button
                onClick={() => setFileViewerOpen(false)}
                style={{
                  position: "absolute",
                  top: "10px",
                  right: "10px",
                  background: "rgba(0, 0, 0, 0.7)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "50%",
                  width: "30px",
                  height: "30px",
                  cursor: "pointer",
                  zIndex: 10
                }}
              >
                ×
              </button>
              
              {currentFileUrl.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={currentFileUrl}
                  style={{ width: "100%", height: "80vh", border: "none" }}
                  title="PDF Viewer"
                />
              ) : currentFileUrl.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp)$/) ? (
                <img
                  src={currentFileUrl}
                  alt="Submission file"
                  style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain" }}
                />
              ) : (
                <div style={{ padding: "40px", textAlign: "center" }}>
                  <p style={{ marginBottom: "20px" }}>File preview not available for this file type.</p>
                  <a
                    href={currentFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: "10px 20px",
                      background: "#2563eb",
                      color: "#fff",
                      textDecoration: "none",
                      borderRadius: "6px"
                    }}
                  >
                    Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 