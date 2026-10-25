import assert from "node:assert/strict";
import test from "node:test";
import { editDistance, normalizeWords, scoreWords } from "./metrics.mjs";

test("normalization preserves Malayalam words and removes punctuation", () => {
  assert.deepEqual(normalizeWords("അത്... പിന്നെ, മതി!"), ["അത്", "പിന്നെ", "മതി"]);
});

test("edit distance counts insertion, deletion, and substitution", () => {
  assert.equal(editDistance(["a", "b"], ["a", "x", "b"]), 1);
  assert.equal(editDistance(["a", "b"], ["a"]), 1);
  assert.equal(editDistance(["a"], ["b"]), 1);
});

test("word error rate uses reference word count", () => {
  assert.deepEqual(scoreWords("ഒന്ന് രണ്ട് മൂന്ന്", "ഒന്ന് നാല് മൂന്ന്"), {
    wordEdits: 1,
    referenceWordCount: 3,
    wordErrorRate: 1 / 3,
  });
});
