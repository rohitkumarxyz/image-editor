import { MongoServerError, ObjectId } from 'mongodb'
import type { Database, UserDoc } from '../../db.ts'

const DUPLICATE_KEY = 11000

export class UsersRepo {
  private readonly db: Database

  constructor(db: Database) {
    this.db = db
  }

  async create(input: { email: string; name: string; googleId: string }): Promise<UserDoc | null> {
    const user: UserDoc = { _id: new ObjectId(), ...input, credits: 0, appliedRefs: [], createdAt: new Date() }
    try {
      await this.db.users.insertOne(user)
      return user
    } catch (err) {
      if (err instanceof MongoServerError && err.code === DUPLICATE_KEY) return null
      throw err
    }
  }

  findByEmail(email: string): Promise<UserDoc | null> {
    return this.db.users.findOne({ email })
  }

  findById(id: ObjectId): Promise<UserDoc | null> {
    return this.db.users.findOne({ _id: id })
  }

  updateName(id: ObjectId, name: string): Promise<UserDoc | null> {
    return this.db.users.findOneAndUpdate({ _id: id }, { $set: { name } }, { returnDocument: 'after' })
  }

  async updatePhone(id: ObjectId, phone: string): Promise<void> {
    await this.db.users.updateOne({ _id: id }, { $set: { phone } })
  }

  async setGoogleId(id: ObjectId, googleId: string): Promise<void> {
    await this.db.users.updateOne({ _id: id }, { $set: { googleId } })
  }

  async delete(id: ObjectId): Promise<void> {
    await this.db.users.deleteOne({ _id: id })
  }
}
