"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import toast, { Toaster } from "react-hot-toast";

interface User {
  uid: string;
  name: string;
  email: string;
  department_id: string;
  password: string;
  role: string;
}

export default function UserEdit() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    department_id: "",
    password: "",
    role: "student"
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("uid");

      if (error) {
        toast.error("Failed to fetch users: " + error.message);
      } else {
        setUsers(data || []);
      }
    } catch (error) {
      toast.error("Failed to fetch users: " + error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      email: user.email || "",
      department_id: user.department_id || "",
      password: user.password,
      role: user.role
    });
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;

    try {
      const { error } = await supabase
        .from("users")
        .update({
          name: editForm.name,
          email: editForm.email,
          department_id: editForm.department_id,
          password: editForm.password,
          role: editForm.role
        })
        .eq("uid", editingUser.uid);

      if (error) {
        toast.error("Failed to update user: " + error.message);
      } else {
        toast.success("User updated successfully!");
        setEditingUser(null);
        fetchUsers(); // Refresh the list
      }
    } catch (error) {
      toast.error("Failed to update user: " + error);
    }
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditForm({ name: "", email: "", department_id: "", password: "", role: "student" });
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin": return "#ef4444";
      case "guide": return "#3b82f6";
      case "student": return "#10b981";
      default: return "#6b7280";
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#23272f", paddingTop: "100px" }}>
        <div style={{ color: "#fff", fontSize: "1.2rem" }}>Loading users...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#23272f", padding: "20px", paddingTop: "80px" }}>
      <Toaster position="top-center" />
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <h1 style={{ color: "#fff", marginBottom: "30px", textAlign: "center" }}>Edit Users</h1>
        
        {users.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: "12px", padding: "40px", textAlign: "center" }}>
            <p style={{ color: "#666", fontSize: "1.1rem" }}>No users found.</p>
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: "12px", overflow: "hidden", boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#374151" }}>User ID</th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Name</th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Email</th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Department</th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Role</th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, index) => (
                    <tr key={user.uid} style={{ borderBottom: "1px solid #f1f5f9", background: index % 2 === 0 ? "#fff" : "#f8fafc" }}>
                      <td style={{ padding: "12px", color: "#1f2937", fontWeight: "500" }}>{user.uid}</td>
                      <td style={{ padding: "12px", color: "#1f2937" }}>{user.name}</td>
                      <td style={{ padding: "12px", color: "#1f2937" }}>{user.email || "-"}</td>
                      <td style={{ padding: "12px", color: "#1f2937" }}>{user.department_id || "-"}</td>
                      <td style={{ padding: "12px" }}>
                        <span style={{ 
                          padding: "4px 8px", 
                          borderRadius: "12px", 
                          fontSize: "0.75rem", 
                          fontWeight: "500",
                          background: `${getRoleColor(user.role)}20`,
                          color: getRoleColor(user.role)
                        }}>
                          {user.role}
                        </span>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <button
                          onClick={() => handleEdit(user)}
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
      {editingUser && (
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
            <h3 style={{ marginBottom: "20px", color: "#1f2937" }}>Edit User: {editingUser.uid}</h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", color: "#374151" }}>Name:</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "14px" }}
                />
              </div>
              
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", color: "#374151" }}>Email:</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "14px" }}
                />
              </div>
              
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", color: "#374151" }}>Department ID:</label>
                <input
                  type="text"
                  value={editForm.department_id}
                  onChange={e => setEditForm({ ...editForm, department_id: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "14px" }}
                />
              </div>
              
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", color: "#374151" }}>Password:</label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "14px" }}
                />
              </div>
              
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", color: "#374151" }}>Role:</label>
                <select
                  value={editForm.role}
                  onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "14px" }}
                >
                  <option value="student">Student</option>
                  <option value="guide">Guide</option>
                  <option value="admin">Admin</option>
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