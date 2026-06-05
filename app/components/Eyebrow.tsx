import type { ReactNode } from "react";

type EyebrowProps = {
  children: ReactNode;
  className?: string;
};

export default function Eyebrow({ children, className = "" }: EyebrowProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: "#2563EB" }}
      />
      <span className="text-xs font-semibold tracking-widest text-gray-400 uppercase">
        {children}
      </span>
    </span>
  );
}
