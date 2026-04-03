import { cn } from "@/lib/utils";

export default function Card({
  title,
  tag,
  children,
  className,
  headerClassName,
  bodyClassName
}: {
  title?: string;
  tag?: string;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn("card", className)}>
      {title ? (
        <div className={cn("card-header", headerClassName)}>
          <div className="section-title">{title}</div>
          {tag ? <span className="card-tag">{tag}</span> : null}
        </div>
      ) : null}
      <div className={cn("card-body", bodyClassName)}>{children}</div>
    </div>
  );
}
