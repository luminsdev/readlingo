import {
  collocationDeepActionResponseSchema,
  compareDeepActionResponseSchema,
  conjugationDeepActionResponseSchema,
  easierExamplesDeepActionResponseSchema,
  GRAMMAR_POINT_MAX_LENGTH,
  GRAMMAR_REASON_MAX_LENGTH,
  GRAMMAR_SUMMARY_MAX_LENGTH,
  grammarDeepActionResponseSchema,
  type CollocationDeepActionResponse,
  type CompareDeepActionResponse,
  type ConjugationDeepActionResponse,
  type DeepAction,
  type EasierExamplesDeepActionResponse,
  type GrammarDeepActionResponse,
} from "./ai-validation.ts";

export type DeepActionResultByAction = {
  grammar: GrammarDeepActionResponse;
  compare: CompareDeepActionResponse;
  easierExamples: EasierExamplesDeepActionResponse;
  conjugation: ConjugationDeepActionResponse;
  collocation: CollocationDeepActionResponse;
};

export type DeepActionResult = DeepActionResultByAction[DeepAction];

type StreamingGrammarResult = Partial<GrammarDeepActionResponse>;
type StreamingCompareResult = Partial<CompareDeepActionResponse>;
type StreamingEasierExamplesResult = {
  examples?: Array<{
    sentence?: string;
    translation?: string;
  }>;
  note?: string;
  notApplicable?: boolean;
  reason?: string;
};
type StreamingConjugationResult = {
  lemma?: string;
  forms?: Array<{
    label?: string;
    value?: string;
  }>;
  note?: string;
  notApplicable?: boolean;
  reason?: string;
};
type StreamingCollocationResult = {
  items?: Array<{
    phrase?: string;
    translation?: string;
    note?: string;
  }>;
  notApplicable?: boolean;
  reason?: string;
};

export type StreamingDeepActionResultByAction = {
  grammar: StreamingGrammarResult;
  compare: StreamingCompareResult;
  easierExamples: StreamingEasierExamplesResult;
  conjugation: StreamingConjugationResult;
  collocation: StreamingCollocationResult;
};

export type StreamingDeepActionResult =
  StreamingDeepActionResultByAction[DeepAction];

export type DeepActionUiState<A extends DeepAction = DeepAction> = {
  status: "idle" | "loading" | "ready" | "error";
  result: StreamingDeepActionResultByAction[A] | null;
  errorMessage: string | null;
};

export type DeepActionUiStates = {
  [A in DeepAction]: DeepActionUiState<A>;
};

const CONJUGATION_NOT_APPLICABLE_REASON =
  "Kh\u00f4ng c\u00f3 d\u1ea1ng chia h\u1eefu \u00edch cho l\u1ef1a ch\u1ecdn n\u00e0y.";

export function buildDeepActionErrorState<A extends DeepAction>(
  currentState: DeepActionUiState<A>,
  errorMessage: string,
): DeepActionUiState<A> {
  return {
    status: "error",
    result: currentState.result,
    errorMessage,
  };
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeText(value: unknown, maxLength?: number) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue
    ? trimmedValue.slice(0, maxLength ?? trimmedValue.length)
    : undefined;
}

function normalizeStatus(
  payload: Record<string, unknown>,
  reasonMaxLength?: number,
) {
  const reason = normalizeText(payload.reason, reasonMaxLength);

  return {
    ...(typeof payload.notApplicable === "boolean" &&
    (!payload.notApplicable || reason)
      ? { notApplicable: payload.notApplicable }
      : {}),
    ...(reason ? { reason } : {}),
  };
}

function hasContent(value: object) {
  return Object.keys(value).length > 0;
}

function normalizeCompleteRows(
  value: unknown,
  requiredFields: string[],
  limit: number,
  optionalFields: string[] = [],
) {
  if (!Array.isArray(value)) {
    return [];
  }

  const fields = [...requiredFields, ...optionalFields];

  return value
    .flatMap((entry) => {
      const source = asObject(entry);

      if (!source) {
        return [];
      }

      const row: Record<string, string> = {};

      for (const field of fields) {
        const text = normalizeText(source[field]);

        if (text) {
          row[field] = text;
        }
      }

      return requiredFields.every((field) => row[field]) ? [row] : [];
    })
    .slice(0, limit);
}

