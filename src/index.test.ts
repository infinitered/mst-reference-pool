import { Instance, types } from "mobx-state-tree"
import { withReferencePool } from "./index"

const TodoModel = types.model("TodoModel", {
  id: types.identifier,
  title: types.string,
})

type TodoType = Instance<typeof TodoModel>
export interface Todo extends TodoType {}

const MyStore = types
  .model("MyStore", {
    pool: types.array(TodoModel),
    todos: types.array(types.reference(TodoModel)),
    currentTodo: types.maybe(types.reference(TodoModel)),
    counter: types.number,
  })
  .extend(withReferencePool(TodoModel))
  .actions((store) => ({
    gc() {
      store.poolGC([store.todos, store.currentTodo])
    },
  }))
  .actions((store) => ({
    addTodo(title: string) {
      const newTodo = store.addToPool({ id: title, title })
      store.todos.push(newTodo)
    },
    setCurrentTodo(todo: Todo) {
      store.currentTodo = todo
    },
    clearCurrentTodo() {
      store.currentTodo = undefined
    },
    removeTodo(todo: Todo) {
      store.todos.remove(todo)
      store.gc()
    },
  }))

test("add todo", () => {
  const myStore = MyStore.create({
    counter: 0,
  })

  // Initially, the store is empty
  expect(myStore.todos.length).toBe(0)
  expect(myStore.pool.length).toBe(0)
  expect(myStore.currentTodo).toBeUndefined()

  // Add a todo
  myStore.addTodo("Hello")
  const hello = myStore.todos[0]

  // The todo is in the store
  expect(myStore.todos.length).toBe(1)
  expect(myStore.pool.length).toBe(1)
  expect(myStore.currentTodo).toBeUndefined()

  // Add another todo
  myStore.addTodo("World")
  const world = myStore.todos[1]

  // Now the store has two todos
  expect(myStore.todos.length).toBe(2)
  expect(myStore.pool.length).toBe(2)
  expect(myStore.currentTodo).toBeUndefined()

  // Set the current todo
  myStore.setCurrentTodo(hello)

  // The current todo is set
  expect(myStore.todos.length).toBe(2)
  expect(myStore.pool.length).toBe(2)
  expect(myStore.currentTodo).toBe(myStore.todos[0])

  // Remove the first todo
  myStore.removeTodo(hello)

  // The first todo is removed but still set to currentTodo
  expect(myStore.todos.length).toBe(1)
  expect(myStore.pool.length).toBe(2)
  expect(myStore.currentTodo).toBe(hello)

  // clearing the current todo doesn't run the GC in this case
  myStore.clearCurrentTodo()

  // The pool still has two todos
  expect(myStore.todos.length).toBe(1) // still 1
  expect(myStore.pool.length).toBe(2) // still 2
  expect(myStore.currentTodo).toBeUndefined()

  // Run the GC
  myStore.gc()

  // Now the pool only has one todo
  expect(myStore.todos.length).toBe(1) // still 1
  expect(myStore.pool.length).toBe(1) // now 1
  expect(myStore.currentTodo).toBeUndefined()

  // Remove the last todo
  myStore.removeTodo(world)

  // The pool is empty
  expect(myStore.todos.length).toBe(0)
  expect(myStore.pool.length).toBe(0) // now 0 because the GC ran
  expect(myStore.currentTodo).toBeUndefined()
})
