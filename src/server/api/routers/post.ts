import { z } from "zod";
import { TRPCError } from "@trpc/server";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const postRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        caption: z.string().trim().max(5000).optional(),
        type: z.enum(["TEXT", "PHOTO", "VIDEO", "MIXED"]).default("TEXT"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.familyMember.findFirst({
        where: { userId: ctx.session.user.id },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });

      if (!member) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You must be a family member to create a post.",
        });
      }

      return ctx.db.post.create({
        data: {
          caption: input.caption,
          type: input.type,
          authorMember: { connect: { id: member.id } },
        },
      });
    }),

  getLatest: protectedProcedure.query(async ({ ctx }) => {
    const post = await ctx.db.post.findFirst({
      orderBy: { createdAt: "desc" },
      where: { authorMember: { userId: ctx.session.user.id } },
    });

    return post ?? null;
  }),

  getSecretMessage: protectedProcedure.query(() => {
    return "you can now see this secret message!";
  }),
});
