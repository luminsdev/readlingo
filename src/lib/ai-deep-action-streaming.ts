import {
  collocationDeepActionResponseSchema,
  compareDeepActionResponseSchema,
  CONJUGATION_FORMS_MAX_COUNT,
  conjugationDeepActionResponseSchema,
  easierExamplesDeepActionResponseSchema,
  STRUCTURE_PATTERN_MAX_LENGTH,
  STRUCTURE_PITFALL_MAX_LENGTH,
  STRUCTURE_REASON_MAX_LENGTH,
  STRUCTURE_ROLE_MAX_LENGTH,
  STRUCTURE_WHY_HERE_MAX_LENGTH,
  structureDeepActionResponseSchema,
  type CollocationDeepActionResponse,
  type CompareDeepActionResponse,
  type ConjugationDeepActionResponse,
  type DeepAction,
  type EasierExamplesDeepActionResponse,
  type StructureDeepActionResponse,
} from "./ai-validation.ts";

export type DeepActionResultByAction = {
  structure: StructureDeepActionResponse;
  compare: CompareDeepActionResponse;
  easierExamples: EasierExamplesDeepActionResponse;
  conjugation: ConjugationDeepActionResponse;
  collocation: CollocationDeepActionResponse;
};

export type DeepActionResult = DeepActionResultByAction[DeepAction];

type StreamingStructureResult = {
  pattern?: string;
  role?: string;
  whyHere?: string;
  pitfall?: string;
  notApplicable?: boolean;
  reason?: string;
};
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
  structure: StreamingStructureResult;
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

function getDeepActionPayload(action: DeepAction, value: unknown) {
  const payload = asObject(value);

  if (action !== "conjugation" || !payload) {
    return payload;
  }

  return asObject(payload.result) ?? payload;
}

function normalizeText(value: unknown, maxLength?: number) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  if (!maxLength || trimmedValue.length <= maxLength) {
    return trimmedValue;
  }

  const sliceAtCodePointBoundary = (end: number) => {
    const slicedValue = trimmedValue.slice(0, end);

    return /[\uD800-\uDBFF]$/.test(slicedValue)
      ? slicedValue.slice(0, -1)
      : slicedValue;
  };
  const boundaryCandidate = sliceAtCodePointBoundary(maxLength);
  let sentenceEnd = -1;

  for (const match of boundaryCandidate.matchAll(/[.?!…]/g)) {
    const nextCharacter = trimmedValue[match.index + 1];

    if (nextCharacter === undefined || /\s/.test(nextCharacter)) {
      sentenceEnd = match.index;
    }
  }

  if (sentenceEnd >= Math.floor(maxLength / 2)) {
    return boundaryCandidate.slice(0, sentenceEnd + 1).trimEnd();
  }

  const contentLimit = Math.max(0, maxLength - 1);
  const candidate = sliceAtCodePointBoundary(contentLimit);
  const whitespaceIndex = candidate.search(/\s\S*$/);
  const boundary = whitespaceIndex > 0 ? whitespaceIndex : contentLimit;
  const truncatedValue = candidate.slice(0, boundary).trimEnd();
  const nextCharacter = trimmedValue[truncatedValue.length];
  const endsAtTerminalBoundary =
    /[.?!…]$/.test(truncatedValue) &&
    (nextCharacter === undefined || /\s/.test(nextCharacter));

  return endsAtTerminalBoundary ? truncatedValue : `${truncatedValue}…`;
}

function normalizeStructureText(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalizedValue = value.trim().replace(/\s+/g, " ");

  return normalizedValue || undefined;
}

