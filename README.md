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

2. **Set up environment variables:**
   
   Create a `.env.local` file in the root directory with the following variables:
   ```env
   # Supabase Configuration (REQUIRED)
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   
   # Application URL (Optional - defaults to http://localhost:3000 in development)
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   
   # Shopify Configuration (Optional - only needed if using Shopify integration)
   SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
   SHOPIFY_ACCESS_TOKEN=your_shopify_access_token
   ```
   
   Get your Supabase credentials from: https://app.supabase.com/project/_/settings/api

3. **Set up the database:**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Vercel Deployment

When deploying to Vercel, you **must** add the following environment variables in your Vercel project settings:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:

   **Required:**
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key
   
   **Optional:**
   - `NEXT_PUBLIC_APP_URL` - Your production URL (e.g., `https://your-app.vercel.app`)
   - `SHOPIFY_STORE_DOMAIN` - If using Shopify integration
   - `SHOPIFY_ACCESS_TOKEN` - If using Shopify integration

4. After adding the variables, trigger a new deployment or wait for the next automatic deployment.

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