// Decorative fixed bottom HUD bar — purely atmospheric, no functionality.
export function StatusBar() {
  return (
    <div className="sw-status-bar" aria-hidden="true">
      <div className="sw-status-item">
        <span className="sw-status-dot" />
        Archive Online
      </div>
      <div className="sw-status-item">Holocron Archive System</div>
      <div className="sw-status-item">RomVault v4.2.0</div>
      <div style={{ flex: 1 }} />
      <div className="sw-status-item">// archive.holocron.v4.2</div>
    </div>
  );
}
