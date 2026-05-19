const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@as-integrations/express4');
const pool = require('./db');

const app = express();

const typeDefs = `#graphql
  type User { id: ID!, email: String! }
  type Product { id: ID!, name: String!, description: String, price: Float! }
  type OrderItem { product: Product!, quantity: Int! }
  type Order { id: ID!, user: User!, items: [OrderItem!]!, created_at: String! }

  type Query {
    products: [Product!]!
    product(id: ID!): Product
    orders: [Order!]!
    order(id: ID!): Order
  }

  type Mutation {
    signup(email: String!, password: String!): String!
    login(email: String!, password: String!): String!
    createProduct(name: String!, description: String, price: Float!): Product!
    updateProduct(id: ID!, name: String, description: String, price: Float): Product!
    deleteProduct(id: ID!): String!
    createOrder(productIds: [ID!]!): Order!
  }
`;

const resolvers = {
  Query: {
    products: async () => {
      const res = await pool.query('SELECT * FROM products');
      return res.rows;
    },
    product: async (_, { id }) => {
      const res = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
      return res.rows[0];
    },
    orders: async (_, __, context) => {
      if (!context.user) throw new Error("Unauthorized");
      const res = await pool.query('SELECT * FROM orders WHERE user_id = $1', [context.user.id]);
      return res.rows;
    },
    order: async (_, { id }, context) => {
      if (!context.user) throw new Error("Unauthorized");
      const res = await pool.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [id, context.user.id]);
      return res.rows[0];
    }
  },
  
  Order: {
    user: async (parent) => {
      const res = await pool.query('SELECT id, email FROM users WHERE id = $1', [parent.user_id]);
      return res.rows[0];
    },
    items: async (parent) => {
      const res = await pool.query(`
        SELECT p.*, oi.quantity 
        FROM order_items oi 
        JOIN products p ON oi.product_id = p.id 
        WHERE oi.order_id = $1
      `, [parent.id]);
      
      return res.rows.map(row => ({
        product: { id: row.id, name: row.name, description: row.description, price: row.price },
        quantity: row.quantity
      }));
    }
  },

  Mutation: {
    signup: async (_, { email, password }) => {
      const hashedPw = await bcrypt.hash(password, 10);
      const res = await pool.query('INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id', [email, hashedPw]);
      return jwt.sign({ id: res.rows[0].id, email }, process.env.JWT_SECRET);
    },
    login: async (_, { email, password }) => {
      const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      const user = res.rows[0];
      if (!user || !(await bcrypt.compare(password, user.password))) throw new Error("Invalid credentials");
      return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET);
    },
    createProduct: async (_, { name, description, price }, context) => {
      if (!context.user) throw new Error("Unauthorized");
      const res = await pool.query(
        'INSERT INTO products (name, description, price) VALUES ($1, $2, $3) RETURNING *',
        [name, description, price]
      );
      return res.rows[0];
    },
    updateProduct: async (_, { id, name, description, price }, context) => {
      if (!context.user) throw new Error("Unauthorized");
      const res = await pool.query(
        'UPDATE products SET name = COALESCE($1, name), description = COALESCE($2, description), price = COALESCE($3, price) WHERE id = $4 RETURNING *',
        [name, description, price, id]
      );
      return res.rows[0];
    },
    deleteProduct: async (_, { id }, context) => {
      if (!context.user) throw new Error("Unauthorized");
      await pool.query('DELETE FROM products WHERE id = $1', [id]);
      return "Product deleted successfully";
    },
    createOrder: async (_, { productIds }, context) => {
      if (!context.user) throw new Error("Unauthorized");
      
      const client = await pool.connect();
      try {
        await client.query('BEGIN'); 
        
        const orderRes = await client.query('INSERT INTO orders (user_id) VALUES ($1) RETURNING *', [context.user.id]);
        const order = orderRes.rows[0];

        for (const productId of productIds) {
          await client.query('INSERT INTO order_items (order_id, product_id, quantity) VALUES ($1, $2, 1)', [order.id, productId]);
        }

        await client.query('COMMIT'); 
        return order;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }
  }
};

async function startServer() {
  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();

  app.use(cors());
  app.use(express.json());

  app.use('/graphql', expressMiddleware(server, {
    context: async ({ req }) => {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.replace('Bearer ', '');
      if (!token) return { user: null };
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return { user: decoded };
      } catch (err) {
        return { user: null };
      }
    },
  }));

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`GraphQL Server ready at http://localhost:${PORT}/graphql`);
  });
}

startServer();