import moment from "moment";

export class OrderRepository {
  constructor(db) { this.db = db; }
  async findById(id) { return this.db?.get("orders", id) ?? null; }
  async findSince(date) {
    const rows = (await this.db?.all("orders")) ?? [];
    return rows.filter((r) => moment(r.createdAt).isAfter(date));
  }
}