function normalizeCompleteStructureText(value: unknown, maxLength: number) {
  const normalizedValue = normalizeStructureText(value);

  if (!normalizedValue || !/[\p{L}\p{N}]/u.test(normalizedValue)) {
    return undefined;
  }

  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  let terminalBoundary = -1;

  for (const match of normalizedValue.matchAll(/[.!?…]/g)) {
    if (match.index >= maxLength) {
      break;
    }

    const nextCharacter = normalizedValue[match.index + 1];

    if (nextCharacter === undefined || /\s/.test(nextCharacter)) {
      terminalBoundary = match.index;
    }
  }

  const completeValue =
    terminalBoundary >= 0
      ? normalizedValue.slice(0, terminalBoundary + 1)
      : undefined;

  return completeValue && /[\p{L}\p{N}]/u.test(completeValue)
    ? completeValue
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
  const payload = getDeepActionPayload(action, value);

  if (!payload) {
    return null;
  }

  const status = normalizeStatus(
    payload,
    action === "structure" ? STRUCTURE_REASON_MAX_LENGTH : undefined,
  );
  let result: StreamingDeepActionResult;

  switch (action) {
    case "structure": {
      result = {
        ...status,
        ...(normalizeStructureText(payload.pattern)
          ? {
              pattern: normalizeText(
                normalizeStructureText(payload.pattern),
                STRUCTURE_PATTERN_MAX_LENGTH,
              ),
            }
          : {}),
        ...(normalizeStructureText(payload.role)
          ? {
              role: normalizeText(
                normalizeStructureText(payload.role),
                STRUCTURE_ROLE_MAX_LENGTH,
              ),
            }
          : {}),
        ...(normalizeStructureText(payload.whyHere)
          ? {
              whyHere: normalizeText(
                normalizeStructureText(payload.whyHere),
                STRUCTURE_WHY_HERE_MAX_LENGTH,
              ),
            }
          : {}),
        ...(normalizeStructureText(payload.pitfall)
          ? {
              pitfall: normalizeText(
                normalizeStructureText(payload.pitfall),
                STRUCTURE_PITFALL_MAX_LENGTH,
              ),
            }
          : {}),
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
            .slice(0, CONJUGATION_FORMS_MAX_COUNT)
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
    structure: structureDeepActionResponseSchema,
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
  const payload = getDeepActionPayload(action, value);

  if (!payload) {
    return null;
  }

  if (action === "structure") {
    if (payload.notApplicable === true) {
      if (
        ["pattern", "role", "whyHere", "pitfall"].some((field) =>
          Object.prototype.hasOwnProperty.call(payload, field),
        )
      ) {
        return null;
      }

      const reason = normalizeCompleteStructureText(
        payload.reason,
        STRUCTURE_REASON_MAX_LENGTH,
      );

      return reason
        ? parseReadyDeepActionResult(action, {
            notApplicable: true,
            reason,
          })
        : null;
    }

    if (
      Object.prototype.hasOwnProperty.call(payload, "notApplicable") &&
      payload.notApplicable !== false
    ) {
      return null;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "reason")) {
      return null;
    }

    const pattern = normalizeCompleteStructureText(
      payload.pattern,
      STRUCTURE_PATTERN_MAX_LENGTH,
    );
    const role = normalizeCompleteStructureText(
      payload.role,
      STRUCTURE_ROLE_MAX_LENGTH,
    );
    const whyHere = normalizeCompleteStructureText(
      payload.whyHere,
      STRUCTURE_WHY_HERE_MAX_LENGTH,
    );

    if (!pattern || !role || !whyHere) {
      return null;
    }

    const pitfall = normalizeCompleteStructureText(
      payload.pitfall,
      STRUCTURE_PITFALL_MAX_LENGTH,
    );

    return parseReadyDeepActionResult(action, {
      pattern,
      role,
      whyHere,
      ...(pitfall ? { pitfall } : {}),
    });
  }

  const partialResult = buildStreamingDeepActionResult(action, value);

  if (!partialResult) {
    return null;
  }

  if (partialResult.notApplicable && partialResult.reason) {
    return parseReadyDeepActionResult(action, {
      notApplicable: true,
      reason: partialResult.reason,
    });
  }

  let normalizedResult: unknown;

  switch (action) {
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
      const forms = normalizeCompleteRows(
        payload.forms,
        ["label", "value"],
        CONJUGATION_FORMS_MAX_COUNT,
      );

      normalizedResult = forms.length
        ? {
            ...(conjugation.lemma ? { lemma: conjugation.lemma } : {}),
            forms,
            ...(conjugation.note ? { note: conjugation.note } : {}),
          }
        : {};
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
  if (
    (action === "structure" || action === "conjugation") &&
    parsedResult.state !== "successful-parse"
  ) {
    return null;
  }

  return normalizeDeepActionResult(action, parsedResult.value);
}
