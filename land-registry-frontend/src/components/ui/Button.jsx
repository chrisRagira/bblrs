/**
 * Button component
 * variant: "primary" | "secondary" | "teal" | "danger" | "ghost"
 */
export default function Button({
  children,
  variant = "primary",
  onClick,
  small = false,
  full  = false,
  disabled = false,
  type = "button",
  className = "",
}) {
  const cls = [
    "btn",
    `btn--${variant}`,
    small ? "btn--sm"   : "",
    full  ? "btn--full" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}
