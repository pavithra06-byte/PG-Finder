export function SkeletonCard() {
  return (
    <div className="card pg-card" style={{ height: 380 }}>
      <div className="skel" style={{ height: 190, borderRadius: 0 }} />
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="skel" style={{ height: 18, width: "70%" }} />
        <div className="skel" style={{ height: 13, width: "50%" }} />
        <div className="skel" style={{ height: 13, width: "85%" }} />
        <div className="skel" style={{ height: 26, width: "40%", marginTop: "auto" }} />
      </div>
    </div>
  );
}

export function SkeletonGrid({ n = 6 }) {
  return (
    <div className="pg-grid">
      {Array.from({ length: n }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

export function SkeletonLines({ n = 5 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="skel" style={{ height: 14, width: `${100 - i * 8}%` }} />
      ))}
    </div>
  );
}
