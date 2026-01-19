# Armadillo Safety Products - Management System

A comprehensive management software for Armadillo Safety Products to manage orders, inventory, customers, sales representatives, and distributors.

## Features

- **Dashboard** - Overview of business operations with quick stats
- **Orders Management** - Create, view, and process customer orders
- **Inventory Tracking** - Manage products with stock levels and low-stock alerts
- **Customer Database** - Store and manage customer contact information
- **Sales Representatives** - Track reps, territories, and commission rates
- **Distributors** - Manage distributor partnerships and discount agreements

## Tech Stack

- **Next.js 16** with App Router and TypeScript
- **SQLite** with Prisma ORM
- **Tailwind CSS** for styling
- **React Hook Form** for form handling
- **Heroicons** for icons

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up the database:**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Database Schema

- **Products** - Product catalog with SKU, price, category
- **Inventory** - Stock levels, minimum stock, storage location
- **Orders** - Order tracking with line items and status
- **Customers** - Customer information and contact details
- **Sales Reps** - Representative info with commission rates
- **Distributors** - Distributor companies with discount rates

## API Routes

All CRUD operations are available via RESTful API:

- `/api/products` - Product management
- `/api/orders` - Order management
- `/api/customers` - Customer management
- `/api/sales-reps` - Sales rep management
- `/api/distributors` - Distributor management

## Adding Products

Navigate to **Inventory** → **Add Product** to populate your product catalog with your master list of safety products.

## Project Structure

```
src/
├── app/
│   ├── api/          # API routes
│   ├── orders/       # Orders pages
│   ├── inventory/    # Inventory pages
│   ├── customers/    # Customers pages
│   ├── sales-reps/   # Sales reps pages
│   ├── distributors/ # Distributors pages
│   └── layout.tsx    # Root layout with navigation
├── components/       # Reusable components
└── lib/             # Utilities and database client

prisma/
└── schema.prisma    # Database schema
```

## License

Proprietary - Armadillo Safety Products