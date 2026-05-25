import { familyMemberRouter } from "~/server/api/routers/family-member";
import { inviteRouter } from "~/server/api/routers/invite";
import { mediaRouter } from "~/server/api/routers/media";
import { notificationRouter } from "~/server/api/routers/notification";
import { postRouter } from "~/server/api/routers/post";
import { tagRouter } from "~/server/api/routers/tag";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  familyMember: familyMemberRouter,
  invite: inviteRouter,
  media: mediaRouter,
  notification: notificationRouter,
  post: postRouter,
  tag: tagRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
