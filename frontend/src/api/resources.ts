import { apiClient } from "./client";
import type {
  Envelope,
  Member,
  Page,
  Params,
  Project,
  Summary,
  Task,
  TaskInput,
  User,
} from "../types";

export const read = async <T>(
  url: string,
  params?: Params,
  signal?: AbortSignal,
): Promise<T> =>
  (await apiClient.get<T>(`/api/v1${url}`, { params, signal })).data;
export const write = async <T>(
  method: "post" | "patch" | "delete",
  url: string,
  body?: unknown,
): Promise<T> =>
  (
    await apiClient.request<Envelope<T>>({
      method,
      url: `/api/v1${url}`,
      data: body,
    })
  ).data.data;
export const projectsApi = {
  list: (params?: Params, signal?: AbortSignal) =>
    read<Page<Project>>("/projects", params, signal),
  get: (id: number) => read<Project>(`/projects/${id}`),
  save: (body: { name: string; description: string }, id?: number) =>
    write<Project>(
      id ? "patch" : "post",
      `/projects${id ? `/${id}` : ""}`,
      body,
    ),
  remove: (id: number) => write<null>("delete", `/projects/${id}`),
};
export const tasksApi = {
  list: (id: number | undefined, params?: Params, signal?: AbortSignal) =>
    read<Page<Task>>(
      id ? `/projects/${id}/tasks` : "/users/me/tasks",
      params,
      signal,
    ),
  save: (project: number, body: Partial<TaskInput>, id?: number) =>
    write<Task>(
      id ? "patch" : "post",
      `/projects/${project}/tasks${id ? `/${id}` : ""}`,
      body,
    ),
  remove: (project: number, id: number) =>
    write<null>("delete", `/projects/${project}/tasks/${id}`),
};
export async function allMembers(project: number): Promise<Member[]> {
  const result: Member[] = [];
  let page = 1;
  while (true) {
    const batch = await read<Page<Member>>(`/projects/${project}/members`, {
      page,
      page_size: 100,
    });
    result.push(...batch.items);
    if (result.length >= batch.total) return result;
    page++;
  }
}
export const dashboardApi = () => read<Summary>("/dashboard/summary");
export const meApi = () => read<User>("/users/me");
