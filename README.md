# E-Commerce GraphQL API

A simple e-commerce backend built with Node.js, Express, PostgreSQL and GraphQL. Supports product and order management with JWT auth.

---

## Database Setup

Make sure PostgreSQL is running, then run the SQL below to create the tables:

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    quantity INT NOT NULL DEFAULT 1,
    PRIMARY KEY (order_id, product_id)
);
```

---

## Running the Project

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file:
```env
PORT=4000
DATABASE_URL=postgresql://username:password@localhost:5432/your_db
JWT_SECRET=your_secret
```

3. Start the server:
```bash
npm run dev
```

Go to `http://localhost:4000/graphql` to open the Apollo Sandbox and test everything.

---

## GraphQL Examples

For mutations and order queries, add this to the Headers tab in Apollo Sandbox after logging in:
```json
{ "Authorization": "Bearer YOUR_TOKEN" }
```

### Signup & Login

```graphql
mutation {
  signup(email: "user@test.com", password: "password123")
}
```

```graphql
mutation {
  login(email: "user@test.com", password: "password123")
}
```

### Products

```graphql
query {
  products {
    id
    name
    description
    price
  }
}
```

```graphql
query {
  product(id: "1") {
    name
    price
  }
}
```

```graphql
mutation {
  createProduct(name: "Wireless Mouse", description: "Ergonomic 2.4GHz", price: 29.99) {
    id
    name
    price
  }
}
```

```graphql
mutation {
  updateProduct(id: "1", price: 24.99) {
    id
    name
    price
  }
}
```

```graphql
mutation {
  deleteProduct(id: "1")
}
```

### Orders

```graphql
mutation {
  createOrder(productIds: ["1", "2"]) {
    id
    created_at
  }
}
```

```graphql
query {
  orders {
    id
    created_at
    items {
      quantity
      product {
        name
        price
      }
    }
  }
}
```

```graphql
query {
  order(id: "1") {
    id
    created_at
    items {
      quantity
      product {
        name
        price
      }
    }
  }
}
```
