import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi, getCurrentUser } from "../services/api";
import { Panel } from "../components/Ui";

export default function Admins() {
  const [rows, setRows] = useState([]);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const navigate = useNavigate();

  const load = () => adminApi.list().then(response => setRows((response.data.results || response.data || []).map(item => typeof item === "string" ? {id: item, name: item, role: "Administrator", username: item.toLowerCase().replace(/\s+/g, ""), password: "admin@123"} : item))).catch(() => {});

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== "Owner") {
      navigate("/dashboard", { replace: true });
      return;
    }
    load();
  }, [navigate]);

  const visible = rows.filter(admin => (admin.name || "").toLowerCase().includes(query.toLowerCase()) || (admin.username || "").toLowerCase().includes(query.toLowerCase()));

  async function add(event) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedUsername = username.trim();
    const trimmedPassword = password;

    if (!trimmedName || !trimmedUsername || !trimmedPassword) {
      window.alert("Admin name, username and password are required.");
      return;
    }

    try {
      await adminApi.create({ name: trimmedName, username: trimmedUsername, password: trimmedPassword });
      setName(""); setUsername(""); setPassword(""); setFormOpen(false); load();
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || "Unable to add admin.";
      window.alert(message);
    }
  }

  async function update() {
    const trimmedName = name.trim();
    const trimmedUsername = username.trim();
    const trimmedPassword = password;
    if (!trimmedName || !trimmedUsername) {
      window.alert("Admin name and username are required.");
      return;
    }

    try {
      await adminApi.update(editing.id, { name: trimmedName, username: trimmedUsername, ...(trimmedPassword ? { password: trimmedPassword } : {}) });
      setEditing(null); setName(""); setUsername(""); setPassword(""); load();
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || "Unable to update admin.";
      window.alert(message);
    }
  }

  async function remove(admin) {
    if (!window.confirm(`Delete admin ${admin.name}?`)) return;
    try {
      await adminApi.remove(admin.id);
      load();
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || "Unable to delete admin.";
      window.alert(message);
    }
  }

  return <Panel title="Admins" subtitle="Manage enquiry administrators" action={<div className="inline-form"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search admin..." /><button className="primary" onClick={() => {setName(""); setUsername(""); setPassword(""); setFormOpen(true);}}>+ Add Admin</button>{editing && <><input value={name} onChange={event => setName(event.target.value)} placeholder="Edit admin name" /><input value={username} onChange={event => setUsername(event.target.value)} placeholder="Edit username" /><input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="New password (leave blank to keep)" /><button className="primary" onClick={update}>Update Admin</button><button className="secondary" onClick={() => {setEditing(null); setName(""); setUsername(""); setPassword("");}}>Cancel</button></>}</div>}>
    <div className="category-grid">{visible.map(admin => <div className="category-card" key={admin.id}><div className="category-icon">♙</div><h3>{admin.name}</h3><p>{admin.username || admin.role || "Administrator"}</p><div className="card-actions"><button className="icon-btn" title="Edit" aria-label={`Edit ${admin.name}`} onClick={() => {setEditing(admin); setName(admin.name); setUsername(admin.username || ""); setPassword("");}}>✎</button><button className="icon-btn delete-btn" title="Delete" aria-label={`Delete ${admin.name}`} onClick={() => remove(admin)}>🗑</button></div></div>)}</div>
    {visible.length === 0 && <div className="empty">No admins found.</div>}
    {formOpen && <div className="modal-backdrop" onClick={() => setFormOpen(false)}><form className="modal" onSubmit={add} onClick={event => event.stopPropagation()}><div className="modal-header"><div><h3>Add Admin</h3><p>Create a new enquiry administrator</p></div><button type="button" className="modal-close" onClick={() => setFormOpen(false)}>X</button></div><div className="form-group"><label>Admin Name</label><input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="Enter admin name" required /></div><div className="form-group"><label>Username</label><input value={username} onChange={event => setUsername(event.target.value)} placeholder="Enter username" required /></div><div className="form-group"><label>Password</label><input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter password" required /></div><div className="form-actions"><button type="button" className="secondary" onClick={() => setFormOpen(false)}>Close</button><button className="primary">Add Admin</button></div></form></div>}
  </Panel>;
}
