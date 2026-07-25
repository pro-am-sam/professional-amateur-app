export default function CredentialsBanner({ credentials, onDismiss }) {
  return (
    <div className="credentials-banner">
      <strong>{credentials.name}'s login is ready to share:</strong>
      <div className="credentials-row">
        <span>
          Username: <code>{credentials.username}</code>
        </span>
        <span>
          Password: <code>{credentials.password}</code>
        </span>
      </div>
      <p className="credentials-hint">
        This is shown once — copy it now and send it to them directly.
      </p>
      <button type="button" className="secondary" onClick={onDismiss}>
        Got it
      </button>
    </div>
  );
}
