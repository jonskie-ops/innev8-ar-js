import clips from "./voice-clips.json";

/**
 * How a line is matched to its clip's file name: letters and numbers only, so punctuation a file
 * name can't hold (? : ") doesn't matter. scripts/voice.mjs matches the same way.
 */
export const voiceKey = (text: string) =>
  text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Qufoo's recorded clip for a line, if there is one (added with scripts/voice.mjs). */
export const voiceFor = (text: string): string | undefined => (clips as Record<string, string>)[voiceKey(text)];

/** Any one of the clips (to get the phone's go-ahead for sound with the first tap). */
export const anyClip: string | undefined = Object.values(clips)[0];
