# Savitri Balika Salary Management System

Modern payroll software for **Savitri Balika Inter College, Khutaha Road, Jamunahiya, Mirzapur**.

## Stack

- Next.js App Router, React, JavaScript
- Tailwind CSS design system with light/dark mode
- MongoDB with Mongoose models
- JWT authentication in secure HTTP-only cookies
- PDF salary slips and Excel-compatible report export

## Modules

- Dashboard with payroll metrics and salary status
- Employee profiles with photo upload, auto `SBI-YYYY-XXX` employee IDs, bank details, base salary, and active/inactive status
- Salary generation with CL allowance, excess CL deduction, emergency leave tracking, bonus, advance deduction, notes, paid/pending status
- Bulk salary generation for active employees
- Corporate salary slip with logo, watermark, print/PDF export, and signature section
- Reports and salary history with month, employee, and status filters

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Update `.env.local` before production:

```bash
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster.example.mongodb.net/savitri_salary
MONGODB_DB=savitri_salary
JWT_SECRET=use-a-long-random-secret
ADMIN_EMAIL=admin@savitri.edu
ADMIN_PASSWORD=replace-this
ACCOUNTANT_EMAIL=accounts@savitri.edu
ACCOUNTANT_PASSWORD=replace-this
```

For production, prefer `ADMIN_PASSWORD_HASH` and `ACCOUNTANT_PASSWORD_HASH` with bcrypt hashes instead of plain passwords.

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Ngrok / Port Forwarding

Run the dev server with:

```bash
npm run dev:ngrok
```

Then expose the same port, usually 3000:

```bash
ngrok http 3000
```

The app allows ngrok development origins in `next.config.js`, so the login page, forgot password flow, and API calls can load correctly through the forwarded URL.

## Deployment

The app is ready for Vercel or any Node.js host that supports Next.js. Configure the environment variables above, connect MongoDB, then deploy with:

```bash
npm run build
npm run start
```
