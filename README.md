# MST Reference Pool

`mst-reference-pool` is a [MobX-State-Tree](https://mobx-state-tree.js.org) extension that allows you to use references to a pool of model instances in any store.

Think of it like a hidden `types.array` that you can point references to, plus a garbage collector to get rid of any instances that nothing is referencing anymore.

## When would you use mst-reference-pool?

Whenever you have a frequently-changing array of instances and also have other references to those instances, `mst-reference-pool` becomes a good option.

Let's look at an example ... say, an Instagram-like app. There's a feed of posts and also an optional `currentPost`.

```ts
import { types } from "mobx-state-tree"
import { PostModel } from "./post"

const RootStore = types
  .model("RootStore", {
    feed: types.array(PostModel),
    currentPost: types.maybe(types.reference(PostModel)),
  })
  .actions((store) => ({
    setFeed(newPosts) {
      store.feed.replace(newPosts)
    },
    setCurrentPost(newPost) {
      store.currentPost = newPost
    },
  }))
```

The thing with the feed is that you could scroll or refresh, and then the `currentPost` would refer to a post that is no longer in the feed. This causes a reference error.

You might think you could make the `currentPost` into its own `types.maybe(PostModel)`, but when that post is in view for both the `feed` and the `currentPost`, now you have duplicate data (and identifiers).

This is where `mst-reference-pool` shines!

## Implementing mst-reference-pool

Taking our Instagram-like app above, let's convert it to use a reference pool.

```diff
import { types } from "mobx-state-tree"
+import { withReferencePool } from "mst-reference-pool"
import { PostModel } from "./post"

const RootStore = types
  .model("RootStore", {
+   pool: types.array(PostModel),
    feed: types.array(types.reference(PostModel)),
    currentPost: types.maybe(types.reference(PostModel)),
  })
+ .extend(withReferencePool(PostModel))
  .actions((store) => ({
    setFeed(newPosts) {
+     const posts = store.addAllToPool(newPosts)
      store.feed.replace(posts)
    },
    setCurrentPost(newPost) {
+     const post = store.addToPool(newPost)
      store.currentPost = post
    },
  }))
```

As you can see here, the primary difference is that we now have a `pool` prop that contains the posts, and everything else is just a reference to those posts.

Before we set the `feed`, we add the new posts to the pool with `store.addAllToPool`, and then use those to establish the references.

We can do the same for a single reference. We just do `store.addToPool` and then set the reference.

These references will always point to one instance in the pool. If `addToPool` or `addAllToPool` find an existing instance with the same identifier, they'll run `applySnapshot` on that instance instead. This prevents duplicate items in your pool.

## Garbage Collection

This is great, but without garbage collection, the pool will grow unbounded as the user scrolls through their feed. This is where the pool GC (garbage collector) comes in.

Add this action to your model, and pass into `poolGC` any property where these posts might have a reference.

```ts
.actions((store) => ({
  gc() {
    store.poolGC([
      store.feed,
      store.currentPost,
      // perhaps some other store as well?
      // search results is a common one
      store.searchStore.filteredPosts
    ])
  }
}))
```

The GC is pretty fast, but you might not need to run it after every action. Generally, you'll run the GC anytime you do a larger refresh of your data. You can also run it anytime you remove or replace items from a list or property. Or, if you want, you could just run it every so often on a timer. It's up to you and what your project needs.

I recommend mainly doing it after a refresh.

```ts
.actions((store) => ({
  setFeed(newPosts) {
    const posts = store.addAllToPool(newPosts)
    store.feed.replace(posts)
    store.gc()
  },
}))
```

## Limitations

Currently, you can only have one reference pool per store. So, if you want more than one reference pool, just make additional stores per model type.

Example:

```ts
const FeedStore = types
  .model("FeedStore", {
    pool: types.array(PostModel),
    feed: types.array(types.reference(PostModel)),
  })
  .extend(withReferencePool(PostModel))

const UserStore = types
  .model("UserStore", {
    pool: types.array(UserModel),
    users: types.array(types.reference(UserModel)),
  })
  .extend(withReferencePool(UserModel))

const RootStore = types.model("RootStore", {
  feedStore: FeedStore,
  userStore: UserStore,
})
```

You can use a pool across multiple stores; just make sure you pass all relevant references in those other stores into your `gc` action.

## API Reference

### withReferencePool(ModelType)

This is an MST extension that takes an argument of the entity type that you will be storing in your reference pool.

```ts
import { types } from "mobx-state-tree"
import { withReferencePool } from "mst-reference-pool'
import { PostModel } from "./post"

const RootStore = types.model("RootStore", {
  pool: types.array(PostModel)
})
.extend(withReferencePool(PostModel))
```

### addToPool(instanceSnapshot)

This is an action on your extended store that adds an instance to the pool. If an instance already exists with that identifier in the pool, it will run `applySnapshot` to the existing instance instead of making a duplicate. Think of it as an add or update action.

It will return the MST instance that it creates or updates.

```ts
// ...
.actions((store) => ({
  addPost(newPost) {
    const post = store.addToPool(newPost)
    // add reference to it somewhere?
    store.posts.push(post)
    store.currentPost = post
  }
}))
```

### addAllToPool(instanceSnapshots)

This is an action on your extended store that adds multiple instances to the pool. If an instance already exists with that identifier in the pool, it will run `applySnapshot` to the existing instance instead of making a duplicate. Think of it as an add or update action for multiple items.

It will return an array of the MST instances that it creates or updates.

### poolGC([ ...listOfReferences ])

This is an action on your extended store that garbage collects instances in the pool that do not have any living references left.

You need to provide any references, since those could live anywhere on the tree. These can be single references or arrays of references.

I recommend creating a `gc` action on your store that calls this action and passes in all references.

```ts
.actions((store) => ({
  gc() {
    store.poolGC([
      store.feed,
      store.currentPost,
      // perhaps some other store as well?
      // search results is a common one
      store.searchStore.filteredPosts
    ])
  }
}))
```

# Troubleshooting / Tips

1. Make sure you have a pool in the store that is an array of the model type you want to store
2. Make sure other properties are references or safeReferences
3. Make sure to run the GC regularly (see the Garbage Collection section above)
4. Feel free to join the [Infinite Red Community](https://community.infinite.red) to ask questions in our #mobx-state-tree channel

# License

This project is copyright 2021 by Infinite Red, Inc., and licensed under the MIT license.

# Further Information

- Learn about [MobX-State-Tree](https://mobx-state-tree.js.org)
- Check out the original live streams where Jamon Holmgren built the first version of this: [Links coming]() & [Soon]()
- Learn more about [Infinite Red](https://infinite.red)
- Join Jamon on Mondays, Wednesdays, and Fridays on his [Twitch stream](https://twitch.tv/jamonholmgren) to hang out while he works on React Native, MobX-State-Tree, and more!
