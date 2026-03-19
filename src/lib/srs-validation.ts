import { z } from "zod";

import { SRS_RATING_VALUES } from "./srs.ts";
import { vocabularyIdSchema } from "./vocabulary-validation.ts";

export const srsRatingSchema = z.enum(SRS_RATING_VALUES);

export const reviewSubmitSchema = z.object({
  vocabularyId: vocabularyIdSchema,
  rating: srsRatingSchema,
});

export type SRSRatingInput = z.infer<typeof srsRatingSchema>;
export type ReviewSubmitInput = z.infer<typeof reviewSubmitSchema>;
