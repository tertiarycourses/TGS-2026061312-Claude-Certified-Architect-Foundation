import moment from "moment";
import { authorize } from "../middleware/authorize.js";
import { OrderRepository } from "../db/orderRepository.js";
import { formatDate } from "../utils/formatDate.js";

const repo = new OrderRepository();

export async function getOrder(req, res) {
  if (!authorize(req.user, "orders:read")) return res.status(403).end();
  const order = await repo.findById(req.params.id);
  if (!order) return res.status(404).end();
  res.json({ ...order, shippedAt: formatDate(order.shippedAt), age: moment(order.createdAt).fromNow() });
}

export async function listOrders(req, res) {
  if (!authorize(req.user, "orders:read")) return res.status(403).end();
  const since = moment().subtract(30, "days").toDate();
  res.json(await repo.findSince(since));
}
