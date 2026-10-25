export function normalizeWords(text: string): string[] {
  return text
    .normalize("NFC")
    .toLocaleLowerCase("ml-IN")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
}

function editDistance(left: string[], right: string[]): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const old = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      diagonal = old;
    }
  }
  return previous[right.length];
}

export function scoreWords(reference: string, prediction: string) {
  const referenceWords = normalizeWords(reference);
  const predictedWords = normalizeWords(prediction);
  const wordEdits = editDistance(referenceWords, predictedWords);
  return {
    wordEdits,
    referenceWordCount: referenceWords.length,
    wordErrorRate: referenceWords.length ? wordEdits / referenceWords.length : null,
  };
}
