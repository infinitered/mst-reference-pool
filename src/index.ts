import { IObservableArray, isObservableArray } from "mobx"
import {
  applySnapshot,
  getType,
  IMSTArray,
  Instance,
  IReferenceType,
  IStateTreeNode,
  IAnyComplexType,
} from "mobx-state-tree"

export type WithPoolStore<ObjectType> = IStateTreeNode & {
  pool: IObservableArray<ObjectType>
}

export type PoolGCReferencesList<ModelType extends IAnyComplexType, InstanceType> =
  | IMSTArray<IReferenceType<ModelType>>
  | InstanceType
  | undefined

function _withReferencePool<ModelType extends IAnyComplexType, InstanceType = Instance<ModelType>>(
  store: WithPoolStore<InstanceType>
) {
  return {
    actions: {
      addToPool(object: InstanceType): InstanceType {
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
        return store.pool.find((c) => c[id] === (object as any)[id]) as InstanceType
      },
      addAllToPool(objects: InstanceType[]): InstanceType[] {
        return objects.map(this.addToPool)
      },
      poolGC(references: PoolGCReferencesList<ModelType, InstanceType>[]) {
        if (store.pool.length === 0) return
        const id = getType(store.pool[0]).identifierAttribute || "id"
        store.pool.forEach((item) => {
          const referenceExists = references.some((ref) => {
            // is an array?
            if (isObservableArray(ref) && ref.some((r) => r[id] === item[id])) return true
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

// This function allows us to pass in a model and infer the model type from it
// so we don't have to pass in the model type as a generic parameter
export function withReferencePool<ModelType extends IAnyComplexType>(_model: ModelType) {
  return (store: WithPoolStore<Instance<ModelType>>) => _withReferencePool<ModelType>(store)
}
