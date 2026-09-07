import { Star } from "lucide-react";

export default function Stars({ value = 0, size = 13 }) {
  return (
    <span className="stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} fill={i <= Math.round(value) ? "currentColor" : "none"} className={i <= Math.round(value) ? "" : "off"} />
      ))}
    </span>
  );
}
