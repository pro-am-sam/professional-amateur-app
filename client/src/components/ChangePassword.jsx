import { useState } from "react";

export default function ChangePassword({ onBack }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not change password.");
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="preview-actions-top">
        <button type="button" className="secondary" onClick={onBack}>
          ← Back
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {error && <p className="error-text">{error}</p>}
        {success && <p className="success-text">Password changed.</p>}

        <label htmlFor="current-password" className="title-label">
          Current password
        </label>
        <input
          id="current-password"
          type="password"
          className="title-input"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          disabled={isSaving}
        />

        <label htmlFor="new-password" className="title-label">
          New password (at least 8 characters)
        </label>
        <input
          id="new-password"
          type="password"
          className="title-input"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={isSaving}
        />

        <label htmlFor="confirm-password" className="title-label">
          Confirm new password
        </label>
        <input
          id="confirm-password"
          type="password"
          className="title-input"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isSaving}
        />

        <button type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : "Change password"}
        </button>
      </form>
    </div>
  );
}
