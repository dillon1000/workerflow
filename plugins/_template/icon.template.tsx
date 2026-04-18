import type { WorkflowNodeIconComponent } from "../../apps/web/src/lib/workflow/plugin-icons";

export const PluginIcon: WorkflowNodeIconComponent = ({ className }) => (
  <svg
    aria-label="[Plugin Title] icon"
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      fill="currentColor"
      height="18"
      opacity="0.12"
      rx="4"
      width="18"
      x="3"
      y="3"
    />
    <path
      d="M7 17V7h3.75c2.7 0 4.25 1.47 4.25 4.02 0 2.59-1.55 3.98-4.25 3.98H9.2V17H7Zm2.2-3.82h1.38c1.39 0 2.21-.74 2.21-2.16s-.82-2.2-2.21-2.2H9.2v4.36Z"
      fill="currentColor"
    />
  </svg>
);
