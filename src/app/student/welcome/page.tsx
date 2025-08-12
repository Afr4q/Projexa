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
}

interface Phase {
  id: number;
  phase: string;
  deadline: string;
}

interface Notification {
  id: number;
  user_id: string;
  message: string;
  type: string;
  created_at: string;
  read: boolean;
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

export default function StudentDashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Get current user from localStorage
      const user = localStorage.getItem('user');
      if (!user) {
        router.push('/student/login');
        return;
      }
      const userData = JSON.parse(user);

      // Fetch user's projects
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .or(`sid.eq.${userData.id},gpid.in.(${userData.id})`);

      if (projectError) {
        toast.error("Failed to fetch projects: " + projectError.message);
      } else {
        setProjects(projectData || []);
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

      // Fetch notifications for current user
      const { data: notificationData, error: notificationError } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userData.id)
        .order("created_at", { ascending: false });

      if (notificationError) {
        toast.error("Failed to fetch notifications: " + notificationError.message);
      } else {
        setNotifications(notificationData || []);
      }

      // Fetch user's submissions
      const { data: submissionData, error: submissionError } = await supabase
        .from("submissions")
        .select("*")
        .or(`pid.in.(${projectData?.map(p => p.pid).join(',') || ''})`)
        .order("submitted_at", { ascending: false });

