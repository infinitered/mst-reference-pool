import { IObservableArray, isObservableArray } from "mobx"
import {
  applySnapshot,
  getType,
  IAnyModelType,
  IAnyType,
  Instance,
  IStateTreeNode,
} from "mobx-state-tree"

export type WithPoolStore<ObjectType> = IStateTreeNode & {
  pool: IObservableArray<ObjectType>
}

export function withPool<ObjectType extends IStateTreeNode = IStateTreeNode>(
  store: WithPoolStore<ObjectType>
) {
  return {
    actions: {
      addToPool(object: ObjectType) {
        if (store.pool.length === 0) {
          // If the cache is empty, we don't need to check if this already exists
          store.pool.push(object)
        } else {
          // What is the identifier key? (usually, but not always, `id`)
          const id = getType(store.pool[0]).identifierAttribute || "id"
          const existing = store.pool.find((c) => c[id] === object[id])
          if (existing) {
            applySnapshot(existing, object)
          } else {
            store.pool.push(object)
          }
        }
        // Get the identifier key again, in case this was the first cache object
        const id = getType(store.pool[0]).identifierAttribute || "id"
        return store.pool.find(
          (c) => c[id] === (object as any)[id]
        ) as ObjectType
      },
      addAllToPool(objects: ObjectType[]): ObjectType[] {
        return objects.map(this.addToPool)
      },
      poolGC(references: any[]) {
        if (store.pool.length === 0) return
        const id = getType(store.pool[0]).identifierAttribute || "id"
        store.pool.forEach((item) => {
          const referenceExists = references.some((ref) => {
            // is an array?
            if (isObservableArray(ref) && ref.some((r) => r[id] === item[id]))
              return true
            // is a reference?
            if (ref && ref[id] === item[id]) return true
            // not here, move along
            return false
          })
          if (!referenceExists) {
            store.pool.remove(item)
          }
        })
      },
    },
  }
}

export function withReferencePool(model: IAnyModelType) {
  return (store: WithPoolStore<IStateTreeNode<IAnyType>>) =>
    withPool<Instance<typeof model>>(store)
}
