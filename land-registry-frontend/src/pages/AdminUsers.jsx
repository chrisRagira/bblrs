import { useState, useEffect } from "react";
import { adminApi } from "../api/services";
import { PageHeader, StatCard, Card } from "../components/ui/Card";
import { Alert, Spinner, EmptyState } from "../components/ui/Feedback";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import { C, ROLE_COLORS } from "../styles/tokens";

const DEMO_USERS = [
  { userID:"u1", fullName:"John Kamau",      email:"john@example.com",      role:"BUYER/SELLER", isActive:true,  nationalId:"12345678", createdAt:"2024-03-15" },
  { userID:"u2", fullName:"Officer Wanjiku", email:"wanjiku@lands.go.ke",   role:"REGISTRAR", isActive:true,  nationalId:"87654321", createdAt:"2023-01-10" },
  { userID:"u3", fullName:"Admin Njuguna",   email:"njuguna@lands.go.ke",   role:"ADMIN",     isActive:true,  nationalId:"11223344", createdAt:"2022-06-01" },
  { userID:"u4", fullName:"KCB Bank Kenya",  email:"registry@kcb.co.ke",    role:"FINANCIAL", isActive:true,  nationalId:"INS/001",  createdAt:"2023-08-20" },
  { userID:"u5", fullName:"Advocate Mutua",  email:"mutua@lawfirm.co.ke",   role:"LEGAL",     isActive:false, nationalId:"55667788", createdAt:"2023-03-14" },
];

const ALL_ROLES = ["BUYER/SELLER","REGISTRAR","ADMIN","LEGAL","FINANCIAL","PUBLIC"];

export default function AdminUsers() {
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [query,    setQuery]    = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [editUser, setEditUser] = useState(null); // user being role-edited

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await adminApi.getUsers();
        setUsers(res.data.data);
      } catch { setUsers(DEMO_USERS); }
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = users.filter(u =>
    (!query      || u.fullName.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase()) || u.nationalId.includes(query)) &&
    (!roleFilter || u.role === roleFilter)
  );

  const handleDeactivate = async (userID) => {
    try {
      await adminApi.deactivateUser(userID);
      setUsers(u => u.map(x => x.userID === userID ? { ...x, isActive: false } : x));
      setFeedback({ type:"success", msg:"User deactivated." });
    } catch { setFeedback({ type:"danger", msg:"Action failed." }); }
  };

  const handleRoleChange = async (userID, newRole) => {
    try {
      await adminApi.assignRole(userID, { role: newRole });
      setUsers(u => u.map(x => x.userID === userID ? { ...x, role: newRole } : x));
      setFeedback({ type:"success", msg:`Role updated to ${newRole}.` });
      setEditUser(null);
    } catch { setFeedback({ type:"danger", msg:"Role update failed." }); }
  };

  return (
    <div className="page-wrapper">
      <PageHeader
        title="User Management"
        subtitle="Manage accounts, roles, and access levels"
        action={<Button>+ Invite User</Button>}
      />

      {feedback && <Alert type={feedback.type}>{feedback.msg}</Alert>}

      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard label="Total Users" value={users.length}                          icon="👥" />
        <StatCard label="Active"      value={users.filter(u=>u.isActive).length}   icon="✓" />
        <StatCard label="Registrars"  value={users.filter(u=>u.role==="REGISTRAR").length} icon="🏛" />
        <StatCard label="Admins"      value={users.filter(u=>u.role==="ADMIN").length}     icon="🔑" accent />
      </div>

      <Card>
        <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
          <div style={{ flex:1, minWidth:220, position:"relative" }}>
            <span className="input-icon">🔍</span>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, email, or ID…" className="form-control form-control--icon" />
          </div>
          <select value={roleFilter} onChange={e=>setRoleFilter(e.target.value)} className="form-control" style={{width:180}}>
            <option value="">All Roles</option>
            {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {loading ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState icon="👥" title="No users found" message="Try adjusting your search." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>{["User","National ID","Role","Status","Joined","Actions"].map(h=><th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const roleColor = ROLE_COLORS[u.role] || "#64748B";
                const initials  = u.fullName.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase();
                return (
                  <tr key={u.userID}>
                    <td>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ width:32, height:32, borderRadius:"50%", background:`${roleColor}20`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:600, color:roleColor }}>
                          {initials}
                        </div>
                        <div>
                          <p style={{ fontWeight:500 }}>{u.fullName}</p>
                          <p style={{ fontSize:11, color:C.textSecondary }}>{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="monospace">{u.nationalId}</td>
                    <td>
                      {editUser === u.userID ? (
                        <select defaultValue={u.role} onChange={e=>handleRoleChange(u.userID, e.target.value)} className="form-control" style={{width:130, padding:"4px 8px", fontSize:12}}>
                          {ALL_ROLES.map(r=><option key={r} value={r}>{r}</option>)}
                        </select>
                      ) : (
                        <span style={{ background:`${roleColor}15`, color:roleColor, padding:"2px 10px", borderRadius:12, fontSize:12, fontWeight:500 }}>
                          {u.role}
                        </span>
                      )}
                    </td>
                    <td><Badge status={u.isActive ? "ACTIVE" : "INACTIVE"} /></td>
                    <td style={{ color:C.textSecondary }}>{u.createdAt}</td>
                    <td>
                      <div style={{ display:"flex", gap:6 }}>
                        <Button variant="secondary" small onClick={() => setEditUser(editUser === u.userID ? null : u.userID)}>
                          {editUser === u.userID ? "Cancel" : "Edit Role"}
                        </Button>
                        {u.isActive && (
                          <Button variant="danger" small onClick={() => handleDeactivate(u.userID)}>
                            Deactivate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
