/**
 * Incremental sentence splitter that splits incoming text on punctuation boundaries
 * including standard English punctuation (. ! ?) and Malayalam danda (\u0964, \u0965).
 */

export class SentenceSplitter {
  private buffer = "";
  private seq = 0;

  public push(chunk: string): Array<{ sentence: string; seq: number }> {
    this.buffer += chunk;
    const sentences: Array<{ sentence: string; seq: number }> = [];

    // Split on punctuation followed by whitespace or end of line
    const regex = /(?<=[.!?\u0964\u0965\n])\s+/g;
    let match: RegExpExecArray | null;
    let lastIndex = 0;

    while ((match = regex.exec(this.buffer)) !== null) {
      const sentence = this.buffer.slice(lastIndex, match.index).trim();
      lastIndex = regex.lastIndex;
      if (sentence) {
        sentences.push({ sentence, seq: this.seq++ });
      }
    }

    if (lastIndex > 0) {
      this.buffer = this.buffer.slice(lastIndex);
    }

    return sentences;
  }

  public flush(): Array<{ sentence: string; seq: number }> {
    const remaining = this.buffer.trim();
    this.buffer = "";
    if (remaining) {
      return [{ sentence: remaining, seq: this.seq++ }];
    }
    return [];
  }
}
