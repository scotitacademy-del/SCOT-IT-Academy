import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Panel } from "../components/Ui";
import { settingsApi } from "../services/api";

const defaults = { academyName: "SCOT IT Academy", email: "", branch: "Keelkattalai", followUpReminder: true, duplicateMobileCheck: true };

export default function Settings() {
  const [values, setValues] = useState(defaults);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      const { data } = await settingsApi.get();
      setValues({ ...defaults, ...data });
      setLoaded(true);
    } catch {
      setError("Unable to load settings. Try again before saving.");
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  const change = (key, value) => { setValues(current => ({ ...current, [key]: value })); setMessage(""); };
  async function save(event) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      await settingsApi.update(values);
      setMessage("Settings saved.");
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to save settings. Please try again.");
    } finally { setSaving(false); }
  }
  return <form onSubmit={save}>
    {error && <div className="login-error" role="alert">{error} {!loaded && <button type="button" className="secondary" onClick={load}>Retry</button>}</div>}
    {message && <div className="success-message" role="status">{message}</div>}
    <fieldset disabled={!loaded || saving} className="settings-fieldset">
      <div className="settings-grid">
        <Panel title="Institute Settings" subtitle="Update academy information">
          <div className="form-group"><label htmlFor="academy-name">Institute Name</label><input id="academy-name" required maxLength={150} value={values.academyName} onChange={event => change("academyName", event.target.value)} /></div>
          <div className="form-group"><label htmlFor="academy-email">Email</label><input id="academy-email" type="email" value={values.email} onChange={event => change("email", event.target.value)} /></div>
          <div className="form-group"><label htmlFor="academy-branch">Branch</label><input id="academy-branch" value={values.branch} onChange={event => change("branch", event.target.value)} /></div>
          <button className="primary" type="submit">{saving ? "Saving…" : "Save Settings"}</button>
        </Panel>
        <Panel title="System Settings" subtitle="Configure reminders and enquiries">
          {[["followUpReminder", "Fee reminders", "Show overdue fee notifications"], ["duplicateMobileCheck", "Duplicate mobile check", "Prevent new enquiries using an existing enquiry mobile number"]].map(([key, label, description]) => <div className="setting-row" key={key}>
            <div><strong>{label}</strong><small>{description}</small></div>
            <label className="switch"><input aria-label={label} type="checkbox" checked={values[key]} onChange={event => change(key, event.target.checked)} /><span /></label>
          </div>)}
          <div className="setting-row"><div><strong>Account Settings</strong><small>Update your username and password</small></div><Link to="/signup" className="link-btn">Update Account</Link></div>
        </Panel>
      </div>
    </fieldset>
  </form>;
}
