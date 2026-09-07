import { SearchX } from "lucide-react";

export default function EmptyState({ title = "Nothing here yet", message, actions, icon }) {
  return (
    <div className="empty">
      <div className="ic">{icon || <SearchX size={34} />}</div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}
