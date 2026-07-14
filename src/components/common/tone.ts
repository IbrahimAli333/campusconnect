import { palette } from "../../styles/theme";

export type ChipTone = "green" | "blue" | "amber" | "red" | "violet" | "slate";
export type StatTone = "blue" | "green" | "amber" | "violet";

export function getTone(tone: StatTone) {
  switch (tone) {
    case "green":
      return { soft: palette.greenSoft, strong: palette.green };
    case "amber":
      return { soft: palette.amberSoft, strong: palette.amber };
    case "violet":
      return { soft: palette.violetSoft, strong: palette.violet };
    case "blue":
    default:
      return { soft: palette.blueSoft, strong: palette.blue };
  }
}

export function chipTone(tone: ChipTone) {
  switch (tone) {
    case "green":
      return { soft: palette.greenSoft, strong: palette.green, border: "#B5E0C6" };
    case "blue":
      return { soft: palette.blueSoft, strong: palette.blue, border: "#C9DAF5" };
    case "amber":
      return { soft: palette.amberSoft, strong: palette.amber, border: "#F1D492" };
    case "red":
      return { soft: palette.redSoft, strong: palette.red, border: "#F6C4C2" };
    case "violet":
      return { soft: palette.violetSoft, strong: palette.violet, border: "#D9CAFB" };
    case "slate":
    default:
      return { soft: palette.surfaceAlt, strong: palette.muted, border: palette.border };
  }
}
