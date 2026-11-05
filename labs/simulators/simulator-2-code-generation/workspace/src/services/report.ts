import { formatDate } from "../utils/formatDate.js";

export function reportLine(label: string, when: Date): string {
  return `${label}: ${formatDate(when)}`;
}
