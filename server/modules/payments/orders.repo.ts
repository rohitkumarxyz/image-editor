import { ObjectId } from 'mongodb'
import type { Database, OrderDoc } from '../../db.ts'

export class OrdersRepo {
  private readonly db: Database

  constructor(db: Database) {
    this.db = db
  }

  async create(input: Omit<OrderDoc, '_id' | 'status' | 'paymentId' | 'createdAt' | 'paidAt'>): Promise<OrderDoc> {
    const order: OrderDoc = { _id: new ObjectId(), ...input, status: 'created', paymentId: null, createdAt: new Date(), paidAt: null }
    await this.db.orders.insertOne(order)
    return order
  }

  findByOrderId(orderId: string): Promise<OrderDoc | null> {
    if (!ObjectId.isValid(orderId) || String(new ObjectId(orderId)) !== orderId) return Promise.resolve(null)
    return this.db.orders.findOne({ _id: new ObjectId(orderId) })
  }

  async markPaid(id: ObjectId, paymentId: string): Promise<void> {
    await this.db.orders.updateOne({ _id: id, status: 'created' }, { $set: { status: 'paid', paymentId, paidAt: new Date() } })
  }
}