export function buildStreamingDeepActionResult<A extends DeepAction>(
  action: A,
  value: unknown,
): StreamingDeepActionResultByAction[A] | null {
  const payload = asObject(value);

  if (!payload) {
    return null;
  }

  const status = normalizeStatus(
    payload,
    action === "grammar" ? GRAMMAR_REASON_MAX_LENGTH : undefined,
  );
  let result: StreamingDeepActionResult;

  switch (action) {
    case "grammar": {
      const points = Array.isArray(payload.points)
        ? payload.points
            .map((point) => normalizeText(point, GRAMMAR_POINT_MAX_LENGTH))
            .filter((point): point is string => Boolean(point))
            .slice(0, 5)
        : [];
      const summary = normalizeText(
        payload.summary,
        GRAMMAR_SUMMARY_MAX_LENGTH,
      );

      result = {
        ...status,
        ...(summary ? { summary } : {}),
        ...(points.length > 0 ? { points } : {}),
      };
      break;
    }
    case "compare":
      result = {
        ...status,
        ...(normalizeText(payload.alternative)
          ? { alternative: normalizeText(payload.alternative) }
          : {}),
        ...(normalizeText(payload.contrast)
          ? { contrast: normalizeText(payload.contrast) }
          : {}),
        ...(normalizeText(payload.tip)
          ? { tip: normalizeText(payload.tip) }
          : {}),
      };
      break;
    case "easierExamples": {
      const examples = Array.isArray(payload.examples)
        ? payload.examples
            .map((value) => {
              const example = asObject(value);

              if (!example) {
                return null;
              }

              const normalizedExample = {
                ...(normalizeText(example.sentence)
                  ? { sentence: normalizeText(example.sentence) }
                  : {}),
                ...(normalizeText(example.translation)
                  ? { translation: normalizeText(example.translation) }
                  : {}),
              };

              return hasContent(normalizedExample) ? normalizedExample : null;
            })
            .filter((example): example is NonNullable<typeof example> =>
              Boolean(example),
            )
            .slice(0, 2)
        : [];

      result = {
        ...status,
        ...(examples.length > 0 ? { examples } : {}),
        ...(normalizeText(payload.note)
          ? { note: normalizeText(payload.note) }
          : {}),
      };
      break;
    }
    case "conjugation": {
      const forms = Array.isArray(payload.forms)
        ? payload.forms
            .map((value) => {
              const form = asObject(value);

              if (!form) {
                return null;
              }

              const normalizedForm = {
                ...(normalizeText(form.label)
                  ? { label: normalizeText(form.label) }
                  : {}),
                ...(normalizeText(form.value)
                  ? { value: normalizeText(form.value) }
                  : {}),
              };

              return hasContent(normalizedForm) ? normalizedForm : null;
            })
            .filter((form): form is NonNullable<typeof form> => Boolean(form))
            .slice(0, 8)
        : [];

      result = {
        ...status,
        ...(normalizeText(payload.lemma)
          ? { lemma: normalizeText(payload.lemma) }
          : {}),
        ...(forms.length > 0 ? { forms } : {}),
        ...(normalizeText(payload.note)
          ? { note: normalizeText(payload.note) }
          : {}),
      };
      break;
    }
    case "collocation": {
      const items = Array.isArray(payload.items)
        ? payload.items
            .map((value) => {
              const item = asObject(value);

              if (!item) {
                return null;
              }

              const normalizedItem = {
                ...(normalizeText(item.phrase)
                  ? { phrase: normalizeText(item.phrase) }
                  : {}),
                ...(normalizeText(item.translation)
                  ? { translation: normalizeText(item.translation) }
                  : {}),
                ...(normalizeText(item.note)
                  ? { note: normalizeText(item.note) }
                  : {}),
              };

              return hasContent(normalizedItem) ? normalizedItem : null;
            })
            .filter((item): item is NonNullable<typeof item> => Boolean(item))
            .slice(0, 5)
        : [];

      result = {
        ...status,
        ...(items.length > 0 ? { items } : {}),
      };
      break;
    }
  }

  return hasContent(result)
    ? (result as StreamingDeepActionResultByAction[A])
    : null;
}

