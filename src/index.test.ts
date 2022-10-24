import { Instance, types } from "mobx-state-tree"
import { withReferencePool } from "./index"

const TodoModel = types
  .model("TodoModel", {
    id: types.identifier,
    title: types.string,
  })
  .actions((self) => ({
    setTitle(title: string) {
      self.title = title
    },
  }))

// todo references can also be contained in lists
const ListModel = types.model("ListModel", {
  id: types.identifier,
  todos: types.array(types.reference(TodoModel)),
})

type TodoType = Instance<typeof TodoModel>
export interface Todo extends TodoType {}

const MyStore = types
  .model("MyStore", {
    pool: types.array(TodoModel),
    todos: types.array(types.reference(TodoModel)),
    currentTodo: types.maybe(types.reference(TodoModel)),
    counter: types.number,
    lists: types.array(ListModel),
  })
  .extend(withReferencePool(TodoModel))
  .actions((store) => ({
    gc() {
      store.poolGC([store.todos, store.currentTodo, ...store.lists.map((l) => l.todos)])
    },
  }))
  .actions((store) => ({
    addManyTodos(titles: string[]) {
      store.todos.push(...store.addAllToPool(titles.map((title) => ({ id: title, title }))))
    },
    addTodo(title: string) {
      const newTodo = store.addToPool({ id: title, title })
      store.todos.push(newTodo)
    },
    addList(id: string, todos: Todo[]) {
      const newLength = store.lists.push({ id, todos: [] })
      store.lists[newLength - 1].todos.replace(todos)
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

  // Add many todos
  myStore.addManyTodos(["Hello", "World", "Foo", "Bar"])

  // The pool has four todos
  expect(myStore.todos.length).toBe(4)
  expect(myStore.pool.length).toBe(4)

  // the first todo title is "Hello"
  expect(myStore.todos[0].title).toBe("Hello")

  // the third todo title is "Foo"
  expect(myStore.todos[2].title).toBe("Foo")

  // Now add some more todos, and add those to lists
  myStore.addManyTodos(["Sub Todo 1", "Sub Todo 2", "Sub Todo 3"])
  const latestTodos = myStore.todos.slice(-3)

  myStore.addList("Sub Todos", latestTodos)

  // The pool should have seven todos
  expect(myStore.todos.length).toBe(7)
  expect(myStore.pool.length).toBe(7)

  // The new list should have three references to todos
  expect(myStore.lists[0].todos.length).toBe(3)

  // run the gc, and it should stay at 7
  myStore.gc()
  expect(myStore.pool.length).toBe(7)

  // now remove the references to the last 3 from the main todos, but keep them in the new list
  myStore.removeTodo(latestTodos[0])
  myStore.removeTodo(latestTodos[1])
  myStore.removeTodo(latestTodos[2])

  // run the gc, and it should stay at 7
  myStore.gc()
  expect(myStore.pool.length).toBe(7)
})
