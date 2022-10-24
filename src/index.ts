import { IObservableArray, isObservableArray } from "mobx"
import {
  applySnapshot,
  getType,
  IMSTArray,
  Instance,
  IReferenceType,
  IStateTreeNode,
  IAnyModelType,
  SnapshotIn,
  resolveIdentifier,
} from "mobx-state-tree"

export type WithPoolStore<ObjectType> = IStateTreeNode & {
  pool: IObservableArray<ObjectType>
}

export type PoolGCReferencesList<ModelType extends IAnyModelType, InstanceType> =
  | IMSTArray<IReferenceType<ModelType>>
  | Array<IReferenceType<ModelType>>
  | InstanceType
  | undefined

function _withReferencePool<ModelType extends IAnyModelType, InstanceType = Instance<ModelType>>(
  store: WithPoolStore<InstanceType>,
  model: ModelType
) {
  return {
    actions: {
      addToPool(object: SnapshotIn<InstanceType>): InstanceType {
        if (store.pool.length === 0) {
          // If the cache is empty, we don't need to check if this already exists
          store.pool.push(object)
          // We know where it lives -- first element now
          return store.pool[0]
        }

        // What is the identifier key? (usually, but not always, `id`)
        const idKey = getType(store.pool[0]).identifierAttribute || "id"
        const id = object[idKey]

        // Does this exist already?
        let existing = resolveIdentifier(model, store.pool, id)
        if (existing) {
          applySnapshot(existing, object)
        } else {
          // Nope -- add it
          store.pool.push(object)

          // We know where it lives -- last element now
          existing = store.pool[store.pool.length - 1]
        }

        return existing
      },
      addAllToPool(objects: SnapshotIn<InstanceType>[]): InstanceType[] {
        // TODO: optimize this, as it's quite wasteful now
        return objects.map(this.addToPool)
      },
      poolGC(references: PoolGCReferencesList<ModelType, InstanceType>[]) {
        // if there's nothing in the pool, no need to GC -- nope out of here
        if (store.pool.length === 0) return

        // what is the id attribute? probably "id", but not always
        const idAttribute = getType(store.pool[0]).identifierAttribute || "id"

        // let's check there are any references out there pointing to each item in the pool
        store.pool.forEach((item) => {
          const referenceExists = references.some((ref) => {
            // is an observable array or regular array?
            if (isObservableArray(ref) || Array.isArray(ref)) {
              // see if it exists in the array somewhere -- if so, we need to keep it
              if (ref.some((r) => r[idAttribute] === item[idAttribute])) return true
            }

            // is a reference?
            if (ref && ref[idAttribute] === item[idAttribute]) return true

            // not here, move along
            return false
          })

          // No references exist, so zap it
          if (!referenceExists) store.pool.remove(item)
        })
      },
    },
  }
}

// This function allows us to pass in a model and infer the model type from it
// so we don't have to pass in the model type as a generic parameter
export function withReferencePool<ModelType extends IAnyModelType>(model: ModelType) {
  return (store: WithPoolStore<Instance<ModelType>>) => _withReferencePool<ModelType>(store, model)
}