export function parseReadyDeepActionResult<A extends DeepAction>(
  action: A,
  value: unknown,
): DeepActionResultByAction[A] | null {
  const schema = {
    grammar: grammarDeepActionResponseSchema,
    compare: compareDeepActionResponseSchema,
    easierExamples: easierExamplesDeepActionResponseSchema,
    conjugation: conjugationDeepActionResponseSchema,
    collocation: collocationDeepActionResponseSchema,
  }[action];
  const parsedResult = schema.safeParse(value);

  return parsedResult.success
    ? (parsedResult.data as DeepActionResultByAction[A])
    : null;
}

export function normalizeDeepActionResult<A extends DeepAction>(
  action: A,
  value: unknown,
): DeepActionResultByAction[A] | null {
  const payload = asObject(value);

  if (!payload) {
    return null;
  }

  const partialResult = buildStreamingDeepActionResult(action, value);

  if (!partialResult) {
    return action === "conjugation"
      ? parseReadyDeepActionResult(action, {
          notApplicable: true,
          reason: CONJUGATION_NOT_APPLICABLE_REASON,
        })
      : null;
  }

  if (partialResult.notApplicable && partialResult.reason) {
    return parseReadyDeepActionResult(action, {
      notApplicable: true,
      reason: partialResult.reason,
    });
  }

  let normalizedResult: unknown;

  switch (action) {
    case "grammar": {
      const grammar =
        partialResult as StreamingDeepActionResultByAction["grammar"];
      normalizedResult = {
        ...(grammar.summary ? { summary: grammar.summary } : {}),
        ...(grammar.points?.length ? { points: grammar.points } : {}),
      };
      break;
    }
    case "compare": {
      const comparison =
        partialResult as StreamingDeepActionResultByAction["compare"];
      normalizedResult = {
        ...(comparison.alternative
          ? { alternative: comparison.alternative }
          : {}),
        ...(comparison.contrast ? { contrast: comparison.contrast } : {}),
        ...(comparison.tip ? { tip: comparison.tip } : {}),
      };
      break;
    }
    case "easierExamples": {
      const easierExamples =
        partialResult as StreamingDeepActionResultByAction["easierExamples"];
      const examples = normalizeCompleteRows(
        payload.examples,
        ["sentence", "translation"],
        2,
      );
      normalizedResult = {
        ...(examples.length ? { examples } : {}),
        ...(easierExamples.note ? { note: easierExamples.note } : {}),
      };
      break;
    }
    case "conjugation": {
      const conjugation =
        partialResult as StreamingDeepActionResultByAction["conjugation"];
      const forms = normalizeCompleteRows(payload.forms, ["label", "value"], 8);

      normalizedResult = forms.length
        ? {
            ...(conjugation.lemma ? { lemma: conjugation.lemma } : {}),
            forms,
            ...(conjugation.note ? { note: conjugation.note } : {}),
          }
        : {
            notApplicable: true,
            reason: CONJUGATION_NOT_APPLICABLE_REASON,
          };
      break;
    }
    case "collocation": {
      const items = normalizeCompleteRows(
        payload.items,
        ["phrase", "translation"],
        5,
        ["note"],
      );
      normalizedResult = items.length ? { items } : {};
      break;
    }
  }

  return parseReadyDeepActionResult(action, normalizedResult);
}

export function parseCompletedDeepActionResult<A extends DeepAction>(
  action: A,
  parsedResult: { value: unknown; state: string },
): DeepActionResultByAction[A] | null {
  return parsedResult.state === "successful-parse"
    ? normalizeDeepActionResult(action, parsedResult.value)
    : null;
}
