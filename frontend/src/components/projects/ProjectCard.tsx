import { Link } from "react-router-dom";
import { FolderKanban, ArrowUpRight, Users, CheckSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Project } from "../../types";
import { formatDate } from "../../utils/dates";

export function ProjectCard({ project }: { project: Project }) {
  const { t, i18n } = useTranslation();
  return (
    <Link className="project-card" to={`/app/projects/${project.id}`}>
      <div className="project-card-top">
        <span className="project-icon">
          <FolderKanban size={22} />
        </span>
        <span className="role-badge">{t(`role.${project.role}`)}</span>
        <ArrowUpRight size={17} />
      </div>
      <h3>{project.name}</h3>
      <p className="project-description">
        {project.description || t("common.noDescription")}
      </p>
      <div className="progress-label">
        <span>{t("projects.progress")}</span>
        <strong>{project.completion_percentage}%</strong>
      </div>
      <progress
        max={100}
        value={project.completion_percentage}
        aria-label={t("projects.progress")}
      />
      <div className="project-card-bottom">
        <span>
          <CheckSquare size={14} />
          {project.completed_tasks}/{project.task_count}
        </span>
        <span>
          <Users size={14} />
          {project.member_count}
        </span>
        <span>{formatDate(project.updated_at, i18n.language)}</span>
      </div>
    </Link>
  );
}
