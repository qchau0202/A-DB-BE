# Impedance Mismatch: SQL JOINs vs NoSQL Document Read

## SQL Relational Retrieval
To show a user's feed with post author and relationships, SQL usually needs joins across multiple normalized tables:
- Users
- Following
- Posts

This is powerful and consistent, but query complexity increases as relationships grow.

## NoSQL Document Retrieval
With MongoDB, a single document can already contain read-optimized data for a feed card:

```json
{
  "user_id": 12,
  "snippet": "WITH RECURSIVE ...",
  "tags": ["sql", "react"],
  "likes": 120
}
```

A single document read is fast and simple for this use case, but can duplicate data and requires careful update logic.

## Why This Is Called Impedance Mismatch
Object-oriented app models often fit hierarchical documents naturally, while relational schemas fit normalized, table-based structures. Mapping between these shapes creates the mismatch.
