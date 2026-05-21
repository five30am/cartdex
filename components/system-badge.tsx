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
          fontFamily: "var(--cd-font-heading)",
          fontWeight: 700,
          fontSize: "0.8125rem",
          letterSpacing: "2px",
          color: "var(--dark-bg)",
          background: "linear-gradient(135deg, var(--sand) 0%, var(--ochre) 100%)",
          padding: "0.5rem 0.875rem",
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
        fontFamily: "var(--cd-font-heading)",
        fontWeight: 700,
        fontSize: "0.625rem",
        letterSpacing: "1px",
        color: "var(--dark-bg)",
        background: "linear-gradient(135deg, var(--sand) 0%, var(--ochre) 100%)",
        padding: "0.125rem 0.375rem",
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
