import Dexie, { type EntityTable } from 'dexie'
import type { Contact, Decision, MetaEntry, Tag } from '@/domain/types'

export class ContactsDB extends Dexie {
  contacts!: EntityTable<Contact, 'id'>
  decisions!: EntityTable<Decision, 'contactId'>
  tags!: EntityTable<Tag, 'name'>
  meta!: EntityTable<MetaEntry, 'key'>

  constructor(name = 'contact-tinder') {
    super(name)
    this.version(1).stores({
      contacts: 'id, displayName, *phoneKeys, *emailKeys, importedAt',
      decisions: 'contactId, bucket, workStatus, relation, updatedAt',
      tags: 'name, count',
      meta: 'key',
    })
  }
}

export const db = new ContactsDB()
