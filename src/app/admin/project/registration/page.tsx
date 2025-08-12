"use client";
import { useState } from "react";
import { supabase } from "../../../supabaseClient";
import toast, { Toaster } from "react-hot-toast";

export default function ProjectRegistration() {
  const [pid, setPid] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectType, setProjectType] = useState("individual");
  const [sid, setSid] = useState("");
  const [groupName, setGroupName] = useState("");
  const [numStudents, setNumStudents] = useState(2);
  const [studentIds, setStudentIds] = useState<string[]>(["", ""]);
  const [guideId, setGuideId] = useState("");
  const [status, setStatus] = useState("incomplete");
  const [loading, setLoading] = useState(false);

  const handleNumStudentsChange = (value: number) => {
    setNumStudents(value);
    setStudentIds(Array(value).fill(""));
  };

  const handleStudentIdChange = (index: number, value: string) => {
    const newStudentIds = [...studentIds];
    newStudentIds[index] = value;
    setStudentIds(newStudentIds);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let groupId = null;

      if (projectType === "group") {
        // Create group first
        const groupData = {
          gid: `G${Date.now()}`, // Generate unique group ID
          name: groupName,
          members: studentIds.filter(id => id.trim() !== "")
        };

        const { error: groupError } = await supabase
          .from("groups")
          .insert([groupData]);

        if (groupError) {
          toast.error("Group creation failed: " + groupError.message);
          setLoading(false);
          return;
        }

        groupId = groupData.gid;
        toast.success("Group created successfully!");
      }

      const projectData = {
        pid,
        title,
        description,
        group: projectType === "group",
        sid: projectType === "individual" ? sid : null,
        gid: guideId,
        status,
        gpid: projectType === "group" ? groupId : null
      };

      const { error } = await supabase
        .from("projects")
        .insert([projectData]);

      setLoading(false);
      
      if (error) {
        toast.error("Project registration failed: " + error.message);
      } else {
        toast.success("Project registered successfully!");
        // Clear form
        setPid("");
        setTitle("");
        setDescription("");
        setProjectType("individual");
        setSid("");
        setGroupName("");
        setNumStudents(2);
        setStudentIds(["", ""]);
        setGuideId("");
        setStatus("incomplete");
      }
    } catch (error) {
      setLoading(false);
      toast.error("Registration failed: " + error);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#23272f", padding: "20px", paddingTop: "80px" }}>
      <Toaster position="top-center" />
      <form onSubmit={handleSubmit} style={{ background: "#fff", borderRadius: 24, padding: 40, minWidth: 400, maxWidth: 500, boxShadow: "0 4px 32px rgba(0,0,0,0.10)", display: "flex", flexDirection: "column", gap: 18 }}>
        <h2 style={{ color: "#23272f", marginBottom: 12, textAlign: "center" }}>Project Registration</h2>
        
        <input
          type="text"
          placeholder="Project ID"
          value={pid}
          onChange={e => setPid(e.target.value)}
          required
          style={{ padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 16 }}
        />
        
        <input
          type="text"
          placeholder="Project Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
          style={{ padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 16 }}
        />
        
        <textarea
          placeholder="Project Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          style={{ padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 16, resize: "vertical" }}
        />
        
        <div style={{ display: "flex", gap: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="radio"
              name="projectType"
              value="individual"
              checked={projectType === "individual"}
              onChange={e => setProjectType(e.target.value)}
            />
            Individual
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="radio"
              name="projectType"
              value="group"
              checked={projectType === "group"}
              onChange={e => setProjectType(e.target.value)}
            />
            Group
          </label>
        </div>
        
        {projectType === "individual" && (
          <input
            type="text"
            placeholder="Student ID"
            value={sid}
            onChange={e => setSid(e.target.value)}
            required
            style={{ padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 16 }}
          />
        )}
        
        {projectType === "group" && (
          <>
            <input
              type="text"
              placeholder="Group Name"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              required
              style={{ padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 16 }}
            />
            
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label style={{ fontSize: 14, color: "#374151" }}>Number of Students:</label>
              <select
                value={numStudents}
                onChange={e => handleNumStudentsChange(Number(e.target.value))}
                style={{ padding: 8, borderRadius: 6, border: "1px solid #e5e7eb", fontSize: 14 }}
              >
                {[2, 3, 4, 5, 6].map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 14, color: "#374151", fontWeight: "500" }}>Student IDs:</label>
              {studentIds.map((studentId, index) => (
                <input
                  key={index}
                  type="text"
                  placeholder={`Student ${index + 1} ID`}
                  value={studentId}
                  onChange={e => handleStudentIdChange(index, e.target.value)}
                  required
                  style={{ padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 16 }}
                />
              ))}
            </div>
          </>
        )}
        
        <input
          type="text"
          placeholder="Guide ID"
          value={guideId}
          onChange={e => setGuideId(e.target.value)}
          required
          style={{ padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 16 }}
        />
        
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          style={{ padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 16 }}
        >
          <option value="incomplete">Incomplete</option>
          <option value="finished">Finished</option>
        </select>
        
        <button 
          type="submit" 
          disabled={loading} 
          style={{ 
            marginTop: 10, 
            padding: 14, 
            borderRadius: 24, 
            background: "#2563eb", 
            color: "#fff", 
            fontWeight: 600, 
            fontSize: 18, 
            border: "none", 
            cursor: "pointer", 
            transition: "background 0.2s",
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? <span style={{ display: 'inline-block', width: 18, height: 18, border: '3px solid #fff', borderTop: '3px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : "Register Project"}
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