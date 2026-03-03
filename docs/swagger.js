let swaggerUi;

try {
  swaggerUi = require("swagger-ui-express");
} catch (error) {
  swaggerUi = null;
}

const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Karibu Groceries API",
    version: "1.0.0",
    description: "API documentation for authentication, dashboard, sales, stock, and procurement endpoints.",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Local development server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "token",
      },
    },
  },
  tags: [
    { name: "Auth" },
    { name: "Dashboard" },
    { name: "Sales" },
    { name: "Stock" },
    { name: "Procurement" },
  ],
  paths: {
    "/": {
      get: {
        tags: ["Auth"],
        summary: "Landing page",
        responses: {
          200: { description: "Returns index page" },
        },
      },
    },
    "/login": {
      get: {
        tags: ["Auth"],
        summary: "Login page",
        responses: {
          200: { description: "Returns login page" },
        },
      },
      post: {
        tags: ["Auth"],
        summary: "Authenticate user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  username: { type: "string" },
                  password: { type: "string" },
                },
                required: ["username", "password"],
              },
            },
          },
        },
        responses: {
          200: { description: "Login successful" },
          401: { description: "Invalid credentials" },
          404: { description: "User not found" },
        },
      },
    },
    "/signup": {
      get: {
        tags: ["Auth"],
        summary: "Signup page redirect",
        responses: {
          302: { description: "Redirects to login" },
        },
      },
      post: {
        tags: ["Auth"],
        summary: "Self signup disabled",
        responses: {
          403: { description: "Signup is disabled" },
        },
      },
    },
    "/users": {
      get: {
        tags: ["Auth"],
        summary: "List users (Director only)",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          200: { description: "Users fetched" },
          403: { description: "Forbidden" },
        },
      },
      post: {
        tags: ["Auth"],
        summary: "Create user (Director only)",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          201: { description: "User created" },
          400: { description: "Validation error" },
        },
      },
    },
    "/users/{id}": {
      put: {
        tags: ["Auth"],
        summary: "Update user (Director only)",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "User updated" },
          404: { description: "User not found" },
        },
      },
      delete: {
        tags: ["Auth"],
        summary: "Delete user (Director only)",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "User deleted" },
          400: { description: "Cannot delete current account" },
          404: { description: "User not found" },
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Current authenticated user",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          200: { description: "User profile" },
          404: { description: "User not found" },
        },
      },
    },
    "/logout": {
      get: {
        tags: ["Auth"],
        summary: "Logout user",
        responses: {
          302: { description: "Clears cookie and redirects to login" },
        },
      },
    },
    "/dashboard": {
      get: {
        tags: ["Dashboard"],
        summary: "Redirect to role dashboard",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          302: { description: "Redirects to role dashboard" },
          403: { description: "Role has no dashboard" },
        },
      },
    },
    "/dashboard/director": {
      get: {
        tags: ["Dashboard"],
        summary: "Director dashboard page",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          200: { description: "Returns director dashboard page" },
          403: { description: "Forbidden" },
        },
      },
    },
    "/dashboard/manager": {
      get: {
        tags: ["Dashboard"],
        summary: "Manager dashboard page",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          200: { description: "Returns manager dashboard page" },
          403: { description: "Forbidden" },
        },
      },
    },
    "/dashboard/sales-agent": {
      get: {
        tags: ["Dashboard"],
        summary: "Sales agent dashboard page",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          200: { description: "Returns sales agent dashboard page" },
          403: { description: "Forbidden" },
        },
      },
    },
    "/sales/records": {
      get: {
        tags: ["Sales"],
        summary: "Get sales records",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          {
            name: "type",
            in: "query",
            schema: { type: "string", enum: ["all", "cash", "credit"] },
          },
          {
            name: "branch",
            in: "query",
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Sales records fetched" },
          400: { description: "Invalid type" },
        },
      },
    },
    "/sales/summary": {
      get: {
        tags: ["Sales"],
        summary: "Get branch sales summary (Director only)",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          200: { description: "Summary fetched" },
          403: { description: "Forbidden" },
        },
      },
    },
    "/sales/price-quote": {
      get: {
        tags: ["Sales"],
        summary: "Get sale price quote",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "produceName", in: "query", schema: { type: "string" } },
          { name: "tonnageKg", in: "query", schema: { type: "number" } },
          { name: "branch", in: "query", schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Quote fetched" },
          400: { description: "Invalid input" },
        },
      },
    },
    "/sales/cash": {
      post: {
        tags: ["Sales"],
        summary: "Record cash sale",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          201: { description: "Cash sale created" },
          400: { description: "Validation or stock error" },
          403: { description: "Forbidden" },
        },
      },
    },
    "/sales/credit": {
      post: {
        tags: ["Sales"],
        summary: "Record credit sale",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          201: { description: "Credit sale created" },
          400: { description: "Validation or stock error" },
          403: { description: "Forbidden" },
        },
      },
    },
    "/stock/summary": {
      get: {
        tags: ["Stock"],
        summary: "Get stock summary",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          200: { description: "Stock summary fetched" },
          403: { description: "Forbidden" },
        },
      },
    },
    "/stock/alerts": {
      get: {
        tags: ["Stock"],
        summary: "Get stock alerts",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          200: { description: "Stock alerts fetched" },
          403: { description: "Forbidden" },
        },
      },
    },
    "/procurement/records": {
      get: {
        tags: ["Procurement"],
        summary: "Get procurement records",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          200: { description: "Records fetched" },
          403: { description: "Forbidden" },
        },
      },
    },
    "/procurement/summary": {
      get: {
        tags: ["Procurement"],
        summary: "Get procurement summary",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          200: { description: "Summary fetched" },
          403: { description: "Forbidden" },
        },
      },
    },
    "/procurement": {
      post: {
        tags: ["Procurement"],
        summary: "Create procurement",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          201: { description: "Procurement created" },
          400: { description: "Validation error" },
          403: { description: "Forbidden" },
        },
      },
    },
    "/procurement/{id}": {
      put: {
        tags: ["Procurement"],
        summary: "Update procurement",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Procurement updated" },
          404: { description: "Record not found" },
        },
      },
      delete: {
        tags: ["Procurement"],
        summary: "Delete procurement",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Procurement deleted" },
          404: { description: "Record not found" },
        },
      },
    },
  },
};

const registerSwagger = (app) => {
  if (!swaggerUi) {
    app.get("/api-docs", (req, res) => {
      res.status(500).json({
        message: "Swagger UI is not installed. Run: npm install swagger-ui-express",
      });
    });
    return;
  }

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(openApiSpec);
  });
};

module.exports = { registerSwagger };
