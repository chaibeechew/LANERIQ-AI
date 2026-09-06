export default function LaneriqLotusBrand({
  className = "",
  iconOnly = false,
  compact = false,
  ariaLabel = "LANERIQ AI — Living Intelligence",
}) {
  return (
    <span className={`laneriqLotusBrand${compact ? " isCompact" : ""}${iconOnly ? " isIconOnly" : ""}${className ? ` ${className}` : ""}`} aria-label={ariaLabel}>
      <svg className="laneriqLotusMark" viewBox="0 0 120 104" role="img" aria-hidden="true" focusable="false">
        <g fill="none" stroke="currentColor" strokeWidth="2.35" strokeLinecap="round" strokeLinejoin="round">
          <path d="M60 89C50 75 46 58 60 34C74 58 70 75 60 89Z" />
          <path d="M60 88C42 77 35 61 40 40C55 48 62 64 60 88Z" />
          <path d="M60 88C78 77 85 61 80 40C65 48 58 64 60 88Z" />
          <path d="M50 84C32 79 21 67 18 49C34 50 47 61 50 84Z" />
          <path d="M70 84C88 79 99 67 102 49C86 50 73 61 70 84Z" />
          <path d="M44 87C30 90 17 86 8 75C24 70 39 74 50 86" />
          <path d="M76 87C90 90 103 86 112 75C96 70 81 74 70 86" />
          <path d="M25 78C36 92 47 97 60 97C73 97 84 92 95 78" />
          <path d="M60 34V18" />
          <path d="M60 18C55 24 52 28 52 34" />
          <path d="M60 18C65 24 68 28 68 34" />
        </g>
        <circle cx="60" cy="58" r="4.2" fill="currentColor" opacity="0.95" />
      </svg>
      {!iconOnly && (
        <span className="laneriqLotusWordmark">
          <b>LANERIQ AI</b>
          <small>LIVING INTELLIGENCE</small>
        </span>
      )}
    </span>
  );
}
