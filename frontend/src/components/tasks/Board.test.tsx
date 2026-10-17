import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import { Board } from "./Board";
import { tasksApi } from "../../api/resources";
import i18n from "../../i18n";
import type { Page, Project, Task } from "../../types";

vi.mock("../../api/resources", () => ({ tasksApi: { save: vi.fn() } }));
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 2 } }),
}));
const project = { id: 1, role: "MEMBER" } as Project;
const task = {
  id: 9,
  project_id: 1,
  title: "Move me",
  description: "",
  status: "TODO",
  priority: "LOW",
  assigned_to_id: 2,
  creator_id: 1,
  due_date: null,
  assignee_username: "Alex",
} as Task;
beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage("en");
});
it("restores the previous cache after a failed optimistic status change", async () => {
  const cache = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const queryKey = ["tasks", 1];
  const previous: Page<Task> = {
    items: [task],
    page: 1,
    page_size: 30,
    total: 1,
  };
  cache.setQueryData(queryKey, previous);
  let reject: (reason: unknown) => void = () => undefined;
  vi.mocked(tasksApi.save).mockImplementation(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  render(
    <QueryClientProvider client={cache}>
      <Board
        tasks={[task]}
        project={project}
        queryKey={queryKey}
        open={vi.fn()}
        create={vi.fn()}
      />
    </QueryClientProvider>,
  );
  await userEvent.setup().selectOptions(screen.getByRole("combobox"), "DONE");
  await waitFor(() =>
    expect(cache.getQueryData<Page<Task>>(queryKey)?.items[0].status).toBe(
      "DONE",
    ),
  );
  reject(new Error("Permission changed"));
  await waitFor(() => expect(cache.getQueryData(queryKey)).toEqual(previous));
  expect(tasksApi.save).toHaveBeenCalledWith(1, { status: "DONE" }, 9);
});
it("disables status changes for unrelated regular members", () => {
  const cache = new QueryClient();
  render(
    <QueryClientProvider client={cache}>
      <Board
        tasks={[{ ...task, assigned_to_id: null }]}
        project={project}
        queryKey={["tasks"]}
        open={vi.fn()}
        create={vi.fn()}
      />
    </QueryClientProvider>,
  );
  expect(screen.getByRole("combobox")).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: "Move Move me" }),
  ).not.toBeInTheDocument();
});
