import { initials } from "../utils/format";

export default function Avatar({ name, src, size = 38 }) {
  if (src) {
    return <img className="avatar" src={src} alt={name} style={{ width: size, height: size }} />;
  }
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials(name)}
    </span>
  );
}
