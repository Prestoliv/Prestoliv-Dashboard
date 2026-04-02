import type { ReactNode } from "react";

type Tone = "slate" | "emerald" | "amber" | "red" | "blue";

export function Badge({
  children,
  tone = "slate",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const tones: Record<Tone, string> = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge tone="emerald">{status}</Badge>;
  if (status === "completed") return <Badge tone="slate">{status}</Badge>;
  if (status === "on_hold") return <Badge tone="amber">{status}</Badge>;
  if (status === "cancelled") return <Badge tone="red">{status}</Badge>;
  if (status === "open") return <Badge tone="blue">{status}</Badge>;
  if (status === "closed") return <Badge tone="slate">{status}</Badge>;
  return <Badge>{status}</Badge>;
}

