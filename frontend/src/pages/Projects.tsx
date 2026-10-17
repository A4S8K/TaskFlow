import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Search } from "lucide-react";
import { projectsApi } from "../api/resources";
import { ProjectCard } from "../components/projects/ProjectCard";
import { ProjectForm } from "../components/projects/ProjectForm";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Loading, Failure, Empty, Pagination } from "../components/ui/feedback";

export function Projects() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [create, setCreate] = useState(false);
  const result = useQuery({
    queryKey: ["projects", search, page],
    queryFn: ({ signal }) => projectsApi.list({ search, page }, signal),
  });
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("projects.title")}</h1>
          <p className="page-subtitle">{t("projects.subtitle")}</p>
        </div>
        <Button onClick={() => setCreate(true)}>
          <Plus size={17} />
          {t("projects.create")}
        </Button>
      </div>
      <div className="toolbar">
        <div className="search-input">
          <Search size={16} />
          <Input
            aria-label={t("projects.searchPlaceholder")}
            placeholder={t("projects.searchPlaceholder")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>
      {result.isPending ? (
        <Loading />
      ) : result.isError ? (
        <Failure error={result.error} retry={() => void result.refetch()} />
      ) : (
        <>
          <div className="projects-grid">
            {result.data.items.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
          {!result.data.total && (
            <Empty
              title={t(search ? "projects.noResults" : "projects.emptyTitle")}
              description={t("projects.emptyDescription")}
            />
          )}
          <Pagination
            page={page}
            total={result.data.total}
            size={12}
            setPage={setPage}
          />
        </>
      )}
      {create && <ProjectForm close={() => setCreate(false)} />}
    </>
  );
}
