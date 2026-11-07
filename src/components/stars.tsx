/** דירוג כוכבים 1 עד 5; תומך בחצאים לממוצעים */
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value.toFixed(1)} מתוך 5 כוכבים`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)));
        const id = `star-${n}-${Math.round(fill * 100)}`;
        return (
          <svg key={n} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
            <defs>
              {/* בכיוון ימין לשמאל הכוכב מתמלא מימין */}
              <linearGradient id={id} x1="1" x2="0" y1="0" y2="0">
                <stop offset={fill} stopColor="#f2a50c" />
                <stop offset={fill} stopColor="var(--border)" />
              </linearGradient>
            </defs>
            <path
              d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.8l-5.2 2.8 1-5.8L1.5 7.7l5.9-.9z"
              fill={`url(#${id})`}
            />
          </svg>
        );
      })}
    </span>
  );
}
