import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { dashboardApi, studentApi, settingsApi } from "../services/api";

const menus = (user) => [
  ["dashboard","⌂","Dashboard"],
  ["add-enquiry","＋","Add Enquiry"],
  ["enquiry-list","☷","Enquiry List"],
  ["students","◫","Students"],
  ["follow-ups","◷","Follow-ups"],
  ["reports","▥","Reports"],
  ...(user?.role?.toLowerCase() === "owner" ? [["admins","♙","Admins"]] : []),
  ["categories","▦","Categories"],
  // ["settings","⚙","Settings"]
  ...(user?.role?.toLowerCase() === "owner" ? [["settings","⚙","Settings"]] : []),
];

export default function Layout({user}) {
  const [collapsed,setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 768px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 768px)");
    const update = () => setMobile(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!mobile || !collapsed) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = event => { if (event.key === "Escape") setCollapsed(false); };
    document.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", close); };
  }, [mobile, collapsed]);
  const [notificationsOpen,setNotificationsOpen] = useState(false);
  const [notifications,setNotifications] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();
  const menuList = menus(user);
  const title = menuList.find(x => location.pathname.includes(x[0]))?.[2] || "Dashboard";

  useEffect(() => {
    const toNumber = value => {
      if (value === null || value === undefined || value === "") return 0;
      const text = String(value).replace(/[₹,\s]/g, "");
      const parsed = Number(text);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const normalizeDueDate = value => {
      if (!value) return "";
      const text = String(value).trim();
      if (!text) return "";
      const iso = text.includes("T") ? text : `${text}T00:00:00`;
      return new Date(iso);
    };

    const formatDisplayDate = (val) => {
      if (!val) return "today";
      const str = String(val).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        const [y, m, d] = str.substring(0, 10).split("-");
        return `${d}/${m}/${y}`;
      }
      return str;
    };

    const isStudentActive = (status) => {
      const s = String(status || "").trim().toLowerCase();
      if (s === "inactive" || s === "placed" || s === "closed") {
        return false;
      }
      if (s && s !== "active" && s !== "joined") {
        return false;
      }
      return true;
    };

    const isExpiredOverdue = (row) => {
      const balance = toNumber(
        row.balance_fee ??
        row.balanceFee ??
        row.pending_fee ??
        row.pendingFee ??
        row.pending ??
        row.amount_due ??
        row.due_amount ??
        0
      );

      const dueDate = normalizeDueDate(
        row.due_date ??
        row.dueDate ??
        row.next_followup_date ??
        row.nextFollowupDate ??
        row.date
      );

      if (!dueDate || Number.isNaN(dueDate.getTime())) return false;
      if (!(balance > 0)) return false;

      // Status check: must not be Inactive, Placed, or Closed
      if (!isStudentActive(row.status || row.final_status || row.finalStatus)) {
        return false;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return dueDate < today;
    };

    Promise.allSettled([
      dashboardApi.notifications(),
      studentApi.list(),
      settingsApi.get()
    ]).then(([notificationResult, studentResult, settingsResult]) => {
      if (settingsResult.status === "fulfilled" && settingsResult.value.data?.followUpReminder === false) {
        setNotifications([]);
        return;
      }
      const notificationRows = notificationResult.status === "fulfilled"
        ? (notificationResult.value?.data?.results || notificationResult.value?.data || [])
        : [];

      const studentRows = studentResult.status === "fulfilled"
        ? (studentResult.value?.data?.results || studentResult.value?.data || [])
        : [];

      // Map students to their exact status
      const studentStatusMap = new Map();
      studentRows.forEach((s) => {
        const rawStatus = s.status || s.final_status || s.finalStatus || "Active";
        if (s.id) studentStatusMap.set(String(s.id).toLowerCase(), rawStatus);
        if (s.studentId) studentStatusMap.set(String(s.studentId).toLowerCase(), rawStatus);
        if (s.student_id) studentStatusMap.set(String(s.student_id).toLowerCase(), rawStatus);
        if (s.mobile) studentStatusMap.set(String(s.mobile).toLowerCase().replace(/\D/g, ""), rawStatus);
        if (s.mobile_no) studentStatusMap.set(String(s.mobile_no).toLowerCase().replace(/\D/g, ""), rawStatus);
        const nameCourse = `${String(s.name || s.candidate_name || "").toLowerCase()}-${String(s.course || "").toLowerCase()}`;
        if (nameCourse !== "-") studentStatusMap.set(nameCourse, rawStatus);
      });

      const rows = [
        ...notificationRows,
        ...studentRows
      ].filter((row) => row && (row.name || row.candidate_name || row.student_name)).map((row) => {
        const idKey = String(row.id || row.studentId || row.student_id || "").toLowerCase();
        const mobileKey = String(row.mobile || row.mobile_no || "").toLowerCase().replace(/\D/g, "");
        const nameCourseKey = `${String(row.name || row.candidate_name || "").toLowerCase()}-${String(row.course || "").toLowerCase()}`;

        const resolvedStatus =
          (idKey && studentStatusMap.get(idKey)) ||
          (mobileKey && studentStatusMap.get(mobileKey)) ||
          (nameCourseKey && studentStatusMap.get(nameCourseKey)) ||
          row.status ||
          row.final_status ||
          row.finalStatus ||
          "Active";

        return {
          ...row,
          status: resolvedStatus,
          name: row.name || row.candidate_name || row.student_name,
          pending_fee: row.pending_fee ?? row.pendingFee ?? row.balance_fee ?? row.balanceFee ?? row.amount_due ?? row.due_amount,
          paid_fee: row.paid_fee ?? row.paidFee ?? row.paid_fee ?? row.paidFee,
          due_date: row.due_date ?? row.dueDate ?? row.next_followup_date ?? row.nextFollowupDate ?? row.date,
          mobile: row.mobile || row.mobile_no || ""
        };
      });

      const uniqueRows = Array.from(
        new Map(
          rows.map((row) => {
            const key = String(
              row.id ??
              `${row.name || row.candidate_name || row.student_name || "student"}-${row.mobile || row.mobile_no || row.email || "unknown"}`
            ).toLowerCase();
            return [key, row];
          })
        ).values()
      );

      const overdue = uniqueRows
        .filter((row) => isExpiredOverdue(row))
        .sort((a, b) => {
          const dateA = normalizeDueDate(a.due_date ?? a.dueDate ?? a.date) || 0;
          const dateB = normalizeDueDate(b.due_date ?? b.dueDate ?? b.date) || 0;
          return dateA - dateB;
        })
        .map((row) => ({
          ...row,
          name: row.name || row.candidate_name || row.student_name,
          mobile: row.mobile || row.mobile_no || "",
          pending_fee: row.pending_fee ?? row.pendingFee ?? row.balance_fee ?? row.balanceFee ?? row.amount_due ?? row.due_amount ?? "Not recorded",
          paid_fee: row.paid_fee ?? row.paidFee ?? row.paid_fee ?? "Not recorded",
          due_date: formatDisplayDate(row.due_date ?? row.dueDate ?? row.next_followup_date ?? row.nextFollowupDate ?? row.date)
        }));

      setNotifications(overdue);
    }).catch(() => setNotifications([]));
  }, [location.pathname]);

  useEffect(() => {
    // Close sidebar on route change (for mobile view)
    setCollapsed(false);
  }, [location.pathname]);

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("scot_it_current_user");
    navigate("/login");
  }

  return <div className={`app ${collapsed ? "collapsed" : ""}`}>
    <div className="sidebar-overlay" onClick={() => setCollapsed(false)} />
    <aside id="main-navigation" className="sidebar" inert={mobile && !collapsed ? true : undefined}>
      <button className="sidebar-close" aria-label="Close navigation" onClick={() => setCollapsed(false)}>×</button>
      <div className="logo"><h2>SCOT</h2><p>IT ACADEMY</p></div>
      <nav>{menuList.map(([path,icon,label]) =>
        <NavLink key={path} to={`/${path}`} className="menu-item">
          <span>{icon}</span><b>{label}</b>
        </NavLink>
      )}</nav>
    </aside>
    <main className="main">
      <header className="topbar">
        <div className="mobile-title"><button className="secondary menu-toggle" aria-label="Toggle navigation" aria-expanded={collapsed} aria-controls="main-navigation" onClick={()=>setCollapsed(!collapsed)}>☰</button>
          <div><h1>{title}</h1><p>SCOT IT Academy Enquiry Follow-up System</p></div>
        </div>
        <div className="profile-wrap">
          <div className="notification-wrap">
            <button className="notification-btn" aria-label="Open overdue fee notifications" onClick={()=>setNotificationsOpen(!notificationsOpen)}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>{notifications.length > 0 && <span>{notifications.length}</span>}</button>
            {notificationsOpen && <div className="notification-menu"><div className="notification-header"><strong>Overdue fees</strong><div><small>{notifications.length} students</small><button className="notification-close" aria-label="Close notifications" onClick={()=>setNotificationsOpen(false)}>X</button></div></div>{notifications.length === 0 ? <p className="notification-empty">No overdue fee notifications</p> : notifications.map((item,index)=><div className="notification-item" key={item.id || item.mobile || index}><strong>{item.name || item.candidate_name}</strong><small>{item.mobile} - Due {item.due_date || item.next_followup_date || "today"}</small><div><span>Pending: {item.pending_fee || item.pendingFee || "Not recorded"}</span><span>Paid: {item.paid_fee || item.paidFee || "Not recorded"}</span></div></div>)}</div>}
          </div>
          <div className="profile"><div className="avatar">B</div><div><strong>{user.name}</strong><small>{user.role}</small></div></div>
          <button className="secondary logout-btn" onClick={logout}>Logout</button>
        </div>
      </header>
      <Outlet />
    </main>
  </div>;
}