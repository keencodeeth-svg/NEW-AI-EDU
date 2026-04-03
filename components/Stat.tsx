import { cn } from "@/lib/utils";

export default function Stat({
  label,
  value,
  helper,
  className
}: {
  label: string;
  value: string;
  helper?: string;
  className?: string;
}) {
  return (
    <div className={cn("kpi", className)}>
      <div className="badge">{label}</div>
      <div className="kpi-value">{value}</div>
      {helper ? <div className="kpi-helper">{helper}</div> : null}
    </div>
  );
}
