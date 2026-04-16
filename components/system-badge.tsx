// System badge — styled with the Star Wars sand/ochre gradient.
// When used in the system header (large context), the caller can pass variant="header".
export function SystemBadge({
  name,
  variant = "default",
}: {
  slug: string;
  name: string;
  variant?: "default" | "header";
}) {
  if (variant === "header") {
    return (
      <span
        style={{
          fontFamily: "'Orbitron', sans-serif",
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: "2px",
          color: "var(--dark-bg)",
          background: "linear-gradient(135deg, var(--sand) 0%, var(--ochre) 100%)",
          padding: "8px 14px",
          borderRadius: 4,
          boxShadow: "var(--glow-sand)",
          textTransform: "uppercase",
        }}
      >
        {name}
      </span>
    );
  }

  // Inline badge (game cards, tables, etc.)
  return (
    <span
      style={{
        fontFamily: "'Orbitron', sans-serif",
        fontWeight: 700,
        fontSize: 10,
        letterSpacing: "1px",
        color: "var(--dark-bg)",
        background: "linear-gradient(135deg, var(--sand) 0%, var(--ochre) 100%)",
        padding: "2px 6px",
        borderRadius: 3,
        boxShadow: "var(--glow-sand)",
        textTransform: "uppercase",
        display: "inline-block",
        lineHeight: 1.4,
      }}
    >
      {name}
    </span>
  );
}
