import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  resolveFeatureActivations,
  type FamilyFeatureState,
  type FamilyIntegrationState,
} from "~/lib/ffeatures/activation";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const familyScopedInputSchema = z.object({
  familyId: z.string().cuid(),
});

export const ffeaturesRouter = createTRPCRouter({
  listActivations: protectedProcedure
    .input(familyScopedInputSchema)
    .query(async ({ ctx, input }) => {
      const membership = await ctx.db.familyMember.findUnique({
        where: {
          familyId_userId: {
            familyId: input.familyId,
            userId: ctx.session.user.id,
          },
        },
        select: {
          id: true,
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this family",
        });
      }

      const featureStates: FamilyFeatureState[] = await ctx.db.ffeature.findMany({
        where: {
          familyId: input.familyId,
        },
        select: {
          featureKey: true,
          isEnabled: true,
        },
      });

      const integrationStates: FamilyIntegrationState[] = await ctx.db.integrationCredential.findMany({
        where: {
          familyId: input.familyId,
        },
        select: {
          category: true,
          provider: true,
          isEnabled: true,
        },
      });

      const activations = resolveFeatureActivations({
        featureStates,
        integrationStates,
      });

      return {
        activations,
      };
    }),
});
