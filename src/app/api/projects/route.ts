import { api, body } from "@/server/api";
import { createProject, ProjectInput, listProjectsForUser } from "@/server/services/projects";
export const POST = api(async (req, { session }) => createProject(session!.user.id, await body<ProjectInput>(req)));
export const GET = api(async (_r, { session }) => listProjectsForUser(session!.user.id));
