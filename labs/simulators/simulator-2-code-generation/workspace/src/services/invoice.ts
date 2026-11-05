import moment from "moment";
import { formatDate } from "../utils/formatDate.js";

export interface Invoice { id: string; issuedAt: Date; dueAt: Date | null; }

export function renderInvoiceHeader(inv: Invoice): string {
  return `${inv.id} issued ${formatDate(inv.issuedAt)} due ${formatDate(inv.dueAt)}`;
}

export function isOverdue(inv: Invoice): boolean {
  return inv.dueAt !== null && moment(inv.dueAt).isBefore(moment());
}