      if (submissionError) {
        toast.error("Failed to fetch submissions: " + submissionError.message);
      } else {
        setSubmissions(submissionData || []);
      }
    } catch (error) {
      toast.error("Failed to fetch data: " + error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file to upload");
      return;
    }

    if (!selectedPhase) {
      toast.error("Please select a phase");
      return;
    }

    if (projects.length === 0) {
      toast.error("No projects assigned");
      return;
    }

    setUploading(true);
    
    try {
      // Simulate file upload to get a URL
      const fileUrl = `https://example.com/uploads/${selectedFile.name}`;
      
      // Get current user
      const user = localStorage.getItem('user');
      const userData = JSON.parse(user || '{}');
      
      // Find the project for this user
      const userProject = projects.find(p => 
        p.sid === userData.id || p.gpid === userData.id
      );

      if (!userProject) {
        toast.error("No project found for this user");
        setUploading(false);
        return;
      }

      // Insert submission into database
      const { error } = await supabase
        .from("submissions")
        .insert([{
          pid: userProject.pid,
          phase: selectedPhase,
          file_url: fileUrl,
          submitted_at: new Date().toISOString(),
          status: "pending"
        }]);

      if (error) {
        toast.error("Failed to submit: " + error.message);
      } else {
        toast.success("Submission uploaded successfully!");
        setSelectedFile(null);
        setSelectedPhase(null);
      }
    } catch (error) {
      toast.error("Upload failed: " + error);
    } finally {
      setUploading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "#10b981";
      case "rejected": return "#ef4444";
      case "pending": return "#f59e0b";
      default: return "#6b7280";
    }
  };

  const getUpcomingDeadlines = () => {
    const now = new Date();
    return phases.filter(phase => {
      const deadline = new Date(phase.deadline);
      const diffTime = deadline.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 && diffDays <= 7; // Within 7 days
    });
  };

  const markNotificationAsRead = async (notificationId: number) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);

      if (error) {
        console.error("Failed to mark notification as read:", error);
      } else {
        // Update local state
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
        );
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    setSelectedNotification(notification);
    setShowNotificationModal(true);
    
    // Mark as read if not already read
    if (!notification.read) {
      markNotificationAsRead(notification.id);
    }
  };

  const handleDeleteRejectedSubmission = async (submissionId: number) => {
    try {
      const { error } = await supabase
        .from("submissions")
        .delete()
        .eq("subid", submissionId);

      if (error) {
        toast.error("Failed to delete submission: " + error.message);
      } else {
        toast.success("Rejected submission deleted successfully!");
        setShowNotificationModal(false);
        setSelectedNotification(null);
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
        <h1 style={{ color: "#fff", marginBottom: "30px", textAlign: "center" }}>Student Dashboard</h1>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
          {/* Project Details */}
          <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)" }}>
            <h2 style={{ color: "#1f2937", marginBottom: "16px" }}>My Projects</h2>
            {projects.length === 0 ? (
              <p style={{ color: "#666" }}>No projects assigned yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {projects.map(project => (
                  <div key={project.pid} style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px" }}>
                    <h3 style={{ color: "#1f2937", marginBottom: "4px" }}>{project.title}</h3>
                    <p style={{ color: "#6b7280", fontSize: "0.9rem", marginBottom: "8px" }}>{project.description}</p>
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
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Project Phases */}
          <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)" }}>
            <h2 style={{ color: "#1f2937", marginBottom: "16px" }}>Project Phases</h2>
            {phases.length === 0 ? (
              <p style={{ color: "#666" }}>No phases defined.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {phases.map(phase => (
                  <div key={phase.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
                    <span style={{ color: "#1f2937", fontWeight: "500" }}>{phase.phase}</span>
                    <span style={{ color: "#6b7280", fontSize: "0.9rem" }}>
                      {new Date(phase.deadline).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
          {/* Upload Section */}
          <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)" }}>
            <h2 style={{ color: "#1f2937", marginBottom: "16px" }}>Upload Work</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <select
                value={selectedPhase || ""}
                onChange={e => setSelectedPhase(Number(e.target.value))}
                style={{ padding: "8px", border: "1px solid #d1d5db", borderRadius: "6px" }}
              >
                <option value="">Select Phase</option>
                {phases.map(phase => (
                  <option key={phase.id} value={phase.id}>{phase.phase}</option>
                ))}
              </select>
              
              <input
                type="file"
                onChange={handleFileSelect}
                style={{ padding: "8px", border: "1px solid #d1d5db", borderRadius: "6px" }}
              />
              
              <button
                onClick={handleUpload}
                disabled={!selectedFile || !selectedPhase || uploading}
                style={{
                  padding: "10px 16px",
                  borderRadius: "6px",
                  background: (selectedFile && selectedPhase) ? "#2563eb" : "#9ca3af",
                  color: "#fff",
                  border: "none",
                  cursor: (selectedFile && selectedPhase) ? "pointer" : "not-allowed",
                  fontSize: "14px",
                  fontWeight: "500"
                }}
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
              
              {selectedFile && (
                <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>
          </div>

          {/* Notifications */}
          <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)" }}>
            <h2 style={{ color: "#1f2937", marginBottom: "16px" }}>Notifications</h2>
            {notifications.length === 0 ? (
              <p style={{ color: "#666" }}>No notifications.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {notifications.slice(0, 5).map(notification => (
                  <div 
                    key={notification.id} 
                    style={{ 
                      padding: "8px 12px", 
                      background: notification.read ? "#f9fafb" : "#eff6ff", 
                      border: "1px solid #d1d5db", 
                      borderRadius: "6px",
                      cursor: "pointer",
                      borderLeft: notification.read ? "3px solid #d1d5db" : "3px solid #2563eb"
                    }}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ 
                        color: notification.read ? "#6b7280" : "#1f2937", 
                        fontSize: "0.9rem",
                        fontWeight: notification.read ? "normal" : "500"
                      }}>
                        {notification.message.substring(0, 50)}...
                      </span>
                      <span style={{ 
                        color: "#6b7280", 
                        fontSize: "0.75rem" 
                      }}>
                        {new Date(notification.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
          {/* Alerts */}
          <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)" }}>
            <h2 style={{ color: "#1f2937", marginBottom: "16px" }}>Alerts</h2>
            {getUpcomingDeadlines().length === 0 ? (
              <p style={{ color: "#666" }}>No upcoming deadlines.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {getUpcomingDeadlines().map(phase => {
                  const deadline = new Date(phase.deadline);
                  const now = new Date();
                  const diffTime = deadline.getTime() - now.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  
                  return (
                    <div key={phase.id} style={{ 
                      padding: "8px 12px", 
                      background: "#fef3c7", 
                      border: "1px solid #f59e0b", 
                      borderRadius: "6px",
                      color: "#92400e"
                    }}>
                      <strong>{phase.phase}</strong> - Due in {diffDays} day{diffDays !== 1 ? 's' : ''}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* My Submissions */}
          <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)" }}>
            <h2 style={{ color: "#1f2937", marginBottom: "16px" }}>My Submissions</h2>
            {submissions.length === 0 ? (
              <p style={{ color: "#666" }}>No submissions yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {submissions.slice(0, 5).map(submission => (
                  <div key={submission.subid} style={{ 
                    padding: "8px 12px", 
                    border: "1px solid #e5e7eb", 
                    borderRadius: "6px",
                    background: "#f9fafb"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <span style={{ color: "#1f2937", fontWeight: "500" }}>Project: {submission.pid}</span>
                      <span style={{ 
                        padding: "2px 6px", 
                        borderRadius: "8px", 
                        fontSize: "0.7rem", 
                        fontWeight: "500",
                        background: `${getStatusColor(submission.status)}20`,
                        color: getStatusColor(submission.status)
                      }}>
                        {submission.status}
                      </span>
                    </div>
                    <p style={{ color: "#6b7280", fontSize: "0.8rem" }}>
                      Phase: {phases.find(p => p.id === submission.phase)?.phase || `Phase ${submission.phase}`}
                    </p>
                    <p style={{ color: "#6b7280", fontSize: "0.8rem" }}>
                      Submitted: {new Date(submission.submitted_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Leaderboard Button */}
        <div style={{ textAlign: "center" }}>
          <button
            onClick={() => router.push("/leaderboard")}
            style={{
              padding: "12px 24px",
              borderRadius: "8px",
              background: "#10b981",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "600"
            }}
          >
            View Leaderboard
          </button>
        </div>

        {/* Notification Modal */}
        {showNotificationModal && selectedNotification && (
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
              maxWidth: "500px",
              maxHeight: "80vh",
              overflowY: "auto"
            }}>
              <h3 style={{ marginBottom: "20px", color: "#1f2937" }}>Notification</h3>
              
              <div style={{ marginBottom: "20px" }}>
                <p style={{ color: "#1f2937", lineHeight: "1.6" }}>
                  {selectedNotification.message}
                </p>
                <p style={{ color: "#6b7280", fontSize: "0.9rem", marginTop: "8px" }}>
                  {new Date(selectedNotification.created_at).toLocaleString()}
                </p>
              </div>

              {selectedNotification.type === "rejected" && (
                <div style={{ 
                  background: "#fef2f2", 
                  border: "1px solid #fecaca", 
                  borderRadius: "6px", 
                  padding: "12px", 
                  marginBottom: "20px" 
                }}>
                  <p style={{ color: "#dc2626", fontSize: "0.9rem", margin: 0 }}>
                    Your submission has been rejected. You can delete it and submit a new one.
                  </p>
                </div>
              )}
              
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                  onClick={() => {
                    setShowNotificationModal(false);
                    setSelectedNotification(null);
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
                  Close
                </button>
                {selectedNotification.type === "rejected" && (
                  <button
                    onClick={() => {
                      // Find the rejected submission and delete it
                      const rejectedSubmission = submissions.find(s => 
                        s.pid === selectedNotification.message.split(' ')[4] && 
                        s.status === "rejected"
                      );
                      if (rejectedSubmission) {
                        handleDeleteRejectedSubmission(rejectedSubmission.subid);
                      }
                    }}
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
                    Delete Rejected Submission
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 