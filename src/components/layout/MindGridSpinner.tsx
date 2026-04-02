import type { CSSProperties } from "react";

export function MindGridSpinner({
  size = 18,
  label = "로딩 중…",
  animate = true,
  kind = "status",
}: {
  size?: number;
  label?: string;
  animate?: boolean;
  kind?: "status" | "logo";
}) {
  const style = { ["--size" as any]: `${size}px` } as CSSProperties;
  const pausedClass = animate ? "" : "mindgrid-spinner--paused";

  return (
    <span
      className={`mindgrid-spinner ${pausedClass}`}
      style={style}
      role={kind === "logo" ? "img" : "status"}
      aria-label={label}
    >
      <span className="mindgrid-spinner-ring" />
      <span className="mindgrid-spinner-grid" />
      <span className="mindgrid-spinner-dot-orbit">
        <span className="mindgrid-spinner-dot" />
      </span>
    </span>
  );
}
