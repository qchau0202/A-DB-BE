# MongoDB setup (DevConnect)

This folder contains the reusable MongoDB bootstrap script for the current document model.

## Files

- `001_mongodb_setup.js`: Creates or updates collections, validators, and indexes.

## Run setup

From backend root:

```bash
node src/db/nosql/001_mongodb_setup.js
```

The script reads:

- `MONGODB_URI`
- `MONGODB_DB_NAME` (defaults to `devconnect`)

## Collections initialized

- `posts`
- `documents`
- `quickies`
- `comments`
- `userReactions`

## Notes

- `posts_search` is created as a driver-managed text index on `title`, `content_blocks.data`, and `tags`.
- If you want a native Atlas Search definition, create it separately in the Atlas UI with the same fields.
- `quickies.ttl_idx` expires documents after 86,400 seconds.
- `userReactions.unique_rxn` prevents duplicate reactions for the same user/target/type triple.
