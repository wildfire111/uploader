// The one way card names are compared: case, accents, hyphens and spacing don't matter.

export const FACE_SEPARATOR = " // ";

export function normaliseCardName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/-/g, " ")
    .replace(/\s*\/{1,2}\s*/g, " // ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// the normalised names of each face: "Fire/Ice" -> ["fire", "ice"]; a single-faced card has one
export function cardFaces(name: string): string[] {
  return normaliseCardName(name).split(FACE_SEPARATOR);
}

// a double-faced, split or adventure card is usually written by its front face alone
export function frontFace(name: string): string {
  return cardFaces(name)[0];
}
