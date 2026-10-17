import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { ProjectForm } from "../components/projects/ProjectForm";
import { TaskDialog } from "../components/tasks/TaskDialog";
import { Dashboard } from "./Dashboard";
import {
  projectsApi,
  tasksApi,
  dashboardApi,
  allMembers,
} from "../api/resources";
import type { Project, Task } from "../types";

vi.mock("../api/resources", () => ({
  projectsApi: { save: vi.fn(), get: vi.fn() },
  tasksApi: { save: vi.fn() },
  dashboardApi: vi.fn(),
  allMembers: vi.fn(),
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 2, username: "Alex" } }),
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: () => null,
  PieChart: () => null,
  Pie: () => null,
  Cell: () => null,
  Tooltip: () => null,
}));
const project: Project = {
  id: 1,
  name: "Launch",
  description: "",
  owner_id: 1,
  role: "MEMBER",
  task_count: 1,
  completed_tasks: 0,
  completion_percentage: 0,
  member_count: 2,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};
const task: Task = {
  id: 1,
  title: "Review",
  description: "Review the release",
  project_id: 1,
  project_name: "Launch",
  creator_id: 1,
  assigned_to_id: 2,
  assignee_username: "Alex",
  status: "TODO",
  priority: "HIGH",
  due_date: null,
  created_at: project.created_at,
  updated_at: project.updated_at,
};
function wrap(element: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{element}</MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage("en");
  vi.mocked(projectsApi.get).mockResolvedValue(project);
  vi.mocked(allMembers).mockResolvedValue([
    {
      id: 1,
      user_id: 2,
      username: "Alex",
      email: "alex@example.com",
      role: "MEMBER",
      joined_at: project.created_at,
    },
  ]);
});
it("creates a project using validated input and closes on success", async () => {
  vi.mocked(projectsApi.save).mockResolvedValue(project);
  const close = vi.fn();
  wrap(<ProjectForm close={close} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Project name"), "My launch");
  await user.click(screen.getByRole("button", { name: "Create" }));
  await waitFor(() =>
    expect(projectsApi.save).toHaveBeenCalledWith(
      { name: "My launch", description: "" },
      undefined,
    ),
  );
  await waitFor(() => expect(close).toHaveBeenCalled());
});
it("allows assignees to update status while keeping unrelated fields disabled", async () => {
  vi.mocked(tasksApi.save).mockResolvedValue({ ...task, status: "DONE" });
  wrap(<TaskDialog projectId={1} task={task} close={vi.fn()} />);
  const user = userEvent.setup();
  expect(await screen.findByLabelText("Title")).toBeDisabled();
  expect(screen.getByLabelText("Priority")).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: "Delete task" }),
  ).not.toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Status"), "DONE");
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() =>
    expect(tasksApi.save).toHaveBeenCalledWith(1, { status: "DONE" }, 1),
  );
});
it("makes unassigned, unrelated tasks read-only", async () => {
  wrap(
    <TaskDialog
      projectId={1}
      task={{ ...task, assigned_to_id: null }}
      close={vi.fn()}
    />,
  );
  expect(await screen.findByLabelText("Status")).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: "Save changes" }),
  ).not.toBeInTheDocument();
});
it("renders dashboard statistics returned by the API", async () => {
  vi.mocked(dashboardApi).mockResolvedValue({
    total_projects: 7,
    total_tasks: 13,
    completed_tasks: 5,
    in_progress_tasks: 3,
    pending_tasks: 5,
    recent_projects: [],
    recent_tasks: [],
    upcoming_deadlines: [],
  });
  wrap(<Dashboard />);
  expect(
    await screen.findByRole("heading", { name: /Welcome back, Alex/ }),
  ).toBeVisible();
  expect(screen.getByText("13", { selector: "strong" })).toBeVisible();
  expect(screen.getByText("7", { selector: "strong" })).toBeVisible();
});
it("shows a recoverable dashboard error without leaking internals", async () => {
  vi.mocked(dashboardApi).mockRejectedValue(new Error("database credentials"));
  wrap(<Dashboard />);
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.queryByText("database credentials")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
});
